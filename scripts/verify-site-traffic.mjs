import { updateTrafficState } from "./update-site-traffic.mjs";

const startedAt = "2026-07-16T00:00:00Z";
const now = new Date("2026-07-18T12:00:00Z");
const savedState = {
  pageViews: 12,
  lastUpdatedAt: "2026-07-17T00:05:00Z",
  lastProcessedPeriod: "2026-07-16",
  source: "cloudflare",
  countingStartedAt: startedAt,
};

const initial = await updateTrafficState({ ...savedState, pageViews: 0, lastProcessedPeriod: null }, now);
assert(initial.state.pageViews === 0 && initial.source === "initial", "missing credentials should keep the initial value");

const apiFailure = await updateTrafficState(savedState, now, async () => {
  throw new Error("rate limited");
});
assert(apiFailure.state === savedState && apiFailure.source === "saved", "API failures must preserve saved state");

const invalidAggregate = await updateTrafficState(savedState, now, async () => -1);
assert(invalidAggregate.state === savedState && invalidAggregate.source === "saved", "invalid or lower aggregate must not reduce the counter");

const duplicatePeriod = await updateTrafficState(
  { ...savedState, lastProcessedPeriod: "2026-07-17" },
  now,
  async () => {
    throw new Error("a completed period must not be requested twice");
  },
);
assert(duplicatePeriod.state.pageViews === 12 && duplicatePeriod.source === "saved", "same period must not be duplicated");

const fresh = await updateTrafficState(savedState, now, async (period) => {
  assert(period.start === "2026-07-17T00:00:00.000Z", "fresh aggregate must start after the saved watermark");
  assert(period.end === "2026-07-18T00:00:00.000Z", "fresh aggregate must use only completed UTC days");
  return 7;
});
assert(fresh.state.pageViews === 19, "valid aggregate must increase the counter");
assert(fresh.state.lastProcessedPeriod === "2026-07-17", "fresh aggregate must advance the watermark");

console.log("site traffic preservation and period deduplication verification passed");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

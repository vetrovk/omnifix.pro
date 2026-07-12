import { relativeDate } from "./generate-live-feed.mjs";

const now = new Date("2026-07-12T12:00:00Z");
const cases = [
  ["yesterday", "2026-07-11T12:00:00Z"],
  ["3 days ago", "2026-07-09T12:00:00Z"],
  ["Jul 4", "2026-07-04T12:00:00Z"],
];

for (const [expected, timestamp] of cases) {
  const actual = relativeDate(timestamp, now);
  if (actual !== expected) {
    throw new Error(`${timestamp}: expected ${expected}, received ${actual}`);
  }
}

console.log("relative-time verification passed");

import { deduplicateEngineeringWork, relativeDate } from "./generate-live-feed.mjs";

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

const relatedWork = deduplicateEngineeringWork([
  {
    source: "vetrovk/pytest",
    eventType: "PushEvent",
    workSha: "same-work",
    timestamp: "2026-07-13T06:24:12Z",
  },
  {
    source: "pytest-dev/pytest",
    eventType: "PullRequestEvent",
    status: "PR opened",
    workKey: "pytest-dev/pytest#123",
    workSha: "same-work",
    timestamp: "2026-07-13T05:43:52Z",
  },
  {
    source: "pytest-dev/pytest",
    eventType: "PullRequestReviewEvent",
    status: "PR review",
    workKey: "pytest-dev/pytest#123",
    workSha: "same-work",
    timestamp: "2026-07-13T07:00:00Z",
  },
]);

if (relatedWork.length !== 1 || relatedWork[0].eventType !== "PullRequestReviewEvent") {
  throw new Error("fork push and lower-value PR activity were not deduplicated");
}

console.log("relative-time and activity deduplication verification passed");

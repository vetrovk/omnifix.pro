import { deduplicateEngineeringWork, loadFeed, relativeDate } from "./generate-live-feed.mjs";

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

const savedFeed = [{ source: "usememos/memos", timestamp: "2026-07-14T07:22:51Z" }];
const fallbackFeed = [{ source: "sqlfluff/sqlfluff", timestamp: "2026-07-07T08:44:02Z" }];

const afterApiFailure = await loadFeed(fallbackFeed, savedFeed, async () => {
  throw new Error("GitHub API 403; remaining=0");
});
if (afterApiFailure.source !== "saved" || afterApiFailure.items !== savedFeed) {
  throw new Error("API failure replaced the last known feed");
}

const afterStaleResponse = await loadFeed(fallbackFeed, savedFeed, async () => ({
  items: [{ source: "sqlfluff/sqlfluff", timestamp: "2026-07-07T08:44:02Z" }],
  candidates: [],
}));
if (afterStaleResponse.source !== "saved" || afterStaleResponse.items !== savedFeed) {
  throw new Error("stale GitHub activity replaced the newer saved feed");
}

const noActivity = await loadFeed(fallbackFeed, [], async () => ({ items: [], candidates: [] }));
if (noActivity.source !== "github" || noActivity.items.length !== 0) {
  throw new Error("successful empty GitHub response used fallback data");
}

const bootstrapFailure = await loadFeed(fallbackFeed, [], async () => {
  throw new Error("GitHub API 403; remaining=0");
});
if (bootstrapFailure.source !== "fallback" || bootstrapFailure.items !== fallbackFeed) {
  throw new Error("initial API failure did not use fallback data");
}

console.log("relative-time, activity deduplication, and feed preservation verification passed");

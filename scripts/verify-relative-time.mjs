import {
  authoredMergedPullRequestToItem,
  deduplicateEngineeringWork,
  isRecentAuthoredMerge,
  loadFeed,
  relativeDate,
  selectFeedItems,
} from "./generate-live-feed.mjs";

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
    description: "pytest doctest collection fix",
    eventType: "PushEvent",
    forkUpstream: "pytest-dev/pytest",
    workSha: "same-work",
    timestamp: "2026-07-13T06:24:12Z",
  },
  {
    source: "pytest-dev/pytest",
    description: "pytest doctest collection fix",
    eventType: "PullRequestEvent",
    status: "PR opened",
    workKey: "pytest-dev/pytest#123",
    workSha: "same-work",
    timestamp: "2026-07-13T05:43:52Z",
  },
  {
    source: "pytest-dev/pytest",
    description: "pytest doctest collection fix",
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

const mypyForkContribution = deduplicateEngineeringWork([
  {
    source: "vetrovk/mypy",
    description: "typeddict closed version",
    eventType: "PushEvent",
    forkUpstream: "python/mypy",
    timestamp: "2026-07-20T17:28:17Z",
  },
  {
    source: "python/mypy",
    description: "TypedDict closed argument version check",
    eventType: "IssueCommentEvent",
    status: "review",
    workKey: "python/mypy#21749",
    timestamp: "2026-07-20T17:34:23Z",
  },
  {
    source: "vetrovk/memoryos",
    description: "local memory update",
    eventType: "PushEvent",
    timestamp: "2026-07-20T17:30:00Z",
  },
]);

if (
  mypyForkContribution.length !== 2
  || mypyForkContribution.some((item) => item.source === "vetrovk/mypy")
  || !mypyForkContribution.some((item) => item.source === "python/mypy")
  || !mypyForkContribution.some((item) => item.source === "vetrovk/memoryos")
) {
  throw new Error("mypy fork push was not replaced by the related upstream review");
}

const pytestMergedPullRequest = {
  number: 14702,
  title: "fix: resolve doctest locations for fixture definitions",
  html_url: "https://github.com/pytest-dev/pytest/pull/14702",
  user: { login: "vetrovk" },
  base: { repo: { full_name: "pytest-dev/pytest" } },
  head: { sha: "fork-push-sha" },
  merge_commit_sha: "e7355d70771b5f34f78d7012f73bdc8eb79574d6",
  merged_at: "2026-07-21T12:46:11Z",
};
const pytestAuthoredMerge = authoredMergedPullRequestToItem(pytestMergedPullRequest);
const pytestMergeTimeline = deduplicateEngineeringWork([
  {
    source: "vetrovk/pytest",
    description: "resolve doctest locations fixture definitions",
    eventType: "PushEvent",
    forkUpstream: "pytest-dev/pytest",
    timestamp: "2026-07-21T12:45:00Z",
  },
  {
    source: "pytest-dev/pytest",
    description: "resolve doctest locations for fixture definitions",
    eventType: "PullRequestEvent",
    status: "PR opened",
    workKey: "pytest-dev/pytest#14702",
    timestamp: "2026-07-13T05:43:52Z",
  },
  pytestAuthoredMerge,
]);

if (
  pytestMergeTimeline.length !== 1
  || pytestMergeTimeline[0].status !== "PR merged"
  || pytestMergeTimeline[0].timestamp !== "2026-07-21T12:46:11Z"
  || pytestMergeTimeline[0].statusUrl !== pytestMergedPullRequest.html_url
  || !isRecentAuthoredMerge(pytestMergedPullRequest, Date.parse("2026-07-21T12:47:00Z"))
) {
  throw new Error("authored pytest merge did not replace related fork and opened PR activity");
}

const chronologicalMergeSelection = selectFeedItems([
  ...pytestMergeTimeline,
  {
    source: "sqlfluff/sqlfluff",
    description: "older merged contribution",
    status: "PR merged",
    eventType: "AuthoredPullRequestMerge",
    workKey: "sqlfluff/sqlfluff#1",
    timestamp: "2026-07-07T08:44:02Z",
    _score: 204,
  },
]);

if (chronologicalMergeSelection[0]?.workKey !== "pytest-dev/pytest#14702") {
  throw new Error("newest authored merge was displaced by repository priority");
}

const distinctMemosActivities = deduplicateEngineeringWork([
  {
    source: "usememos/memos",
    description: "require boundaries before tags",
    eventType: "PullRequestReviewEvent",
    workKey: "usememos/memos#6092",
    timestamp: "2026-07-14T07:22:51Z",
  },
  {
    source: "usememos/memos",
    description: "Allow apostrophes in tag names",
    eventType: "PullRequestEvent",
    workKey: "usememos/memos#6080",
    timestamp: "2026-07-09T13:50:09Z",
  },
]);

if (distinctMemosActivities.length !== 2) {
  throw new Error("distinct Memos pull requests were incorrectly deduplicated");
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

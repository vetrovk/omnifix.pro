import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const USER = "vetrovk";
const OWN_REPOSITORY_OWNERS = new Set(["vetrovk", "kirillvetrov"]);
const MAX_ITEMS = 4;
const EVENTS_URL = `https://api.github.com/users/${USER}/events/public`;
const EVENTS_PAGE_SIZE = 100;
const MAX_EVENT_PAGES = 3;
const RELATED_FORK_PUSH_WINDOW_MS = 72 * 60 * 60 * 1000;
const EXCLUDED_REPOSITORIES = new Set(["vetrovk/omnifix.pro"]);
const REPO_PRIORITY = new Map([
  ["sqlfluff/sqlfluff", 100],
  ["FOSSBilling/FOSSBilling", 94],
  ["gchq/CyberChef", 92],
  ["vetrovk/oracle-bot", 84],
]);
const FALLBACK_PATH = "data/live-feed-fallback.json";
const FEATURED_PROJECT_PATH = "data/featured-project.json";
const OPEN_SOURCE_STATS_PATH = "data/open-source-stats.json";
const OUTPUT_PATH = "data/live-feed.json";
const HTML_PATH = "index.html";
const MERGED_PULL_REQUESTS_URL = `https://api.github.com/search/issues?q=author:${USER}+is%3Apr+is%3Amerged&per_page=100`;
const START_MARKER = "<!-- live-feed:start -->";
const END_MARKER = "<!-- live-feed:end -->";
const FEATURED_PROJECT_START_MARKER = "<!-- featured-project:start -->";
const FEATURED_PROJECT_END_MARKER = "<!-- featured-project:end -->";
const FEATURED_PROJECT_MOBILE_START_MARKER = "<!-- featured-project-mobile:start -->";
const FEATURED_PROJECT_MOBILE_END_MARKER = "<!-- featured-project-mobile:end -->";
const OPEN_SOURCE_STATS_START_MARKER = "<!-- open-source-stats:start -->";
const OPEN_SOURCE_STATS_END_MARKER = "<!-- open-source-stats:end -->";
const GENERIC_TITLE_WORDS = new Set(["fix", "update", "version", "check", "support", "change"]);
const forkUpstreamCache = new Map();

async function main() {
  const fallback = await readJson(FALLBACK_PATH);
  const savedFeed = await readJson(OUTPUT_PATH).catch(() => []);
  const featuredProject = await readJson(FEATURED_PROJECT_PATH);
  const openSourceStatsConfig = await readJson(OPEN_SOURCE_STATS_PATH);
  const { items, candidates, source } = await loadFeed(fallback, savedFeed);
  const normalized = normalizeFeed(items, source);
  const featured = normalizeFeaturedProject(featuredProject, candidates);
  const openSourceStats = await normalizeOpenSourceStats(openSourceStatsConfig);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(normalized, null, 2)}\n`);
  await updateHtml(normalized, featured, openSourceStats);

  console.log(`live-feed: wrote ${normalized.length} ${source} item(s)`);
  for (const item of normalized) {
    console.log([
      "live-feed: selected",
      item.source,
      item.eventType,
      item.timestamp,
      item.relativeTime,
      item.selectionReason,
    ].join("\t"));
  }
}

export async function loadFeed(fallback, savedFeed, collectItems = collectGitHubItems) {
  const hasSavedFeed = Array.isArray(savedFeed) && savedFeed.length > 0;
  const preservedItems = hasSavedFeed ? savedFeed : fallback;
  const preservedSource = hasSavedFeed ? "saved" : "fallback";

  try {
    const feed = await collectItems();
    if (!feed.items.length) {
      if (hasSavedFeed) {
        console.warn("live-feed: keeping saved feed (no supported GitHub activity)");
        return { items: savedFeed, candidates: savedFeed, source: "saved" };
      }
      return { items: [], candidates: [], source: "github" };
    }
    if (hasSavedFeed && isOlderThanSavedFeed(feed.items, savedFeed)) {
      console.warn("live-feed: keeping newer saved feed (GitHub activity is older)");
      return { items: savedFeed, candidates: savedFeed, source: "saved" };
    }
    return { ...feed, source: "github" };
  } catch (error) {
    console.warn(`live-feed: keeping ${preservedSource} feed (${error.message})`);
    return { items: preservedItems, candidates: preservedItems, source: preservedSource };
  }
}

function isOlderThanSavedFeed(items, savedFeed) {
  const latestLive = mostRecentTimestamp(items);
  const latestSaved = mostRecentTimestamp(savedFeed);
  return Number.isFinite(latestLive) && Number.isFinite(latestSaved) && latestLive < latestSaved;
}

function mostRecentTimestamp(items) {
  return Math.max(...items.map((item) => Date.parse(item.timestamp)).filter(Number.isFinite));
}

async function collectGitHubItems() {
  const candidates = [];

  for (let page = 1; page <= MAX_EVENT_PAGES; page += 1) {
    const events = await fetchGitHubJson(`${EVENTS_URL}?per_page=${EVENTS_PAGE_SIZE}&page=${page}`);
    candidates.push(...await buildFeed(events));

    const deduplicated = deduplicateEngineeringWork(candidates);
    const selected = selectFeedItems(deduplicated);
    if (selected.length >= MAX_ITEMS || events.length < EVENTS_PAGE_SIZE) {
      return { items: selected, candidates: deduplicated };
    }
  }

  const deduplicated = deduplicateEngineeringWork(candidates);
  return { items: selectFeedItems(deduplicated), candidates: deduplicated };
}

async function fetchGitHubJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "omnifix.pro-static-feed",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    throw new Error(`GitHub API ${response.status}; remaining=${remaining ?? "unknown"}`);
  }

  return response.json();
}

function buildFeed(events) {
  return Promise.all(events.map(eventToFeedItem))
    .then((items) => items.filter(Boolean));
}

function selectFeedItems(items) {
  const unique = uniqueBy(items.sort(compareItems), feedIdentityKey);
  const merged = unique.filter((item) => item.status === "PR merged" && !isOwnRepo(item.source));
  const opened = unique.filter((item) => item.status === "PR opened" && !isOwnRepo(item.source));
  const projectPushes = unique.filter((item) => item.status === "pushed" && isOwnRepo(item.source));
  const rest = unique.filter((item) => !merged.includes(item) && !projectPushes.includes(item));

  return uniqueBy([
    ...withSelectionReason(merged.slice(0, 2), "recent merged pull request"),
    ...withSelectionReason(projectPushes.slice(0, 1), "recent project push"),
    ...withSelectionReason(opened.slice(0, 1), "recent opened pull request"),
    ...withSelectionReason(rest, "supported public activity"),
  ], feedIdentityKey)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_ITEMS);
}

function withSelectionReason(items, selectionReason) {
  return items.map((item) => ({ ...item, selectionReason }));
}

function feedIdentityKey(item) {
  return (item.statusUrl || `${item.source}:${item.description}`).split("#")[0];
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function eventToFeedItem(event) {
  if (!event?.repo?.name || !event?.created_at || event.repo.private || isExcludedRepository(event.repo.name)) {
    return null;
  }

  if (event.type === "PullRequestEvent") {
    return pullRequestEventToItem(event);
  }

  if (["PullRequestReviewEvent", "PullRequestReviewCommentEvent"].includes(event.type)) {
    return pullRequestReviewActivityToItem(event);
  }

  if (event.type === "PushEvent") {
    return pushEventToItem(event);
  }

  if (event.type === "IssueCommentEvent" && event.payload?.issue?.pull_request) {
    return {
      source: event.repo.name,
      description: tidyTitle(event.payload.issue.title || `PR #${event.payload.issue.number} discussion`),
      status: "review",
      url: repoUrl(event.repo.name),
      statusUrl: event.payload.comment?.html_url || event.payload.issue.html_url,
      timestamp: event.created_at,
      eventType: event.type,
      workKey: pullRequestWorkKey(event.repo.name, event.payload.issue.number),
      type: isOwnRepo(event.repo.name) ? "project" : "open-source",
      _score: priorityFor(event.repo.name, 42),
    };
  }

  return null;
}

async function pullRequestEventToItem(event) {
  let pullRequest = event.payload?.pull_request;
  const action = event.payload?.action;
  if (!pullRequest || !["merged", "opened", "closed"].includes(action)) return null;

  pullRequest = await hydratePullRequest(pullRequest);

  if (action === "closed" && !pullRequest.merged_at) return null;

  const merged = action === "merged" || Boolean(pullRequest.merged_at);
  const status = merged ? "PR merged" : "PR opened";

  return {
    source: event.repo.name,
    description: tidyTitle(pullRequest.title || titleFromBranch(pullRequest.head?.ref) || `PR #${pullRequest.number}`),
    status,
    url: repoUrl(event.repo.name),
    statusUrl: pullRequest.html_url || prUrl(event.repo.name, pullRequest.number),
    timestamp: event.created_at,
    eventType: event.type,
    workKey: pullRequestWorkKey(event.repo.name, pullRequest.number),
    workSha: pullRequest.head?.sha,
    type: isOwnRepo(event.repo.name) ? "project" : "open-source",
    _score: priorityFor(event.repo.name, merged ? 100 : 70),
  };
}

async function pullRequestReviewActivityToItem(event) {
  let pullRequest = event.payload?.pull_request;
  if (!pullRequest) return null;

  pullRequest = await hydratePullRequest(pullRequest);

  return {
    source: event.repo.name,
    description: tidyTitle(pullRequest.title || titleFromBranch(pullRequest.head?.ref) || `PR #${pullRequest.number}`),
    status: "PR review",
    url: repoUrl(event.repo.name),
    statusUrl: pullRequest.html_url || prUrl(event.repo.name, pullRequest.number),
    timestamp: event.created_at,
    eventType: event.type,
    workKey: pullRequestWorkKey(event.repo.name, pullRequest.number),
    workSha: pullRequest.head?.sha,
    type: isOwnRepo(event.repo.name) ? "project" : "open-source",
    _score: priorityFor(event.repo.name, 88),
  };
}

async function hydratePullRequest(pullRequest) {
  if (pullRequest.title && pullRequest.html_url) {
    return pullRequest;
  }

  try {
    const fresh = await fetchGitHubJson(pullRequest.url);
    return { ...pullRequest, ...fresh };
  } catch {
    return pullRequest;
  }
}

async function pushEventToItem(event) {
  const commits = event.payload?.commits || [];
  const head = event.payload?.head;
  const message = commits.at(-1)?.message || titleFromBranch(event.payload?.ref) || "repository updated";
  const description = tidyTitle(message);
  const forkUpstream = await forkUpstreamFor(event.repo.name);

  return {
    source: event.repo.name,
    description,
    status: "pushed",
    url: repoUrl(event.repo.name),
    statusUrl: head ? `${repoUrl(event.repo.name)}/commit/${head}` : repoUrl(event.repo.name),
    timestamp: event.created_at,
    eventType: event.type,
    workSha: head,
    forkUpstream,
    type: isOwnRepo(event.repo.name) ? "project" : "open-source",
    _score: priorityFor(event.repo.name, 58),
  };
}

function pullRequestWorkKey(repository, number) {
  return number ? `${repository}#${number}` : null;
}

export function deduplicateEngineeringWork(items) {
  const highestValueItems = keepHighestValueWorkItems(items);

  return highestValueItems.filter((item) => {
    if (item.eventType !== "PushEvent" || !isOwnRepo(item.source) || !item.forkUpstream) {
      return true;
    }

    return !highestValueItems.some((related) => (
      isUpstreamPullActivity(related)
      && related.source === item.forkUpstream
      && timestampsAreRelated(related.timestamp, item.timestamp)
      && titlesDescribeSameWork(related.description, item.description)
    ));
  });
}

function keepHighestValueWorkItems(items) {
  const selectedByWorkKey = new Map();

  for (const item of items) {
    if (!item.workKey) continue;

    const current = selectedByWorkKey.get(item.workKey);
    if (!current || compareWorkValue(item, current) < 0) {
      selectedByWorkKey.set(item.workKey, item);
    }
  }

  return items.filter((item) => !item.workKey || selectedByWorkKey.get(item.workKey) === item);
}

function isUpstreamPullActivity(item) {
  return !isOwnRepo(item.source)
    && [
      "PullRequestEvent",
      "PullRequestReviewEvent",
      "PullRequestReviewCommentEvent",
      "IssueCommentEvent",
    ].includes(item.eventType);
}

function timestampsAreRelated(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime)
    && Number.isFinite(rightTime)
    && Math.abs(leftTime - rightTime) <= RELATED_FORK_PUSH_WINDOW_MS;
}

function titlesDescribeSameWork(left, right) {
  const leftTokens = meaningfulTitleTokens(left);
  const rightTokens = meaningfulTitleTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;

  const rightTokenSet = new Set(rightTokens);
  const sharedTokenCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  return sharedTokenCount >= Math.min(2, leftTokens.length, rightTokens.length);
}

function meaningfulTitleTokens(value) {
  return [...new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token && !GENERIC_TITLE_WORDS.has(token)),
  )];
}

function compareWorkValue(a, b) {
  const priorityDelta = workValuePriority(b) - workValuePriority(a);
  if (priorityDelta !== 0) return priorityDelta;
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

function workValuePriority(item) {
  if (item.status === "PR merged") return 400;
  if (item.eventType === "PullRequestReviewEvent") return 300;
  if (item.eventType === "PullRequestReviewCommentEvent") return 290;
  if (item.eventType === "IssueCommentEvent") return 280;
  if (item.eventType === "PullRequestEvent") return 200;
  if (item.eventType === "PushEvent") return 100;
  return 0;
}

function compareItems(a, b) {
  if (b._score !== a._score) return b._score - a._score;
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

function priorityFor(repo, base) {
  return base + (REPO_PRIORITY.get(repo) || 0);
}

function normalizeFeed(items, source) {
  return items
    .filter((item) => !isExcludedRepository(item.source))
    .slice(0, MAX_ITEMS)
    .map(({ _score, ...item }) => {
      const timestamp = validTimestamp(item.timestamp);

      return {
        source: item.source,
        description: item.description,
        status: item.status,
        url: item.url,
        statusUrl: item.statusUrl,
        timestamp,
        relativeTime: timestamp
          ? relativeDate(timestamp)
          : normalizeFallbackTime(item.relativeTime || item.time),
        eventType: item.eventType || "fallback",
        selectionReason: item.selectionReason || (source === "fallback" ? "saved fallback event" : "supported public event"),
        forkUpstream: item.forkUpstream || undefined,
        type: item.type,
      };
    });
}

function normalizeFeaturedProject(project, candidates) {
  const latestEvent = candidates
    .filter((item) => item.source === project.repository && item.status === "pushed")
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const timestamp = validTimestamp(latestEvent?.timestamp);

  return {
    ...project,
    lastPush: timestamp ? relativeDate(timestamp) : "—",
  };
}

async function normalizeOpenSourceStats(stats) {
  const normalized = {
    ...stats,
    mergedPullRequests: Number(stats.mergedPullRequests) || 0,
    repositoriesContributedTo: Number(stats.repositoriesContributedTo) || 0,
  };

  try {
    const result = await fetchGitHubJson(MERGED_PULL_REQUESTS_URL);
    if (result.incomplete_results || !Number.isInteger(result.total_count)) {
      throw new Error("GitHub search response is incomplete");
    }

    normalized.mergedPullRequests = Math.max(normalized.mergedPullRequests, result.total_count);

    // Only a complete first page can safely establish a repository count.
    if (result.total_count <= result.items.length) {
      const repositories = new Set(
        result.items.map((item) => item.repository_url).filter(Boolean),
      );
      normalized.repositoriesContributedTo = Math.max(
        normalized.repositoriesContributedTo,
        repositories.size,
      );
    }
  } catch (error) {
    console.warn(`open-source-stats: using configured all-time minimums (${error.message})`);
  }

  return normalized;
}

async function updateHtml(items, featured, openSourceStats) {
  const html = await readFile(HTML_PATH, "utf8");
  const rendered = items.length ? items.map(renderFeedRow).join("\n") : renderEmptyFeedRow();
  const withFeed = replaceHtmlRegion(html, START_MARKER, END_MARKER, rendered, "live-feed");
  const withFeaturedProject = replaceHtmlRegion(
    withFeed,
    FEATURED_PROJECT_START_MARKER,
    FEATURED_PROJECT_END_MARKER,
    renderFeaturedProject(featured),
    "featured-project",
  );
  const withMobileFeaturedProject = replaceHtmlRegion(
    withFeaturedProject,
    FEATURED_PROJECT_MOBILE_START_MARKER,
    FEATURED_PROJECT_MOBILE_END_MARKER,
    renderFeaturedProjectMobile(featured),
    "featured-project-mobile",
  );
  const nextHtml = replaceHtmlRegion(
    withMobileFeaturedProject,
    OPEN_SOURCE_STATS_START_MARKER,
    OPEN_SOURCE_STATS_END_MARKER,
    renderOpenSourceStats(openSourceStats),
    "open-source-stats",
  );
  await writeFile(HTML_PATH, nextHtml);
}

function replaceHtmlRegion(html, startMarker, endMarker, content, label) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${label} markers not found in index.html`);
  }

  return `${html.slice(0, start + startMarker.length)}\n${content}\n            ${html.slice(end)}`;
}

function renderFeedRow(item) {
  const statusClass = statusClassName(item.status);
  const statusClasses = ["feed-status", statusClass].filter(Boolean).join(" ");
  const statusHtml = item.statusUrl
    ? `<a class="${statusClasses}" href="${escapeAttr(item.statusUrl)}">${escapeHtml(item.status)}</a>`
    : `<span class="${statusClasses}">${escapeHtml(item.status)}</span>`;
  const timeHtml = item.relativeTime ? `<span class="feed-time">${escapeHtml(item.relativeTime)}</span>` : "";

  return `            <article class="feed-row" data-feed-type="${escapeAttr(item.type)}">
              <a class="feed-source" href="${escapeAttr(item.url)}">${escapeHtml(item.source)}</a>
              <span class="feed-copy">${escapeHtml(item.description)}</span>
              <span class="feed-meta">${timeHtml}${statusHtml}</span>
            </article>`;
}

function renderEmptyFeedRow() {
  return `            <article class="feed-row" data-feed-type="empty">
              <span class="feed-source">GitHub</span>
              <span class="feed-copy">Public activity is temporarily unavailable</span>
              <span class="feed-meta"><span class="feed-status">fallback</span></span>
            </article>`;
}

function renderFeaturedProject(project) {
  return `            <p class="featured-project-kicker">NOW BUILDING</p>
            <a class="featured-project-repository" href="${escapeAttr(project.github_url)}" target="_blank" rel="noreferrer">${escapeHtml(project.repository)}</a>
            <p class="featured-project-description">${escapeHtml(project.description)}</p>
            <dl class="featured-project-meta">
              <div><dt>Status</dt><dd>${escapeHtml(project.status)}</dd></div>
              <div><dt>Language</dt><dd>${escapeHtml(project.language)}</dd></div>
              <div><dt>License</dt><dd>${escapeHtml(project.license)}</dd></div>
              <div><dt>Last push</dt><dd>${escapeHtml(project.lastPush)}</dd></div>
            </dl>
            <a class="featured-project-link" href="${escapeAttr(project.github_url)}" target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">→</span></a>`;
}

function renderFeaturedProjectMobile(project) {
  return `            <p class="featured-project-mobile-kicker">NOW BUILDING</p>
            <a class="featured-project-mobile-repository" href="${escapeAttr(project.github_url)}" target="_blank" rel="noreferrer">${escapeHtml(project.repository)}</a>
            <p class="featured-project-mobile-description">${escapeHtml(project.description)}</p>
            <p class="featured-project-mobile-meta">${escapeHtml(project.language)} <span aria-hidden="true">·</span> ${escapeHtml(project.license)} <span aria-hidden="true">·</span> ${escapeHtml(project.status)}</p>
            <p class="featured-project-mobile-push">Last push <span aria-hidden="true">·</span> ${escapeHtml(project.lastPush)}</p>
            <a class="featured-project-mobile-link" href="${escapeAttr(project.github_url)}" target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">→</span></a>`;
}

function renderOpenSourceStats(stats) {
  const types = Array.isArray(stats.mainContributionTypes)
    ? stats.mainContributionTypes.map(escapeHtml).join(" <span aria-hidden=\"true\">·</span> ")
    : "";

  return `            <h2 class="open-source-stats-kicker">OPEN SOURCE STATISTICS</h2>
            <dl class="open-source-stats-list">
              <div><dt>${escapeHtml(stats.mergedPullRequests)}</dt><dd>Merged Pull Requests</dd></div>
              <div><dt>${escapeHtml(stats.repositoriesContributedTo)}</dt><dd>Repositories contributed to</dd></div>
              <div><dt>${escapeHtml(stats.mostActiveProject)}</dt><dd>Most active project</dd></div>
            </dl>
            <p class="open-source-stats-label">Main contribution types</p>
            <p class="open-source-stats-types">${types}</p>`;
}

function statusClassName(status) {
  const value = status.toLowerCase();
  if (value.includes("merged")) return "merged";
  if (value.includes("live")) return "live";
  if (value.includes("pushed")) return "pushed";
  return "";
}

function tidyTitle(value) {
  return String(value)
    .split("\n")[0]
    .replace(/^fix[:/ -]*/i, "")
    .replace(/^update[:/ -]*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 72);
}

function titleFromBranch(ref) {
  if (!ref) return "";
  return String(ref)
    .replace(/^refs\/heads\//, "")
    .split("/")
    .at(-1)
    .replace(/[-_]+/g, " ");
}

export function relativeDate(value, now = new Date()) {
  const created = new Date(value);
  if (Number.isNaN(created.getTime())) return "";

  const diffMinutes = Math.floor(Math.max(0, now.getTime() - created.getTime()) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;

  if (diffHours < 48) return "yesterday";

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `${diffDays} days ago`;

  return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeFallbackTime(value) {
  const time = String(value || "").trim();
  if (!time || time === "today" || time === "now") return "just now";
  if (time === "yesterday" || time === "just now") return time;

  const hourMatch = time.match(/^(\d+)\s*h ago$/i);
  if (hourMatch) return `${hourMatch[1]} h ago`;

  const dayMatch = time.match(/^(\d+)\s*d ago$/i);
  if (dayMatch) return `${dayMatch[1]} days ago`;

  return time;
}

function validTimestamp(value) {
  const timestamp = String(value || "").trim();
  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
}

function isOwnRepo(repo) {
  const [owner] = String(repo || "").split("/");
  return OWN_REPOSITORY_OWNERS.has(owner);
}

async function forkUpstreamFor(repo) {
  if (!isOwnRepo(repo)) return null;
  if (forkUpstreamCache.has(repo)) return forkUpstreamCache.get(repo);

  try {
    const metadata = await fetchGitHubJson(`https://api.github.com/repos/${repo}`);
    const upstream = metadata.fork
      ? metadata.parent?.full_name || metadata.source?.full_name || null
      : null;
    forkUpstreamCache.set(repo, upstream);
    return upstream;
  } catch {
    forkUpstreamCache.set(repo, null);
    return null;
  }
}

function isExcludedRepository(repo) {
  return EXCLUDED_REPOSITORIES.has(repo);
}

function repoUrl(repo) {
  return `https://github.com/${repo}`;
}

function prUrl(repo, number) {
  return `${repoUrl(repo)}/pull/${number}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(`live-feed: ${error.message}`);
      process.exit(1);
    });
}

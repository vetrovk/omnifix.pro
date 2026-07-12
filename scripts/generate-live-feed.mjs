import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const USER = "vetrovk";
const MAX_ITEMS = 5;
const EVENTS_URL = `https://api.github.com/users/${USER}/events/public`;
const REPO_PRIORITY = new Map([
  ["sqlfluff/sqlfluff", 100],
  ["FOSSBilling/FOSSBilling", 94],
  ["gchq/CyberChef", 92],
  ["vetrovk/omnifix.pro", 86],
  ["vetrovk/oracle-bot", 84],
]);
const FALLBACK_PATH = "data/live-feed-fallback.json";
const OUTPUT_PATH = "data/live-feed.json";
const HTML_PATH = "index.html";
const START_MARKER = "<!-- live-feed:start -->";
const END_MARKER = "<!-- live-feed:end -->";

async function main() {
  const fallback = await readJson(FALLBACK_PATH);
  const { items, source } = await loadFeed(fallback);
  const normalized = normalizeFeed(items);

  await writeFile(OUTPUT_PATH, `${JSON.stringify(normalized, null, 2)}\n`);
  await updateHtml(normalized);

  console.log(`live-feed: wrote ${normalized.length} ${source} item(s)`);
}

async function loadFeed(fallback) {
  try {
    const events = await fetchGitHubJson(EVENTS_URL);
    const items = await buildFeed(events);
    if (!items.length) {
      return { items: fallback, source: "fallback" };
    }
    return { items, source: "github" };
  } catch (error) {
    console.warn(`live-feed: using fallback (${error.message})`);
    return { items: fallback, source: "fallback" };
  }
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
    .then((items) => selectFeedItems(items.filter(Boolean)));
}

function selectFeedItems(items) {
  const unique = uniqueBy(items.sort(compareItems), feedIdentityKey);
  const merged = unique.filter((item) => item.status === "PR merged" && !isOwnRepo(item.source));
  const opened = unique.filter((item) => item.status === "PR opened" && !isOwnRepo(item.source));
  const projectPushes = unique.filter((item) => item.status === "pushed" && isOwnRepo(item.source));
  const rest = unique.filter((item) => !merged.includes(item) && !projectPushes.includes(item));

  return uniqueBy([
    ...merged.slice(0, 2),
    ...projectPushes.slice(0, 1),
    ...opened.slice(0, 1),
    ...rest,
  ], feedIdentityKey)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_ITEMS);
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
  if (!event?.repo?.name || !event?.created_at) return null;

  if (event.type === "PullRequestEvent") {
    return pullRequestEventToItem(event);
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
    type: isOwnRepo(event.repo.name) ? "project" : "open-source",
    _score: priorityFor(event.repo.name, merged ? 100 : 70),
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

function pushEventToItem(event) {
  const commits = event.payload?.commits || [];
  const head = event.payload?.head;
  const message = commits.at(-1)?.message || titleFromBranch(event.payload?.ref) || "repository updated";
  const description = event.repo.name === "vetrovk/omnifix.pro"
    ? "Static site build updated"
    : tidyTitle(message);

  return {
    source: event.repo.name,
    description,
    status: "pushed",
    url: repoUrl(event.repo.name),
    statusUrl: head ? `${repoUrl(event.repo.name)}/commit/${head}` : repoUrl(event.repo.name),
    timestamp: event.created_at,
    type: isOwnRepo(event.repo.name) ? "project" : "open-source",
    _score: priorityFor(event.repo.name, 58),
  };
}

function compareItems(a, b) {
  if (b._score !== a._score) return b._score - a._score;
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

function priorityFor(repo, base) {
  return base + (REPO_PRIORITY.get(repo) || 0);
}

function normalizeFeed(items) {
  return items.slice(0, MAX_ITEMS).map(({ _score, ...item }) => {
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
      type: item.type,
    };
  });
}

async function updateHtml(items) {
  const html = await readFile(HTML_PATH, "utf8");
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("live-feed markers not found in index.html");
  }

  const rendered = items.length ? items.map(renderFeedRow).join("\n") : renderEmptyFeedRow();
  const nextHtml = `${html.slice(0, start + START_MARKER.length)}\n${rendered}\n            ${html.slice(end)}`;
  await writeFile(HTML_PATH, nextHtml);
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
  return repo.startsWith(`${USER}/`);
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

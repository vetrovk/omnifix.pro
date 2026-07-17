import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TRAFFIC_PATH = "data/site-traffic.json";
const HTML_PATH = "index.html";
const PAGE_VIEWS_START_MARKER = "<!-- page-views:start -->";
const PAGE_VIEWS_END_MARKER = "<!-- page-views:end -->";
const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const SITE_HOST = "omnifix.pro";

async function main() {
  const savedState = await readJson(TRAFFIC_PATH);
  const now = new Date();
  const credentialsAvailable = Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
  const fetchPageViews = credentialsAvailable
    ? (period) => fetchCloudflarePageViews(period, process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ZONE_ID)
    : undefined;
  const { state, source } = await updateTrafficState(savedState, now, fetchPageViews);

  if (JSON.stringify(state) !== JSON.stringify(savedState)) {
    await writeFile(TRAFFIC_PATH, `${JSON.stringify(state, null, 2)}\n`);
  }

  await updateHtml(state.pageViews);

  const reason = credentialsAvailable ? source : "credentials unavailable";
  console.log(`site-traffic: ${reason}; page views ${formatPageViews(state.pageViews)}`);
}

export async function updateTrafficState(savedState, now, fetchPageViews) {
  const state = normalizeTrafficState(savedState);
  const period = nextUnprocessedPeriod(state, now);

  if (!period) {
    return { state: savedState, source: state.pageViews > 0 ? "saved" : "initial" };
  }

  if (!fetchPageViews) {
    return { state: savedState, source: state.pageViews > 0 ? "saved" : "initial" };
  }

  try {
    const pageViews = await fetchPageViews(period);
    if (!Number.isSafeInteger(pageViews) || pageViews < 0) {
      throw new Error("Cloudflare returned an invalid aggregate count");
    }

    const nextPageViews = Math.max(state.pageViews, state.pageViews + pageViews);
    return {
      state: {
        ...state,
        pageViews: nextPageViews,
        lastUpdatedAt: now.toISOString(),
        lastProcessedPeriod: period.lastProcessedPeriod,
      },
      source: "fresh",
    };
  } catch (error) {
    console.warn(`site-traffic: keeping saved value (${error.message})`);
    return { state: savedState, source: state.pageViews > 0 ? "saved" : "initial" };
  }
}

function normalizeTrafficState(savedState) {
  const pageViews = Number(savedState?.pageViews);
  if (!Number.isSafeInteger(pageViews) || pageViews < 0) {
    throw new Error("site-traffic: pageViews must be a non-negative integer");
  }

  const countingStartedAt = new Date(savedState.countingStartedAt);
  if (!Number.isFinite(countingStartedAt.getTime())) {
    throw new Error("site-traffic: countingStartedAt must be a valid ISO timestamp");
  }

  return { ...savedState, pageViews };
}

function nextUnprocessedPeriod(state, now) {
  const end = startOfUtcDay(now);
  const start = state.lastProcessedPeriod
    ? addUtcDays(new Date(`${state.lastProcessedPeriod}T00:00:00Z`), 1)
    : startOfUtcDay(new Date(state.countingStartedAt));

  if (start >= end) {
    return null;
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    lastProcessedPeriod: toUtcDate(addUtcDays(end, -1)),
  };
}

async function fetchCloudflarePageViews(period, token, zoneId) {
  const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `query HomepagePageViews($zoneTag: string, $start: Time, $end: Time) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            homepage: httpRequestsAdaptiveGroups(
              limit: 1
              filter: {
                datetime_geq: $start
                datetime_lt: $end
                requestSource: "eyeball"
                clientRequestHTTPHost: "${SITE_HOST}"
                clientRequestPath: "/"
                edgeResponseStatus_geq: 200
                edgeResponseStatus_lt: 400
              }
            ) {
              count
            }
          }
        }
      }`,
      variables: {
        zoneTag: zoneId,
        start: period.start,
        end: period.end,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare analytics request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`Cloudflare GraphQL errors: ${formatGraphQLErrors(payload.errors, [token, zoneId])}`);
  }

  const groups = payload.data?.viewer?.zones?.[0]?.homepage;
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("Cloudflare analytics returned no aggregate data");
  }

  const count = groups.reduce((total, group) => total + group.count, 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Cloudflare analytics returned an invalid aggregate count");
  }

  return count;
}

export function formatGraphQLErrors(errors, secrets = []) {
  return errors
    .map((error) => {
      const code = error.extensions?.code ? ` [${String(error.extensions.code)}]` : "";
      return `${sanitizeGraphQLErrorMessage(error.message, secrets)}${code}`;
    })
    .join("; ");
}

function sanitizeGraphQLErrorMessage(message, secrets) {
  let sanitized = String(message);

  for (const secret of secrets) {
    if (secret) {
      sanitized = sanitized.replaceAll(secret, "[redacted]");
    }
  }

  return sanitized.replace(/\b[a-f0-9]{32}\b/gi, "[redacted-zone-id]");
}

async function updateHtml(pageViews) {
  const html = await readFile(HTML_PATH, "utf8");
  const counter = `PAGE VIEWS · ${formatPageViews(pageViews)}`;
  const start = html.indexOf(PAGE_VIEWS_START_MARKER);
  const end = html.indexOf(PAGE_VIEWS_END_MARKER);

  if (start === -1 || end === -1 || end < start) {
    throw new Error("site-traffic: page view markers are missing from index.html");
  }

  const rendered = `${PAGE_VIEWS_START_MARKER}\n          ${counter}\n          ${PAGE_VIEWS_END_MARKER}`;
  const updated = `${html.slice(0, start)}${rendered}${html.slice(end + PAGE_VIEWS_END_MARKER.length)}`;
  await writeFile(HTML_PATH, updated);
}

function formatPageViews(pageViews) {
  return new Intl.NumberFormat("en-US").format(pageViews);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`site-traffic: ${error.message}`);
    process.exit(1);
  });
}

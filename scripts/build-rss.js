// scripts/build-rss.js
// Builds docs/rss.xml from your GIPHY channel, publishing at most 100 *new* GIFs per run.
// State is tracked in docs/feed-state.json to continue where we left off.

import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import fetch from "node-fetch";

const API_KEY = process.env.GIPHY_API_KEY;
const USERNAME = process.env.GIPHY_USERNAME; // your verified GIPHY username, e.g. "drop_team"
const SITE_BASE = process.env.SITE_BASE || "https://xrp-drop.com";

// ---- safety checks
if (!API_KEY || !USERNAME) {
  console.error("Missing GIPHY_API_KEY or GIPHY_USERNAME env vars.");
  process.exit(1);
}

// ---- paths
const DOCS_DIR = "docs";
const RSS_PATH = path.join(DOCS_DIR, "rss.xml");
const STATE_PATH = path.join(DOCS_DIR, "feed-state.json");

// ---- config
const MAX_NEW_PER_RUN = 100;   // publish at most 100 new items each run
const MAX_PAGES = 50;          // just a hard stop so we don't loop forever
const PAGE_SIZE = 50;          // GIPHY often caps at 50; we'll page until we get enough

// --- utilities
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function loadState() {
  if (!existsSync(STATE_PATH)) {
    return { seenIds: [] };
  }
  try {
    const txt = await readFile(STATE_PATH, "utf-8");
    const json = JSON.parse(txt);
    if (!Array.isArray(json.seenIds)) json.seenIds = [];
    return json;
  } catch {
    return { seenIds: [] };
  }
}

async function saveState(state) {
  // Keep the seen list from growing forever
  const pruned = { seenIds: state.seenIds.slice(-10000) };
  await writeFile(STATE_PATH, JSON.stringify(pruned, null, 2), "utf-8");
}

function toRfc2822(d) {
  return new Date(d).toUTCString();
}

function itemXml({ id, title, gifUrl, siteLink, publishedAt }) {
  // Pinterest reads <title>, <description>, <link>, and <enclosure type="image/gif">
  return `
  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteLink)}</link>
    <description>DROP official GIF • ID ${escapeXml(id)}</description>
    <enclosure url="${escapeXml(gifUrl)}" type="image/gif"/>
    <guid isPermaLink="false">${escapeXml(id)}</guid>
    <pubDate>${toRfc2822(publishedAt)}</pubDate>
  </item>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Try to fetch recent GIFs *from your channel*.
 * We try two methods to be robust:
 *  1) search with channel=USERNAME (works for verified channels)
 *  2) fallback: search broadly & filter results where gif.user?.username === USERNAME
 */
async function fetchRecentIds(limitTotal) {
  const collected = [];
  let offset = 0;
  let page = 0;

  while (collected.length < limitTotal && page < MAX_PAGES) {
    // preferred attempt: channel filter (if supported server-side)
    let url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(API_KEY)}&channel=${encodeURIComponent(
      USERNAME
    )}&sort=recent&limit=${PAGE_SIZE}&offset=${offset}`;

    let data = await tryFetch(url);

    // fallback path: if nothing comes back, try a broad recent search and filter by user.username
    if (!data?.data?.length) {
      const alt = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
        API_KEY
      )}&q=${encodeURIComponent(
        USERNAME
      )}&sort=recent&limit=${PAGE_SIZE}&offset=${offset}`;
      data = await tryFetch(alt);
    }

    const list = (data?.data || []).filter(
      (g) => g?.user?.username?.toLowerCase() === USERNAME.toLowerCase()
    );

    for (const g of list) {
      if (collected.length >= limitTotal) break;
      collected.push(g);
    }

    if (!data?.pagination) break;
    const count = data.pagination.count || list.length;
    if (!count) break;

    offset += data.pagination.count || PAGE_SIZE;
    page += 1;

    // tiny pause to be polite to the API
    await sleep(150);
  }

  return collected;
}

async function tryFetch(url) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GIPHY API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  await mkdir(DOCS_DIR, { recursive: true });

  // 1) read state (IDs we've already published)
  const state = await loadState();
  const seen = new Set(state.seenIds);

  // 2) pull *up to* (seen gap + 100) recent gifs so we can filter out already-seen
  //    We'll just ask for a generous chunk (e.g., 1000 max) but capped by paging loop.
  const wantNew = MAX_NEW_PER_RUN;
  const wantTotal = Math.max(wantNew * 5, wantNew); // a little extra to safely filter duplicates

  const recent = await fetchRecentIds(wantTotal);

  // 3) filter out IDs we've already published
  const fresh = recent.filter((g) => !seen.has(g.id));

  // 4) take only up to 100 new ones this run
  const take = fresh.slice(0, MAX_NEW_PER_RUN);

  // If for some reason there are no brand-new ones, we can publish the newest slice anyway (keeps feed fresh)
  const items = (take.length ? take : recent.slice(0, MAX_NEW_PER_RUN)).map((g) => {
    const id = g.id;
    const title = (g.title || "DROP GIF").trim() || "DROP GIF";
    const gifUrl = g.images?.original?.url || g.url; // API usually provides .images.original.url
    const siteLink = `${SITE_BASE}/gifs?g=${encodeURIComponent(id)}`;
    const publishedAt = g.import_datetime && g.import_datetime !== "1970-01-01 00:00:00"
      ? g.import_datetime
      : g.trending_datetime && g.trending_datetime !== "1970-01-01 00:00:00"
        ? g.trending_datetime
        : new Date().toISOString();

    return { id, title, gifUrl, siteLink, publishedAt };
  });

  // 5) update state with any *new* IDs we just published
  for (const it of take) {
    seen.add(it.id);
  }
  await saveState({ seenIds: Array.from(seen) });

  // 6) build RSS XML
  const now = new Date().toUTCString();
  const channelTitle = "DROP Official GIPHY Feed";
  const channelLink = SITE_BASE;
  const channelDesc = "DROP GIFs auto

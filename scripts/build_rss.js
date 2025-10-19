/* Build rss.xml for Pinterest Auto-publish
 * - Outputs: docs/rss.xml
 * - State   : docs/state.json (tracks 100/day cap, seen IDs)
 * - Optional GIPHY auto-discovery if GIPHY_USERNAME + GIPHY_API_KEY envs are set
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------- constants / env ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DOCS_DIR   = path.join(__dirname, "..", "docs");
const STATE_FILE = path.join(DOCS_DIR, "state.json");
const FEED_FILE  = path.join(DOCS_DIR, "rss.xml");

// Site/feed metadata
const SITE_URL   = process.env.SITE_URL   || "https://xrp-drop.com";
const FEED_TITLE = process.env.FEED_TITLE || "DROP Official GIPHY Feed";
const FEED_DESC  = process.env.FEED_DESC  || "DROP GIFs auto-published to Pinterest";

// Daily cap (string env -> number)
const DAILY_LIMIT = Math.max(1, Number(process.env.DAILY_LIMIT || "100"));

// Optional GIPHY auto-discovery
const GIPHY_USERNAME = (process.env.GIPHY_USERNAME || "").trim();
const GIPHY_API_KEY  = (process.env.GIPHY_API_KEY  || "").trim();

// Local fallback list (optional) if you don't use the API.
// Put one GIF ID per line in data/ids.txt (not required).
const LOCAL_IDS_FILE = path.join(__dirname, "..", "data", "ids.txt");

// ---------- helpers ----------
function todayStr() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function rfc822(date) {
  return new Date(date).toUTCString();
}

function ensureDirs() {
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
}

function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { day: todayStr(), publishedToday: 0, seen: [] };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { day: todayStr(), publishedToday: 0, seen: [] };
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadLocalIds() {
  if (!existsSync(LOCAL_IDS_FILE)) return [];
  const raw = readFileSync(LOCAL_IDS_FILE, "utf8");
  return raw
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Build a media URL that works for enclosures.
// Using media.giphy.com is stable and redirects to the right CDN host.
function mediaUrl(id) {
  return `https://media.giphy.com/media/${id}/giphy.gif`;
}

// Create a nice on-site link that lives on your domain.
function siteLink(id) {
  return `${SITE_URL.replace(/\/+$/,"")}/gifs?g=${encodeURIComponent(id)}`;
}

// ---------- GIPHY auto-discovery (optional) ----------
async function fetchNewestIdsFromGiphy(maxToFetch = 200) {
  if (!GIPHY_USERNAME || !GIPHY_API_KEY) return [];

  const ids = [];
  // Strategy: call "search" with empty query and sort by recent uploads.
  // (GIPHY’s public API is limited; this pattern generally returns newest for a user.)
  // If your account name contains spaces/case, use the exact GIPHY username.
  const pageSize = 50;
  for (let offset = 0; offset < maxToFetch; offset += pageSize) {
    const url =
      `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_API_KEY)}` +
      `&q=&limit=${pageSize}&offset=${offset}&sort=recent&username=${encodeURIComponent(GIPHY_USERNAME)}`;

    const res = await fetch(url);
    if (!res.ok) break;
    const json = await res.json();
    if (!json || !Array.isArray(json.data) || json.data.length === 0) break;

    for (const it of json.data) {
      if (it && it.id) ids.push(it.id);
    }
    if (json.data.length < pageSize) break; // done
  }

  // Remove dups, keep order
  return Array.from(new Set(ids));
}

// ---------- MAIN ----------
(async function main() {
  ensureDirs();

  // Load daily state
  const state = loadState();
  const today = todayStr();
  if (state.day !== today) {
    state.day = today;
    state.publishedToday = 0;
  }
  state.seen ||= [];

  // 1) Collect candidate IDs (prefer API if creds provided; else fall back to local list)
  let candidateIds = [];
  try {
    const apiIds = await fetchNewestIdsFromGiphy(500);
    if (apiIds.length) {
      candidateIds = apiIds;
    } else {
      candidateIds = loadLocalIds();
    }
  } catch {
    candidateIds = loadLocalIds();
  }

  // 2) Filter out ones we’ve already seen, and honor the 100/day cap
  const newIds = candidateIds.filter(id => !state.seen.includes(id));
  const slots = Math.max(0, DAILY_LIMIT - state.publishedToday);
  const take = newIds.slice(0, slots);

  // 3) Update state
  if (take.length) {
    state.publishedToday += take.length;
    state.seen.push(...take);
    // Also keep state.seen from growing unbounded (trim oldest if > 100k)
    if (state.seen.length > 100000) {
      state.seen = state.seen.slice(-80000);
    }
  }

  // 4) Build the feed items = newest first (use *all seen*, but the most recent at top)
  // If you want to cap total feed size, change MAX_FEED_ITEMS.
  const MAX_FEED_ITEMS = 2000;
  const feedIds = state.seen.slice(-MAX_FEED_ITEMS).reverse();

  const now = new Date();
  const lastBuild = rfc822(now);

  let itemsXml = "";
  for (const id of feedIds) {
    itemsXml +=
`  <item>
    <title>Drop Xrp GIF by $DROP</title>
    <link>${siteLink(id)}</link>
    <description>DROP official GIF • ID ${id}</description>
    <enclosure url="${mediaUrl(id)}" type="image/gif"/>
    <guid isPermaLink="false">${id}</guid>
    <pubDate>${rfc822(now)}</pubDate>
  </item>
`;
  }

  const rss =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${FEED_TITLE}</title>
  <link>${SITE_URL}</link>
  <description>${FEED_DESC}</description>
  <lastBuildDate>${lastBuild}</lastBuildDate>
${itemsXml}</channel>
</rss>
`;

  writeFileSync(FEED_FILE, rss, "utf8");
  saveState(state);

  console.log(`Built ${FEED_FILE}`);
  console.log(`Today used: ${state.publishedToday}/${DAILY_LIMIT}. Total items in feed: ${feedIds.length}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

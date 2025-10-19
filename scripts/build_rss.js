// Auto-build Pinterest RSS from GIPHY uploads/search
// Output: docs/rss.xml  (served by GitHub Pages)

// ---- CONFIG ----
const SITE = "https://xrp-drop.com";                         // your claimed domain
const LINK_TEMPLATE = (id, slug) => `${SITE}/gifs?g=${id}`;  // single landing page with query
const CHANNEL_QUERIES = [
  // Put a few broad queries that catch your GIFs (add/remove freely)
  "Drop Andy", "Drop Meme", "DROP XRPL", "xrp drop", "drop raindrop"
];
// If you know your GIPHY username, add it here to bias results in titles/descriptions:
const BRAND = "DROP";
// How many GIFs to include in the feed (Pinterest can handle large feeds; keep it sane)
const LIMIT = 100;

// ---- CODE ----
import fs from "fs";
import fetch from "node-fetch";

// GIPHY API pieces
const API_KEY = process.env.GIPHY_API_KEY; // <-- add in GitHub Secrets
const BASE = "https://api.giphy.com/v1/gifs/search";

if (!API_KEY) {
  console.error("Missing GIPHY_API_KEY env var");
  process.exit(1);
}

function rssDate(d = new Date()) {
  return d.toUTCString(); // RFC-822-ish ok for RSS
}

function makeItem({ id, title = "", gifUrl, pubDate }) {
  const cleanTitle = title || `${BRAND} GIF ${id}`;
  const link = LINK_TEMPLATE(id, "");
  const guid = id;
  const desc = `${BRAND} official GIF • ID ${id}`;
  return `
    <item>
      <title>${escapeXml(cleanTitle)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(desc)}</description>
      <enclosure url="${escapeXml(gifUrl)}" type="image/gif"/>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${rssDate(pubDate)}</pubDate>
    </item>`;
}

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function fetchSearch(q, limit = 50, offset = 0) {
  const url = new URL(BASE);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", "recent");
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`GIPHY search failed: ${r.status}`);
  const j = await r.json();
  return j.data || [];
}

function toGifUrl(obj) {
  // Most reliable direct GIF url
  // Prefer images.original or images.downsized if needed
  const o = obj?.images?.original?.url || obj?.images?.downsized?.url;
  if (o) return o;
  // fallback to canonical media pattern
  return `https://media.giphy.com/media/${obj.id}/giphy.gif`;
}

async function main() {
  // Pull batches from multiple queries, merge & de-dupe by ID
  const seen = new Map(); // id -> gifObject
  for (const q of CHANNEL_QUERIES) {
    // Pull first 50 recent per query; adjust if needed
    const batch = await fetchSearch(q, 50, 0);
    for (const g of batch) if (!seen.has(g.id)) seen.set(g.id, g);
    if (seen.size >= LIMIT) break;
  }

  const items = Array.from(seen.values())
    .slice(0, LIMIT)
    .map(g => {
      const gifUrl = toGifUrl(g);
      const title = g.title || g.slug || `${BRAND} GIF`;
      const ts = g.import_datetime && g.import_datetime !== "1970-01-01 00:00:00" ? new Date(g.import_datetime) : new Date();
      return makeItem({ id: g.id, title, gifUrl, pubDate: ts });
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(BRAND)} Official GIPHY Feed</title>
    <link>${escapeXml(SITE)}</link>
    <description>${escapeXml(BRAND)} GIFs auto-published to Pinterest</description>
    <lastBuildDate>${rssDate()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  if (!fs.existsSync("docs")) fs.mkdirSync("docs");
  fs.writeFileSync("docs/rss.xml", xml, "utf8");
  console.log(`Wrote docs/rss.xml with ${seen.size > LIMIT ? LIMIT : seen.size} items`);
}

await main().catch(e => {
  console.error(e);
  process.exit(1);
});

// scripts/build-rss.cjs
// Uses Node 18+ global fetch (no imports needed)

const fs = require("fs");

const GIPHY_USERNAME = "DROP-Team-xrp-ripple-xrpl";   // your Giphy username
const OUTPUT_FILE = "docs/rss.xml";
const MAX_ITEMS = 100;

// Escape XML special chars
const xmlEscape = (s = "") =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&apos;");

async function fetchGifs() {
  // Public beta key works for simple searches
  const url =
    "https://api.giphy.com/v1/gifs/search" +
    `?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(GIPHY_USERNAME)}` +
    `&limit=${MAX_ITEMS}&rating=g&sort=recent`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(g => ({
    id: g.id,
    title: g.title || "Memecoin XRP GIF by $DROP",
    mediaUrl: g.images?.original?.url || "",
    pubDate: new Date(g.import_datetime || Date.now()).toUTCString(),
  }));
}

async function build() {
  const gifs = await fetchGifs();

  const items = gifs.map(g => {
    const link = `https://xrp-drop.com/gifs/${g.id}`; // <- your claimed domain
    const enclosureUrl = xmlEscape(g.mediaUrl);       // escape & in query
    return `
    <item>
      <title><![CDATA[${g.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <enclosure url="${enclosureUrl}" length="0" type="image/gif"/>
      <pubDate>${g.pubDate}</pubDate>
    </item>`;
  }).join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>DROP Official GIPHY Feed</title>
    <link>https://xrp-drop.com</link>
    <description>DROP GIFs auto-published to Pinterest (100 per day).</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://feed.xrp-drop.com/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  fs.writeFileSync(OUTPUT_FILE, rss, "utf8");
  console.log(`✅ Wrote ${gifs.length} items → ${OUTPUT_FILE}`);
}

build().catch(err => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});

// scripts/build-rss.js
// Auto-builds an RSS feed from your latest GIPHY uploads.
// Designed for DROP_Team account – 100 GIFs per day (Pinterest compatible)

import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.GIPHY_API_KEY;
const USERNAME = process.env.GIPHY_USERNAME || "DROP_Team";

const RSS_PATH = "docs/rss.xml";
const GIPHY_URL = `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&username=${USERNAME}&limit=100&offset=0&sort=recent`;

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchGifs() {
  console.log(`📡 Fetching latest GIFs for user: ${USERNAME}`);
  const response = await fetch(GIPHY_URL);
  if (!response.ok) throw new Error(`GIPHY API error: ${response.status}`);
  const data = await response.json();
  return data.data || [];
}

function buildRss(gifs) {
  console.log(`🧩 Building RSS feed with ${gifs.length} GIFs...`);
  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  rss += `<rss version="2.0">\n<channel>\n`;
  rss += `<title>DROP Official GIPHY Feed</title>\n`;
  rss += `<link>https://xrp-drop.com</link>\n`;
  rss += `<description>DROP GIFs auto-published to Pinterest (100 new per day).</description>\n`;
  rss += `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  for (const gif of gifs) {
    const title = escapeXml(gif.title || "DROP GIF");
    const gifUrl = escapeXml(gif.url || "");
    const imageUrl = escapeXml(gif.images?.original?.url || "");

    rss += `<item>\n`;
    rss += `  <title><![CDATA[${title}]]></title>\n`;
    rss += `  <link>${gifUrl}</link>\n`;
    rss += `  <guid>${gif.id}</guid>\n`;
    rss += `  <enclosure url="${imageUrl}" type="image/gif" />\n`;
    rss += `  <pubDate>${new Date().toUTCString()}</pubDate>\n`;
    rss += `</item>\n`;
  }

  rss += `</channel>\n</rss>`;
  fs.writeFileSync(RSS_PATH, rss, "utf8");
  console.log(`✅ RSS written to ${RSS_PATH}`);
}

(async () => {
  try {
    const gifs = await fetchGifs();
    if (!gifs.length) {
      console.warn("⚠️ No GIFs returned. Check username or key.");
      return;
    }
    buildRss(gifs);
  } catch (error) {
    console.error("❌ Failed to build RSS:", error);
    process.exit(1);
  }
})();

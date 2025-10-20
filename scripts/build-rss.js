// scripts/build-rss.js
const fs = require("fs");
const fetch = require("node-fetch");

// 🔧 CHANGE THIS to your actual Giphy username:
const GIPHY_USERNAME = "DROP-Team-xrp-ripple-xrpl";
const GIPHY_API_KEY = "dc6zaTOxFJmzC"; // public beta key (safe to use)
const OUTPUT_FILE = "docs/rss.xml";
const MAX_ITEMS = 100;

// Function to escape XML characters
const xmlEscape = (str) =>
  str
    ? str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
    : "";

// Fetch the user’s GIFs from Giphy
async function fetchGifs() {
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
    GIPHY_USERNAME
  )}&limit=${MAX_ITEMS}&rating=g`;
  const res = await fetch(url);
  const data = await res.json();
  return data.data.map((gif) => ({
    id: gif.id,
    title: gif.title || "Memecoin XRP GIF by $DROP",
    gifUrl: gif.images.original.url,
    publishedAt: new Date(gif.import_datetime).toUTCString(),
  }));
}

async function buildRSS() {
  const gifs = await fetchGifs();

  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  rss += `<rss version="2.0">\n<channel>\n`;
  rss += `<title>$DROP Official GIPHY Feed</title>\n`;
  rss += `<link>https://xrp-drop.com</link>\n`;
  rss += `<description>$DROP GIFs auto-published to Pinterest (100 new per day).</description>\n`;
  rss += `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  gifs.forEach((gif) => {
    const link = `https://xrp-drop.com/gifs/${gif.id}`;
    rss += `<item>\n`;
    rss += `  <title><![CDATA[${gif.title}]]></title>\n`;
    rss += `  <link>${link}</link>\n`;
    rss += `  <guid>${link}</guid>\n`;
    rss += `  <enclosure url="${gif.gifUrl}" type="image/gif"/>\n`;
    rss += `  <pubDate>${gif.publishedAt}</pubDate>\n`;
    rss += `</item>\n`;
  });

  rss += `</channel>\n</rss>`;

  fs.writeFileSync(OUTPUT_FILE, rss, "utf8");
  console.log(`✅ RSS feed generated successfully with ${gifs.length} items`);
}

buildRSS().catch((err) => {
  console.error("❌ Failed to build RSS:", err);
  process.exit(1);
});

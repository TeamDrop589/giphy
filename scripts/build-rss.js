import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.GIPHY_API_KEY;
const USERNAME = process.env.GIPHY_USERNAME;

const RSS_PATH = "docs/rss.xml";

// Giphy API URL – fetch latest 100 uploaded GIFs for this username
const url = `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&username=${USERNAME}&limit=100&offset=0`;

async function fetchGifs() {
  console.log(`🔍 Fetching latest GIFs from GIPHY user: ${USERNAME}`);
  const response = await fetch(url);
  const data = await response.json();

  if (!data || !data.data || data.data.length === 0) {
    console.warn("⚠️ No GIFs returned from GIPHY API. Check API key or username.");
    return [];
  }

  console.log(`✅ Retrieved ${data.data.length} GIFs from GIPHY.`);
  return data.data;
}

function buildRss(items) {
  console.log(`🧩 Building RSS feed with ${items.length} items...`);

  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  rss += `<rss version="2.0">\n<channel>\n`;
  rss += `<title>DROP Official GIPHY Feed</title>\n`;
  rss += `<link>https://xrp-drop.com</link>\n`;
  rss += `<description>DROP GIFs auto-published to Pinterest (100 new per day)</description>\n`;
  rss += `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  for (const gif of items) {
    const title = gif.title || "DROP GIF";
    const gifUrl = gif.url || "";
    const imageUrl = gif.images?.original?.url || "";

    rss += `<item>\n`;
    rss += `<title><![CDATA[${title}]]></title>\n`;
    rss += `<link>${gifUrl}</link>\n`;
    rss += `<guid>${gifUrl}</guid>\n`;
    rss += `<enclosure url="${imageUrl}" type="image/gif" />\n`;
    rss += `</item>\n`;
  }

  rss += `</channel>\n</rss>`;

  fs.writeFileSync(RSS_PATH, rss);
  console.log(`✅ RSS feed written successfully to ${RSS_PATH}`);
}

(async () => {
  try {
    const gifs = await fetchGifs();
    if (gifs.length > 0) {
      buildRss(gifs);
    } else {
      console.log("⚠️ No items to build RSS from.");
    }
  } catch (error) {
    console.error("❌ Error generating RSS:", error);
    process.exit(1);
  }
})();

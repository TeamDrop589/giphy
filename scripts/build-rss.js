import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.GIPHY_API_KEY;
const USERNAME = process.env.GIPHY_USERNAME;

const RSS_PATH = "docs/rss.xml";
const STATE_PATH = "docs/feed-state.json";

async function fetchGifs() {
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=${USERNAME}&limit=100&offset=0`;
  const res = await fetch(url);
  const data = await res.json();

  console.log("DEBUG: Giphy API response count =", data?.data?.length || 0);
  return data.data || [];
}

function buildRss(items) {
  let rss = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  rss += `<rss version="2.0">\n<channel>\n`;
  rss += `<title>DROP Official GIPHY Feed</title>\n`;
  rss += `<link>https://xrp-drop.com</link>\n`;
  rss += `<description>DROP GIFs auto-published to Pinterest (100 per day)</description>\n`;

  for (const gif of items) {
    rss += `<item>\n`;
    rss += `<title>${gif.title || "DROP GIF"}</title>\n`;
    rss += `<link>${gif.url}</link>\n`;
    if (gif.images?.original?.url) {
      rss += `<enclosure url="${gif.images.original.url}" type="image/gif"/>\n`;
    }
    rss += `</item>\n`;
  }

  rss += `</channel>\n</rss>`;
  fs.writeFileSync(RSS_PATH, rss);
}

(async () => {
  try {
    const gifs = await fetchGifs();
    if (gifs.length === 0) {
      console.log("⚠️ No GIFs returned. Check your API key or username.");
    } else {
      console.log(`✅ Retrieved ${gifs.length} GIFs`);
      buildRss(gifs);
      console.log("✅ RSS feed built successfully");
    }
  } catch (err) {
    console.error("❌ Error building RSS:", err);
  }
})();

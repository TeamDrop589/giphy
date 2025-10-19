// scripts/build-rss.js
import fs from "fs";
import fetch from "node-fetch";

const username = process.env.GIPHY_USERNAME;
const apiKey = process.env.GIPHY_API_KEY;
const limit = 100; // Max 100 per run

if (!username || !apiKey) {
  console.error("Missing GIPHY_USERNAME or GIPHY_API_KEY");
  process.exit(1);
}

const rssHeader = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>DROP Official GIPHY Feed</title>
<link>https://xrp-drop.com</link>
<description>DROP GIFs auto-published to Pinterest</description>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

const rssFooter = `
</channel>
</rss>
`;

const rssFile = "./docs/rss.xml";

async function buildFeed() {
  console.log(`Fetching from GIPHY for user: ${username}`);
  const response = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${username}&limit=${limit}&rating=g`
  );
  const data = await response.json();

  if (!data.data || data.data.length === 0) {
    console.log("No GIFs found for user.");
    return;
  }

  let items = "";
  for (const gif of data.data) {
    const title = gif.title || "DROP GIF";
    const url = gif.images.original.url;
    const id = gif.id;
    const link = `https://xrp-drop.com/gifs?g=${id}`;
    const pubDate = new Date(gif.import_datetime || new Date()).toUTCString();

    items += `
<item>
  <title>${title}</title>
  <link>${link}</link>
  <description>DROP official GIF • ID ${id}</description>
  <enclosure url="${url}" type="image/gif"/>
  <guid isPermaLink="false">${id}</guid>
  <pubDate>${pubDate}</pubDate>
</item>`;
  }

  const rss = rssHeader + items + rssFooter;
  fs.writeFileSync(rssFile, rss, "utf8");
  console.log(`✅ RSS built with ${data.data.length} GIFs`);
}

buildFeed().catch(err => {
  console.error("Error building RSS:", err);
  process.exit(1);
});

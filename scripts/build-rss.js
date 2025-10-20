import fs from "fs";
import fetch from "node-fetch";

const xmlEscape = (s) =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;")
   .replace(/'/g, "&apos;");

async function buildRSS() {
  const apiKey = process.env.GIPHY_API_KEY;
  const username = "DROP-Team-xrp-ripple-xrpl"; // your Giphy username
  const limit = 100;

  console.log(`Fetching latest ${limit} GIFs from Giphy...`);

  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${username}&limit=${limit}&sort=recent`
  );
  const data = await res.json();

  if (!data.data || !Array.isArray(data.data)) {
    console.error("Invalid response from Giphy:", data);
    process.exit(1);
  }

  console.log(`Fetched ${data.data.length} GIFs. Building RSS...`);

  const items = [];

  for (const gif of data.data) {
    const gifId = gif.id;
    const title = gif.title || `GIF ${gifId}`;
    const pubDate = new Date(gif.import_datetime || Date.now()).toUTCString();
    const giphyUrl = `https://giphy.com/gifs/${username}-${gifId}`;
    const redirectUrl = `https://xrp-drop.com/g/${gifId}`;
    const mediaUrl = xmlEscape(gif.images.original.url);

    items.push(`
      <item>
        <title><![CDATA[${title}]]></title>
        <link>${redirectUrl}</link>
        <guid isPermaLink="true">${redirectUrl}</guid>
        <enclosure url="${mediaUrl}" length="0" type="image/gif"/>
        <pubDate>${pubDate}</pubDate>
      </item>
    `);
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>DROP Official GIPHY Feed</title>
    <link>https://xrp-drop.com</link>
    <description>DROP GIFs auto-published to Pinterest (100 per day).</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://xrp-drop.com/rss.xml" rel="self" type="application/rss+xml"/>
    ${items.join("\n")}
  </channel>
</rss>`;

  fs.writeFileSync("docs/rss.xml", rss, "utf8");
  console.log("✅ RSS feed updated successfully → docs/rss.xml");
}

buildRSS().catch((err) => {
  console.error("Error building RSS:", err);
  process.exit(1);
});

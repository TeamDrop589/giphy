+ const xmlEscape = (s) =>
+   s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
+    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

 // inside your loop over GIFs:
- const itemLink = giphyPageUrl; // old
+ const gifId = gif.id; // e.g., 'JXsGv6GZWbqWrEeQyD'
+ const itemLink = `https://xrp-drop.com/g/${gifId}`;

- const enclosureUrl = mediaUrl; // old
+ const enclosureUrl = xmlEscape(mediaUrl); // MUST escape &

- items.push(`
-  <item>
-    <title><![CDATA[${title}]]></title>
-    <link>${giphyPageUrl}</link>
-    <guid isPermaLink="false">${gif.id}</guid>
-    <enclosure url="${mediaUrl}" type="image/gif"/>
-    <pubDate>${pubDate}</pubDate>
-  </item>`);
+ items.push(`
+  <item>
+    <title><![CDATA[${title}]]></title>
+    <link>${itemLink}</link>
+    <guid isPermaLink="true">${itemLink}</guid>
+    <enclosure url="${enclosureUrl}" length="0" type="image/gif"/>
+    <pubDate>${pubDate}</pubDate>
+  </item>`);

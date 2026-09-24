# @linkoi/core

URL and HTML metadata extraction. Developer preview, v0.1.1.

```ts
import { resolve, fromHtml, type Metadata } from '@linkoi/core'
const page = await resolve('https://example.com', {
  timeoutMs: 5000,
  maxBytes: 2_097_152,
  selfHosts: ['your-api.example.com'],
  // youtubeApiKey: process.env.YOUTUBE_API_KEY,
})
```

`resolve(input, options)` accepts a string or URL and returns `Promise<Metadata>`. Timeout is per fetch, not a total request deadline. HTML fetches follow up to five redirects and retry upstream 429s twice. Direct media documents are not supported.

`fromHtml(html, url)` always parses supplied HTML offline. The base URL must pass the URL guard. The legacy `fallback` option is ignored.

`Metadata` contains `url`, nullable `title`, `description`, `image`, `logo`, `publisher`, `author`, `date`, `lang`, and `source: 'fast' | 'fallback'`. The fast path limits titles to 200 and descriptions to 500 characters. Images are URLs, not verified image objects. The favicon fallback may point to a nonexistent file. New results always have `source: "fast"`; the legacy source union is retained for stored data compatibility.

Lower-level exports are available at `@linkoi/core/guard`, `/extract`, `/normalize`, `/fetch-html`, `/fallback`, and `/youtube`. No caching or HTTP server is created by importing core.

See the root SECURITY.md before fetching user-supplied URLs. Licensed under PolyForm Shield 1.0.0. Commercial use is allowed for non-competing purposes. See LICENSE for the exact terms.

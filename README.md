<p align="center"><img src="./brand/banner.svg" alt="Linkoi. A little more behind every link." width="100%"></p>

# Linkoi

Extract normalized metadata from a URL or supplied HTML. Use the library in your server, or deploy the included Cloudflare Worker for an HTTP API with caching.

**Developer preview, v0.1.0.** Install with `npm install @linkoi/core@0.1.0`. Source-available under PolyForm Shield 1.0.0. See [LICENSE](./LICENSE) and the [licensing notes](./docs/licensing.md).

## Packages

| Package | Purpose |
| --- | --- |
| `@linkoi/core` | Fetching, HTML extraction, normalization, YouTube metadata, and a lazy Metascraper fallback. |
| `@linkoi/worker` | Hono API with Cloudflare KV caching, stale-while-revalidate, and optional bearer authentication. |

## Develop locally

Requires Node.js 22+, npm, and Bun 1.4 for tests.

```sh
npm ci
npm run verify
npm run dev:site
```

The example below runs after installing `@linkoi/core`.

```js
import { resolve, fromHtml } from '@linkoi/core'

const page = await resolve('https://example.com')
console.log(page.title, page.description, page.image)

const local = await fromHtml(
  '<title>A small discovery</title>',
  'https://example.com',
  { fallback: false }
)
```

[Core API](./packages/core/README.md) · [Deploy the Worker](./packages/worker/README.md) · [Tabstash migration](./docs/migration.md) · [Brand assets](./brand/README.md)

## What it extracts

Canonical URL, title, description, image, logo, publisher, author, publication date, and language. The fast path reads Open Graph, Twitter Card, JSON-LD, and HTML metadata. Incomplete results can use Metascraper. Missing values are `null`, and `source` identifies the fast or fallback path.

Optional YouTube Data API access supplies video metadata. This does not return playable embeds.

## Current boundaries

- No JavaScript rendering, screenshots, PDFs, general oEmbed, crawling, or article-body extraction.
- Core uses standard fetch APIs but is validated on Node.js 22 and Bun; the Worker targets Cloudflare. Other runtimes are not yet claimed as supported.
- URL checks reject known local addresses and unsafe redirects. They are **not DNS-aware SSRF protection**. Use network egress restrictions or your own controlled fetching for untrusted targets on private networks. See [SECURITY.md](./SECURITY.md).
- The optional fallback has additional dependencies; lazy loading is not a promise of a tiny installation or Worker bundle.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Keep extraction independent of deployment infrastructure. Run the release checklist before publishing updates.

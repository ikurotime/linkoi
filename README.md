<p align="center"><img src="./brand/banner.svg" alt="Linkoi. A little more behind every link." width="100%"></p>

# Linkoi

Extract normalized metadata from a URL or supplied HTML. Use the library in your server, or deploy the included Cloudflare Worker for an HTTP API with caching.

**Developer preview, v0.1.1.** Install with `npm install @linkoi/core@0.1.1`. Source-available under PolyForm Shield 1.0.0. See [LICENSE](./LICENSE) and the [licensing notes](./docs/licensing.md).

## Packages

| Package | Purpose |
| --- | --- |
| `@linkoi/deep-links` | YouTube URL validation and web/iOS/Android app links, with zero runtime dependencies. |
| `@linkoi/client` | Typed server-side client for the hosted API, with zero runtime dependencies. |
| `@linkoi/core` | Fetching, HTML extraction, normalization, and YouTube metadata, with zero runtime dependencies. |
| `@linkoi/worker` | Hono API with Cloudflare KV caching, stale-while-revalidate, and optional bearer authentication. |

## Hosted API

[Sign in with GitHub](https://linkoi.dev/dashboard/) and create an API key. Keys are displayed once; only their SHA-256 hashes are stored. Keep keys on your server.

```js
import { createClient } from '@linkoi/client'

const linkoi = createClient({ apiKey: process.env.LINKOI_API_KEY })
const { data } = await linkoi.resolve('https://example.com')
```

Install with `npm install @linkoi/client`. Accounts start with 1,000 metadata requests per UTC calendar month and 60 per minute, shared across their keys. [HTTP reference](https://linkoi.dev/docs/http-api/) · [Account deployment](./docs/accounts.md)

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

Canonical URL, title, description, image, logo, publisher, author, publication date, and language. The fast path reads Open Graph, Twitter Card, JSON-LD, and HTML metadata. Missing values are `null`. New results have `source: "fast"`.

Optional YouTube Data API access supplies video metadata. This does not return playable embeds.

## Current boundaries

- No JavaScript rendering, screenshots, PDFs, general oEmbed, crawling, or article-body extraction.
- Core uses standard fetch APIs but is validated on Node.js 22 and Bun; the Worker targets Cloudflare. Other runtimes are not yet claimed as supported.
- URL checks reject known local addresses and unsafe redirects. They are **not DNS-aware SSRF protection**. Use network egress restrictions or your own controlled fetching for untrusted targets on private networks. See [SECURITY.md](./SECURITY.md).
- Core has zero runtime dependencies. The Worker depends on core and Hono.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Keep extraction independent of deployment infrastructure. Run the release checklist before publishing updates.

## Package releases

Public npm packages have independent versions and changelogs. Release Please
collects changes into one release PR and publishes only the released packages.
Optional npm candidates use the `next` tag; the private accounts workspace is
excluded. See [package releases](./docs/release.md) for setup and testing.

## Deep links from Git

The deep-link package is not yet published to npm. To consume its source, pin
this repository to a full commit SHA in your dependency manifest:

```json
{ "dependencies": { "linkoi": "github:ikurotime/linkoi#<full-commit-sha>" } }
```

```ts
import { resolveDeepLink } from 'linkoi/deep-links'
```

This entry exports TypeScript for bundlers such as Vite. For compiled ESM, use
`npm pack --workspace @linkoi/deep-links` after installing the repository's dev
dependencies. See [the package documentation](./packages/deep-links/README.md).

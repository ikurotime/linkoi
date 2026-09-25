# @linkoi/deep-links

Resolve video URLs into canonical web URLs and mobile app links. YouTube is
the first supported provider. There are no runtime dependencies, network calls,
browser globals, framework imports, storage or product-specific routes.

The source lives in the Linkoi repository. The package is private and is not
published to npm. `npm pack --workspace @linkoi/deep-links` produces an ESM
artifact with TypeScript declarations.

Bundler-based consumers can depend directly on this repository at an immutable
commit and import `resolveDeepLink` from `linkoi/deep-links`. This Git entry
exports TypeScript source and requires a TypeScript-aware bundler such as Vite.
Node consumers should use the compiled package artifact instead.

## Usage

```ts
import { resolveDeepLink } from '@linkoi/deep-links'

const link = resolveDeepLink('https://youtu.be/dQw4w9WgXcQ?t=2m')
if (link) {
  link.provider // 'youtube'
  link.target // { videoId: 'dQw4w9WgXcQ', startSeconds: 120 }
  link.urls.web // canonical HTTPS URL and fallback
  link.urls.ios // best-effort youtube:// URL
  link.urls.android // intent URL with an encoded web fallback
  link.previewImageUrl // YouTube thumbnail URL; not fetched by the package
}
```

`resolveDeepLink` returns `null` for invalid or unsupported input. It accepts
YouTube watch, Shorts, live and embed video URLs, including `youtu.be`, mobile
and music hosts. It preserves timestamps and removes playlist context and
tracking parameters. Channel and playlist-only URLs are not supported.

Lower-level exports are `parseYouTubeUrl`, `parseYouTubeTime`,
`isYouTubeVideoId`, `youtubeWebUrl` and `youtubeAppLinks`. URL builders throw
`TypeError` for invalid targets, including negative or noninteger timestamps.
The exported types are `DeepLink`, `AppLinks` and `YouTubeTarget`.

The resolver validates URL structure, not video existence, visibility or app
installation. Android intents must be invoked by a user gesture. YouTube's iOS
scheme is best-effort and is not a published Google API contract. Always show
the web URL as an alternative. Embedded browsers can block the handoff.

## Product boundary

Linkoi or Kitmo supplies the public domain, route or short-code storage,
landing page, device detection, analytics and copy/share interface. The package
only resolves the destination. It neither creates a hosted short link nor calls
a Linkoi service. Both products can consume it without calling each other.

Kitmo currently maps the resolved target to `/r/youtube/<video-id>?t=<seconds>`.
That route is a Kitmo adapter, not part of this package's API. A future Linkoi
service may use its own slugs and domain without changing the resolver.

## Development and packaging

From this directory after installing dev dependencies:

```sh
npm run build
npm test
npm run check
npm pack
```

`npm pack` compiles before packaging and includes only `dist`, this README and
the manifest. The artifact runs in Node, Bun and browser/Worker ESM consumers
that provide the standard `URL` and `URLSearchParams` APIs. No bundler or
TypeScript loader is needed to consume the compiled package.

Install root dev dependencies with `npm ci`. The repository's `npm run verify`
builds all packages, checks their types and runs the Bun tests. Deep-link tests
use no live network requests.

Before adding another provider, define its URL allowlist, canonical URL,
mobile handoff and web fallback, and add tests for those boundaries. Extend
`DeepLink` as a discriminated union so consumers can handle each target shape.
Do not reuse YouTube's path or app scheme for another provider.

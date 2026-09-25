# Unreleased

- Add `@linkoi/deep-links` for YouTube URL validation, timestamp normalization
  and web/iOS/Android handoff URLs, without runtime dependencies.
- Expose `linkoi/deep-links` as a TypeScript source entry for consumers pinned
  to this Git repository. Hosting, routes and analytics remain with consumers.

# 0.1.1

- Remove Metascraper and all of its plugins. Core has zero runtime dependencies.
- Supplied HTML is always parsed offline, including incomplete pages.
- Legacy fallback options and the fallback export remain inert compatibility shims.
- Worker cache keys use a new namespace so old external extraction results are not served.
- Missing metadata stays null rather than invoking another extractor.

# Changelog

## [0.2.0](https://github.com/ikurotime/linkoi/compare/v0.1.1...v0.2.0) (2026-09-25)


### Features

* add independent YouTube deep-link package ([#1](https://github.com/ikurotime/linkoi/issues/1)) ([f5baf58](https://github.com/ikurotime/linkoi/commit/f5baf583ea45d1643ac4f5062f8837335bac981e))

## 0.1.0 — unreleased

- Extracted Attolink into core and Cloudflare Worker packages.
- Added `resolve(url, options)` and `fromHtml(html, url, options)` public APIs.
- Retained Worker response shape and caching behavior for Tabstash.
- Added editable koi branding and a documentation landing page.
- PolyForm Shield 1.0.0 license draft. No public release yet.

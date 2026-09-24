# 0.1.1

- Remove Metascraper and all of its plugins. Core has zero runtime dependencies.
- Supplied HTML is always parsed offline, including incomplete pages.
- Legacy fallback options and the fallback export remain inert compatibility shims.
- Worker cache keys use a new namespace so old external extraction results are not served.
- Missing metadata stays null rather than invoking another extractor.

# Changelog

## 0.1.0 — unreleased

- Extracted Attolink into core and Cloudflare Worker packages.
- Added `resolve(url, options)` and `fromHtml(html, url, options)` public APIs.
- Retained Worker response shape and caching behavior for Tabstash.
- Added editable koi branding and a documentation landing page.
- PolyForm Shield 1.0.0 license draft. No public release yet.

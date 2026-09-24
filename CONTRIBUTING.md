# Contributing

Contributions must be compatible with PolyForm Shield 1.0.0. Please discuss substantial contributions before submitting them; no contributor license agreement is currently in place.

Use Node.js 22+ and Bun 1.4. Run `npm ci`, then `npm run verify` and `npm run build:site`. Tests should use supplied HTML or mocked fetch responses, not live third-party pages. Add fixtures for malformed metadata and redirects. Do not commit credentials, account-specific deployment configuration, or scraped private content.

Core must not import Hono or Cloudflare bindings. The Worker owns HTTP, authorization, and caching. Document observable API changes in CHANGELOG.md.

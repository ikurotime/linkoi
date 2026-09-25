# Contributing

Contributions must be compatible with PolyForm Shield 1.0.0. Please discuss substantial contributions before submitting them; no contributor license agreement is currently in place.

Use Node.js 22+ and Bun 1.4. Run `npm ci`, then `npm run verify` and `npm run build:site`. Tests should use supplied HTML or mocked fetch responses, not live third-party pages. Add fixtures for malformed metadata and redirects. Do not commit credentials, account-specific deployment configuration, or scraped private content.

Core must not import Hono or Cloudflare bindings. The Worker owns HTTP, authorization, and caching. Describe observable API changes in the PR; Release Please writes package changelogs.

Use Conventional Commit PR titles: `fix:` for patches, `feat:` for features,
and `!` for breaking changes, for example `feat!: change the resolver API`.
Squash merge using the PR title. Release Please proposes version bumps and
package changelog entries in one release PR. Merging it creates per-package tags
and GitHub releases, then dispatches npm publication for those packages.
See [the release workflow](./docs/release.md) for versioning and package publishing.

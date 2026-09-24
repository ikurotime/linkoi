# Tabstash migration

The original `@tabstash/linkoi` workspace remains as an adapter. Its deployed Worker name, KV namespace, API secrets, and HTTP response envelope stay under Tabstash's control.

Until Linkoi is published, run `npm run pack:local` in this repository. Copy the two archives from `artifacts/` into Tabstash's `packages/linkoi/vendor/` and install them through `file:` dependencies. Tabstash also needs a root `overrides` entry mapping `@linkoi/core` to `file:./packages/linkoi/vendor/linkoi-core-0.1.0.tgz` so Bun resolves the Worker peer locally. Remove that override when switching to published versions. This makes a fresh Tabstash checkout independent of an adjacent Linkoi checkout or unpublished registry versions.

The adapter re-exports the Worker as its default entry and routes old subpath exports to core or Worker cache modules. After a public release, replace the file dependencies with registry versions. Use LINKOI_URL=https://api.linkoi.dev for the branded endpoint. ATTOLINK_URL remains a compatibility fallback.

The standalone repository is the source of truth. Rebuild and replace vendor archives whenever Linkoi changes. Run both repositories' tests and the backing Worker dry-run before deployment. Do not run two deployments against the same production KV namespace during evaluation.

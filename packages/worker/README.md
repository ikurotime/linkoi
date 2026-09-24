# @linkoi/worker

Linkoi's Hono application for Cloudflare Workers. Requires `@linkoi/core` and a KV namespace bound as `META_CACHE`. Developer preview, v0.1.0.

## Local development

From the repository root:

```sh
npm run build
cd packages/worker
cp wrangler.example.json wrangler.json
npx wrangler dev --config wrangler.json
```

For a remote deployment, create your own namespace with `npx wrangler kv namespace create META_CACHE`, then replace the placeholder ID in `wrangler.json`. Set `SELF_HOSTS` to your Worker hostname. Set secrets using `npx wrangler secret put API_KEY --config wrangler.json` and optionally `YOUTUBE_API_KEY`. Deploy deliberately with `npx wrangler deploy --config wrangler.json`.

No production account IDs, KV IDs, or secrets are included.

## HTTP API

- `GET /?url=https%3A%2F%2Fexample.com`: `{ status: "success", data: Metadata, cache: "hit" | "stale" | "miss" | "bypass" }`.
- `fresh=true` bypasses cache reads and updates the cache.
- `fallback=false` disables the Metascraper fallback for extraction. Existing cache entries are shared; use `fresh=true` when you need a new extraction with this flag.
- `DELETE /?url=...` invalidates one cache key.
- `GET /health` returns `{ ok: true }`.

When API_KEY is configured, all routes require `Authorization: Bearer <key>`. Without it, routes including cache invalidation are public. No per-customer authentication, quotas, or rate limiting is included.

Defaults: 2 MiB HTML cap, 5-second per-fetch timeout, 1-day fresh cache, 7-day storage TTL. Configure MAX_HTML_BYTES, FETCH_TIMEOUT_MS, FRESH_TTL_SECONDS, STALE_TTL_SECONDS, and comma-separated SELF_HOSTS through Worker variables.

The Worker default export is the Hono application. `resolve(target, env, allowFallback)` retains Attolink's adapter signature. Core extraction and response fields remain compatible; unknown YouTube language is now null instead of being assumed English.

Licensed under PolyForm Shield 1.0.0. Commercial use is allowed for non-competing purposes. See LICENSE for the exact terms.

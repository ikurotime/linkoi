# Cloudflare deployment

The landing page deploys with `npm run deploy:site` to the `linkoi-site` Worker at https://linkoi.dev. The custom domain is declared in `deploy/site.jsonc`; Cloudflare manages DNS and TLS.
The branded metadata endpoint deploys with `npm run deploy:api` to the `linkoi` Worker at https://api.linkoi.dev. Cloudflare manages the custom domain and TLS.

The API currently forwards through a service binding to the existing `attolink` Worker, preserving its KV cache and YouTube secret. Tabstash deploys that extraction service from `packages/linkoi`, which consumes the packed `@linkoi/core` and `@linkoi/worker` packages. Do not delete the backing Worker until its secrets and bindings have been migrated.

Both packages are published at 0.1.0. Tabstash pins the registry versions. Authenticate with npm before publishing future releases.

## Verify the endpoint

```sh
curl https://api.linkoi.dev/health
curl --get https://api.linkoi.dev/ --data-urlencode "url=https://kitmo.app"
```

The endpoint currently permits public access, including cache invalidation, matching the existing Tabstash service. There are no per-customer quotas or hosted-service guarantees. Keep the backing service deployed; the alias cannot extract metadata on its own. SELF_HOSTS includes both Workers hostnames and api.linkoi.dev to reject recursive extraction.

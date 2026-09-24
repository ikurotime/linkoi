# @linkoi/client

A dependency-free TypeScript client for the Linkoi metadata API. Requires Node.js 22+ or a runtime with fetch and AbortSignal.any.

```sh
npm install @linkoi/client
```

Create a key at https://linkoi.dev/dashboard/ and store it in a server-side environment variable. Never include it in browser code.

```ts
import { createClient, LinkoiError } from '@linkoi/client'

const linkoi = createClient({ apiKey: process.env.LINKOI_API_KEY! })
const { data, cache } = await linkoi.resolve('https://example.com')
console.log(data.title, cache)
```

`createClient({ apiKey, baseUrl?, timeoutMs?, fetch? })` makes no requests at initialization. The default base URL is `https://api.linkoi.dev/` and timeout is 15 seconds. HTTP is allowed only for localhost development; redirects are rejected so credentials cannot follow a redirect to another host.

`resolve(url, { fresh?, signal? })` returns the API response envelope. `fresh: true` bypasses the cache read. `LinkoiError` provides the HTTP status and optional `retryAfter` seconds for rate limits. Requests are not automatically retried or duplicated.

See https://linkoi.dev/docs/http-api/ for fields and limits. Licensed under PolyForm Shield 1.0.0.

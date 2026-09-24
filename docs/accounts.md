# Hosted accounts

The hosted API uses Supabase Auth for GitHub sign-in. The dashboard sends the session access token to `linkoi-accounts`; the function checks it with `auth.getUser` before listing, creating, or revoking keys. Ownership filters apply to every key operation.

Keys contain 32 random bytes with an `lk_live_` prefix. The creation response shows the raw key once. Postgres stores a SHA-256 hash, a display prefix, name, owner, timestamps, and usage. Both tables have RLS enabled with no public policies or public grants. Only the server service role can read or modify them.

The Cloudflare gateway sends user keys to the account function for authorization. An atomic Postgres transaction checks revocation, account status, and shared minute/month counters before forwarding the request. The extractor receives only its internal credential. Authorization outages fail closed.

## Deploy

1. Apply the SQL files in `supabase/migrations` in order to your Supabase project.
2. Enable GitHub Auth. Configure the OAuth callback as `https://PROJECT.supabase.co/auth/v1/callback`, Site URL as your site origin, and allow its `/dashboard/` redirect.
3. Deploy `supabase/functions/linkoi-accounts/index.ts`, including its relative dependency in `packages/accounts/src/handler.ts`. Disable platform JWT verification for this function because it performs custom session/API-key verification itself. The Supabase runtime supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never put the service-role key in the website.
4. Set the public project URL and publishable key in `site/dashboard/dashboard.js`, and the exact allowed site origin in `packages/accounts/src/handler.ts`.
5. Configure `ACCOUNTS_URL` and `SUPABASE_PUBLISHABLE_KEY` in `deploy/api.jsonc`. Set the Cloudflare `EXTRACTION_API_KEY` secret to match the backing extractor's `API_KEY`. Deploy the gateway and website.

The default account allowance is 1,000 metadata requests per UTC month and 60 per UTC minute, with at most 10 active keys. Counters are shared by all keys belonging to the account. Admitted requests consume quota even if extraction later fails. Health checks do not consume quota. Hosted cache deletion is disabled.

Do not remove the service-role column grant on `auth.users`: the invoker function needs the ID and disabled/deleted status columns to reject disabled accounts. It has no grant to read password or identity fields.

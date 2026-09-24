# Tabstash migration

Tabstash’s `@tabstash/linkoi` adapter pins `@linkoi/core` and `@linkoi/worker` to npm version 0.1.0. The temporary vendor archives and root override have been removed.

The backing Worker retains the name `attolink`, its KV cache, and YouTube secret. https://api.linkoi.dev forwards to it. LINKOI_URL takes precedence over the legacy ATTOLINK_URL setting.

For updates, publish core before worker, update the exact versions in Tabstash, refresh bun.lock, run adapter tests and typechecks, and verify the Worker bundle before deployment.

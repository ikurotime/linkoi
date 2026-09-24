-- The authorizer runs as service_role and only needs account status.
grant select (id, banned_until, deleted_at) on auth.users to service_role;

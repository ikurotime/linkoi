-- Run against a migrated database as postgres. All fixtures roll back.
begin;
select set_config('linkoi.test_user', gen_random_uuid()::text, true);
insert into auth.users (id) values (current_setting('linkoi.test_user')::uuid);
set local role service_role;
do $$
declare
  u uuid := current_setting('linkoi.test_user')::uuid;
  h text := repeat(replace(u::text, '-', ''), 2);
  issued jsonb;
  result jsonb;
begin
  issued := public.linkoi_issue_key(u, 'Transaction test', h, 'lk_live_test');
  if issued->>'id' is null then raise exception 'Key creation failed'; end if;
  update public.linkoi_accounts set minute_limit=1, monthly_limit=2 where user_id=u;
  result := public.linkoi_authorize(h, false);
  if result->>'status' <> '200' then raise exception 'Service-role authorization failed'; end if;
  perform public.linkoi_authorize(h, true);
  result := public.linkoi_authorize(h, true);
  if result->>'reason' <> 'rate_limit' then raise exception 'Minute limit failed'; end if;
  update public.linkoi_accounts set minute_start=now()-interval '2 minutes' where user_id=u;
  perform public.linkoi_authorize(h, true);
  result := public.linkoi_authorize(h, true);
  if result->>'reason' <> 'monthly_limit' then raise exception 'Monthly limit failed'; end if;
  update public.linkoi_api_keys set revoked_at=now() where user_id=u;
  result := public.linkoi_authorize(h, false);
  if result->>'status' <> '401' then raise exception 'Revocation failed'; end if;
  if has_table_privilege('anon', 'public.linkoi_api_keys', 'SELECT')
     or has_table_privilege('authenticated', 'public.linkoi_api_keys', 'SELECT')
     or has_function_privilege('anon', 'public.linkoi_authorize(text,boolean)', 'EXECUTE') then
    raise exception 'Public access is allowed';
  end if;
end $$;
rollback;

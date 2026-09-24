-- All data access goes through the authenticated Edge Function, never browser SQL.
create table public.linkoi_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_limit integer not null default 1000 check (monthly_limit > 0),
  minute_limit integer not null default 60 check (minute_limit > 0),
  month_start date not null default date_trunc('month', now() at time zone 'UTC')::date,
  month_requests integer not null default 0 check (month_requests >= 0),
  minute_start timestamptz not null default date_trunc('minute', now()),
  minute_requests integer not null default 0 check (minute_requests >= 0)
);
create table public.linkoi_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.linkoi_accounts(user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  prefix text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  requests_total bigint not null default 0
);
create index linkoi_api_keys_owner on public.linkoi_api_keys(user_id, created_at desc);
alter table public.linkoi_accounts enable row level security;
alter table public.linkoi_api_keys enable row level security;
revoke all on public.linkoi_accounts, public.linkoi_api_keys from public, anon, authenticated;
grant select,insert,update,delete on public.linkoi_accounts, public.linkoi_api_keys to service_role;

create function public.linkoi_issue_key(p_user uuid,p_name text,p_hash text,p_prefix text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result public.linkoi_api_keys;
begin
  insert into public.linkoi_accounts(user_id) values(p_user) on conflict do nothing;
  perform 1 from public.linkoi_accounts where user_id=p_user for update;
  if (select count(*) from public.linkoi_api_keys where user_id=p_user and revoked_at is null)>=10 then
    return jsonb_build_object('error','key_limit');
  end if;
  insert into public.linkoi_api_keys(user_id,name,key_hash,prefix) values(p_user,p_name,p_hash,p_prefix) returning * into result;
  return jsonb_build_object('id',result.id,'name',result.name,'prefix',result.prefix,'created_at',result.created_at);
end $$;

-- Row locks make quota reservations atomic across all keys belonging to a user.
create function public.linkoi_authorize(p_hash text,p_consume boolean default true)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare k public.linkoi_api_keys; a public.linkoi_accounts; t timestamptz := now(); m date := date_trunc('month',now() at time zone 'UTC')::date;
begin
  select * into k from public.linkoi_api_keys where key_hash=p_hash and revoked_at is null for update;
  if not found then return jsonb_build_object('status',401); end if;
  if not exists(select 1 from auth.users where id=k.user_id and (banned_until is null or banned_until<t) and deleted_at is null) then
    return jsonb_build_object('status',401);
  end if;
  select * into a from public.linkoi_accounts where user_id=k.user_id for update;
  if a.month_start<>m then a.month_start:=m; a.month_requests:=0; end if;
  if a.minute_start<>date_trunc('minute',t) then a.minute_start:=date_trunc('minute',t); a.minute_requests:=0; end if;
  if p_consume and a.month_requests>=a.monthly_limit then
    return jsonb_build_object('status',429,'reason','monthly_limit','retry_after',ceil(extract(epoch from (m+interval '1 month') at time zone 'UTC'-t)));
  end if;
  if p_consume and a.minute_requests>=a.minute_limit then
    return jsonb_build_object('status',429,'reason','rate_limit','retry_after',ceil(extract(epoch from a.minute_start+interval '1 minute'-t)));
  end if;
  if p_consume then
    update public.linkoi_accounts set month_start=a.month_start,month_requests=a.month_requests+1,minute_start=a.minute_start,minute_requests=a.minute_requests+1 where user_id=k.user_id;
    update public.linkoi_api_keys set last_used_at=t,requests_total=requests_total+1 where id=k.id;
  end if;
  return jsonb_build_object('status',200,'remaining',greatest(0,a.monthly_limit-a.month_requests-case when p_consume then 1 else 0 end),'limit',a.monthly_limit);
end $$;
revoke all on function public.linkoi_issue_key(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.linkoi_authorize(text,boolean) from public,anon,authenticated;
grant execute on function public.linkoi_issue_key(uuid,text,text,text),public.linkoi_authorize(text,boolean) to service_role;

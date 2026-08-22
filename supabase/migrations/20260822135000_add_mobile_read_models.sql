-- IBEX HAD — narrow read models for Mobile/Web operational flows.
-- Read models never become financial truth: balances are derived from posted ledger entries.

begin;

create or replace function private.query_businesses(p_actor_user_id uuid)
returns table (
  business_id uuid,
  name text,
  default_currency_code text,
  role text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);

  return query
  select
    b.id,
    b.name,
    b.default_currency_code,
    case
      when b.owner_user_id = auth.uid() then 'owner'::text
      else bm.role
    end
  from public.businesses b
  left join public.business_members bm
    on bm.business_id = b.id
   and bm.user_id = auth.uid()
   and bm.status = 'active'
  where b.status = 'active'
    and (b.owner_user_id = auth.uid() or bm.id is not null)
  order by b.created_at, b.id;
end;
$$;

create or replace function private.query_business_customers(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_search text default null
)
returns table (
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Business customer access is not permitted' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Customer limit must be between 1 and 200' using errcode = '22023';
  end if;

  return query
  select
    bc.id,
    ci.id,
    ci.display_name,
    ci.phone_e164,
    count(ca.id)::integer,
    bc.created_at
  from public.business_customers bc
  join public.customer_identities ci on ci.id = bc.customer_identity_id
  left join public.customer_accounts ca
    on ca.business_customer_id = bc.id
   and ca.status <> 'closed'
  where bc.business_id = p_business_id
    and bc.status = 'active'
    and (
      p_search is null
      or btrim(p_search) = ''
      or ci.display_name ilike '%' || btrim(p_search) || '%'
      or ci.phone_e164 ilike '%' || btrim(p_search) || '%'
    )
  group by bc.id, ci.id, ci.display_name, ci.phone_e164, bc.created_at
  order by ci.display_name, bc.id
  limit p_limit;
end;
$$;

create or replace function private.query_customer_accounts(
  p_actor_user_id uuid,
  p_business_customer_id uuid
)
returns table (
  account_id uuid,
  business_customer_id uuid,
  currency_code text,
  status text,
  balance_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  perform private.require_actor(p_actor_user_id);

  select bc.business_id into v_business_id
  from public.business_customers bc
  where bc.id = p_business_customer_id;

  if v_business_id is null
     or not private.can_manage_business(v_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Customer account access is not permitted' using errcode = '42501';
  end if;

  return query
  select
    ca.id,
    ca.business_customer_id,
    ca.currency_code,
    ca.status,
    private.account_balance(ca.id)
  from public.customer_accounts ca
  where ca.business_customer_id = p_business_customer_id
    and ca.status <> 'closed'
  order by ca.currency_code, ca.id;
end;
$$;

create or replace function public.app_list_businesses(p_actor_user_id uuid)
returns table (
  business_id uuid,
  name text,
  default_currency_code text,
  role text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.query_businesses(p_actor_user_id);
$$;

create or replace function public.app_list_business_customers(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_search text default null
)
returns table (
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_count integer,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.query_business_customers(p_actor_user_id, p_business_id, p_limit, p_search);
$$;

create or replace function public.app_list_customer_accounts(
  p_actor_user_id uuid,
  p_business_customer_id uuid
)
returns table (
  account_id uuid,
  business_customer_id uuid,
  currency_code text,
  status text,
  balance_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.query_customer_accounts(p_actor_user_id, p_business_customer_id);
$$;

revoke all on function private.query_businesses(uuid) from public, anon;
revoke all on function private.query_business_customers(uuid,uuid,integer,text) from public, anon;
revoke all on function private.query_customer_accounts(uuid,uuid) from public, anon;
grant execute on function private.query_businesses(uuid) to authenticated, service_role;
grant execute on function private.query_business_customers(uuid,uuid,integer,text) to authenticated, service_role;
grant execute on function private.query_customer_accounts(uuid,uuid) to authenticated, service_role;

revoke all on function public.app_list_businesses(uuid) from public, anon;
revoke all on function public.app_list_business_customers(uuid,uuid,integer,text) from public, anon;
revoke all on function public.app_list_customer_accounts(uuid,uuid) from public, anon;
grant execute on function public.app_list_businesses(uuid) to authenticated, service_role;
grant execute on function public.app_list_business_customers(uuid,uuid,integer,text) to authenticated, service_role;
grant execute on function public.app_list_customer_accounts(uuid,uuid) to authenticated, service_role;

comment on function public.app_list_customer_accounts(uuid,uuid) is
  'Operational read model. balance_minor is reconstructed from immutable ledger entries and is not cached financial truth.';

commit;

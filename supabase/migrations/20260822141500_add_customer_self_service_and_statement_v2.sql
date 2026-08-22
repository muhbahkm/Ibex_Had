-- IBEX HAD — Customer self-service read model + statement v2 permissions.
-- Customer users see only identities they have explicitly claimed.
-- Reversal eligibility is decided server-side from actor role and transaction state.

begin;

create or replace function private.query_my_customer_accounts(p_actor_user_id uuid)
returns table (
  business_id uuid,
  business_name text,
  business_customer_id uuid,
  customer_identity_id uuid,
  account_id uuid,
  currency_code text,
  account_status text,
  balance_minor bigint
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
    bc.id,
    ci.id,
    ca.id,
    ca.currency_code,
    ca.status,
    private.account_balance(ca.id)
  from public.customer_identities ci
  join public.business_customers bc
    on bc.customer_identity_id = ci.id
   and bc.status = 'active'
  join public.businesses b
    on b.id = bc.business_id
   and b.status = 'active'
  join public.customer_accounts ca
    on ca.business_customer_id = bc.id
   and ca.status <> 'closed'
  where ci.claimed_user_id = auth.uid()
    and ci.claimed_user_id = p_actor_user_id
  order by b.name, ca.currency_code, ca.id;
end;
$$;

create or replace function private.command_get_statement_v2(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_limit integer default 50,
  p_before_occurred_at timestamptz default null
)
returns table (
  transaction_id uuid,
  transaction_type text,
  transaction_status text,
  occurred_at timestamptz,
  description text,
  effect_minor bigint,
  balance_after_minor bigint,
  currency_code text,
  can_reverse boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Statement limit must be between 1 and 200' using errcode = '22023';
  end if;
  if not private.can_access_account(p_account_id) then
    raise exception 'Account access is not permitted' using errcode = '42501';
  end if;

  return query
  with effects as (
    select
      lt.id,
      lt.business_id,
      lt.transaction_type,
      lt.status,
      lt.occurred_at,
      lt.description,
      ca.currency_code,
      sum(case when le.direction = 'debit' then le.amount_minor else -le.amount_minor end)::bigint as effect_minor
    from public.ledger_transactions lt
    join public.customer_accounts ca on ca.id = lt.account_id
    join public.ledger_entries le on le.transaction_id = lt.id
    where lt.account_id = p_account_id
      and lt.status in ('posted','reversed')
    group by lt.id, lt.business_id, lt.transaction_type, lt.status, lt.occurred_at, lt.description, ca.currency_code
  ), running as (
    select
      e.*,
      sum(e.effect_minor) over (order by e.occurred_at, e.id rows unbounded preceding)::bigint as balance_after_minor
    from effects e
  )
  select
    r.id,
    r.transaction_type,
    r.status,
    r.occurred_at,
    r.description,
    r.effect_minor,
    r.balance_after_minor,
    r.currency_code,
    (
      r.status = 'posted'
      and r.transaction_type <> 'reversal'
      and private.can_manage_business(r.business_id, array['owner','manager']::text[])
    ) as can_reverse
  from running r
  where p_before_occurred_at is null or r.occurred_at < p_before_occurred_at
  order by r.occurred_at desc, r.id desc
  limit p_limit;
end;
$$;

create or replace function public.app_list_my_customer_accounts(p_actor_user_id uuid)
returns table (
  business_id uuid,
  business_name text,
  business_customer_id uuid,
  customer_identity_id uuid,
  account_id uuid,
  currency_code text,
  account_status text,
  balance_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.query_my_customer_accounts(p_actor_user_id);
$$;

create or replace function public.app_get_statement_v2(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_limit integer default 50,
  p_before_occurred_at timestamptz default null
)
returns table (
  transaction_id uuid,
  transaction_type text,
  transaction_status text,
  occurred_at timestamptz,
  description text,
  effect_minor bigint,
  balance_after_minor bigint,
  currency_code text,
  can_reverse boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.command_get_statement_v2(p_actor_user_id, p_account_id, p_limit, p_before_occurred_at);
$$;

revoke all on function private.query_my_customer_accounts(uuid) from public, anon;
revoke all on function private.command_get_statement_v2(uuid,uuid,integer,timestamptz) from public, anon;
grant execute on function private.query_my_customer_accounts(uuid) to authenticated, service_role;
grant execute on function private.command_get_statement_v2(uuid,uuid,integer,timestamptz) to authenticated, service_role;

revoke all on function public.app_list_my_customer_accounts(uuid) from public, anon;
revoke all on function public.app_get_statement_v2(uuid,uuid,integer,timestamptz) from public, anon;
grant execute on function public.app_list_my_customer_accounts(uuid) to authenticated, service_role;
grant execute on function public.app_get_statement_v2(uuid,uuid,integer,timestamptz) to authenticated, service_role;

comment on function public.app_list_my_customer_accounts(uuid) is
  'Customer self-service read model: only accounts whose customer identity is explicitly claimed by auth.uid().';
comment on function public.app_get_statement_v2(uuid,uuid,integer,timestamptz) is
  'Statement v2 with deterministic running balance and server-computed reversal eligibility.';

commit;

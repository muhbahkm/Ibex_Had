create or replace function private.query_business_collection_rows(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100
)
returns table(
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_count integer,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  last_movement_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);

  if not private.can_manage_business(
    p_business_id,
    array['owner','manager','cashier','viewer']::text[]
  ) then
    raise exception 'Business collection access is not permitted' using errcode = '42501';
  end if;

  if p_limit < 1 or p_limit > 200 then
    raise exception 'Collection customer limit must be between 1 and 200' using errcode = '22023';
  end if;

  return query
  with selected_customers as (
    select
      bc.id as business_customer_id,
      ci.id as customer_identity_id,
      ci.display_name,
      ci.phone_e164,
      bc.created_at
    from public.business_customers bc
    join public.customer_identities ci on ci.id = bc.customer_identity_id
    where bc.business_id = p_business_id
      and bc.status = 'active'
    order by ci.display_name, bc.id
    limit p_limit
  ), active_accounts as (
    select
      ca.id as account_id,
      ca.business_customer_id,
      ca.currency_code
    from public.customer_accounts ca
    join selected_customers sc on sc.business_customer_id = ca.business_customer_id
    where ca.status <> 'closed'
  ), account_financials as (
    select
      aa.account_id,
      coalesce(
        sum(
          case
            when le.direction = 'debit' then le.amount_minor
            when le.direction = 'credit' then -le.amount_minor
            else 0
          end
        ) filter (where lt.status in ('posted','reversed')),
        0
      )::bigint as balance_minor,
      max(lt.occurred_at) filter (where lt.status in ('posted','reversed')) as last_movement_at
    from active_accounts aa
    left join public.ledger_transactions lt on lt.account_id = aa.account_id
    left join public.ledger_entries le on le.transaction_id = lt.id
    group by aa.account_id
  ), account_counts as (
    select aa.business_customer_id, count(*)::integer as account_count
    from active_accounts aa
    group by aa.business_customer_id
  )
  select
    sc.business_customer_id,
    sc.customer_identity_id,
    sc.display_name,
    sc.phone_e164,
    coalesce(ac.account_count, 0)::integer,
    aa.account_id,
    aa.currency_code,
    coalesce(af.balance_minor, 0)::bigint,
    af.last_movement_at
  from selected_customers sc
  left join account_counts ac on ac.business_customer_id = sc.business_customer_id
  left join active_accounts aa on aa.business_customer_id = sc.business_customer_id
  left join account_financials af on af.account_id = aa.account_id
  order by sc.display_name, sc.business_customer_id, aa.currency_code, aa.account_id;
end;
$$;

revoke all on function private.query_business_collection_rows(uuid, uuid, integer) from public;

create or replace function public.app_list_business_collection_rows(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100
)
returns table(
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_count integer,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  last_movement_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.query_business_collection_rows(
    p_actor_user_id,
    p_business_id,
    p_limit
  );
$$;

revoke all on function public.app_list_business_collection_rows(uuid, uuid, integer) from public;
revoke all on function public.app_list_business_collection_rows(uuid, uuid, integer) from anon;
grant execute on function public.app_list_business_collection_rows(uuid, uuid, integer) to authenticated;

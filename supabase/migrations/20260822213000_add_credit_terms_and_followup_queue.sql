create table private.customer_credit_terms (
  account_id uuid primary key references public.customer_accounts(id) on delete cascade,
  terms_days integer not null check (terms_days between 0 and 3650),
  grace_days integer not null default 0 check (grace_days between 0 and 365),
  is_enabled boolean not null default true,
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.credit_sale_due_dates (
  transaction_id uuid primary key references public.ledger_transactions(id) on delete cascade,
  account_id uuid not null references public.customer_accounts(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  terms_days integer not null check (terms_days between 0 and 3650),
  grace_days integer not null default 0 check (grace_days between 0 and 365),
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index credit_sale_due_dates_business_due_idx
  on private.credit_sale_due_dates (business_id, due_at, account_id);
create index credit_sale_due_dates_account_due_idx
  on private.credit_sale_due_dates (account_id, due_at);

revoke all on private.customer_credit_terms from public, anon, authenticated;
revoke all on private.credit_sale_due_dates from public, anon, authenticated;

create or replace function private.capture_credit_sale_due_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms private.customer_credit_terms;
begin
  if new.status <> 'posted' or new.transaction_type <> 'sale_on_account' then
    return new;
  end if;
  if old.status = 'posted' then
    return new;
  end if;

  select * into v_terms
  from private.customer_credit_terms t
  where t.account_id = new.account_id
    and t.is_enabled = true;

  if not found then
    return new;
  end if;

  insert into private.credit_sale_due_dates (
    transaction_id, account_id, business_id, terms_days, grace_days, due_at
  ) values (
    new.id,
    new.account_id,
    new.business_id,
    v_terms.terms_days,
    v_terms.grace_days,
    new.occurred_at + make_interval(days => v_terms.terms_days)
  )
  on conflict (transaction_id) do nothing;

  return new;
end;
$$;

revoke all on function private.capture_credit_sale_due_date() from public, anon, authenticated;

drop trigger if exists capture_credit_sale_due_date on public.ledger_transactions;
create trigger capture_credit_sale_due_date
after update of status on public.ledger_transactions
for each row
when (new.status = 'posted' and new.transaction_type = 'sale_on_account')
execute function private.capture_credit_sale_due_date();

create or replace function private.command_set_customer_credit_terms(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_terms_days integer,
  p_grace_days integer default 0,
  p_enabled boolean default true,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_business_id uuid;
  v_currency_code text;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if p_terms_days is null or p_terms_days < 0 or p_terms_days > 3650 then
    raise exception 'Credit terms days must be between 0 and 3650' using errcode = '22023';
  end if;
  if p_grace_days is null or p_grace_days < 0 or p_grace_days > 365 then
    raise exception 'Credit grace days must be between 0 and 365' using errcode = '22023';
  end if;

  select bc.business_id, ca.currency_code
    into v_business_id, v_currency_code
  from public.customer_accounts ca
  join public.business_customers bc on bc.id = ca.business_customer_id
  where ca.id = p_account_id
    and ca.status <> 'closed'
    and bc.status = 'active';

  if v_business_id is null or not private.can_manage_business(v_business_id, array['owner','manager']::text[]) then
    raise exception 'Credit terms management is not permitted' using errcode = '42501';
  end if;

  insert into private.customer_credit_terms (
    account_id, terms_days, grace_days, is_enabled, updated_by_user_id
  ) values (
    p_account_id, p_terms_days, p_grace_days, coalesce(p_enabled, true), v_user_id
  )
  on conflict (account_id) do update
  set terms_days = excluded.terms_days,
      grace_days = excluded.grace_days,
      is_enabled = excluded.is_enabled,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now();

  update public.business_customers bc
  set credit_enabled = coalesce(p_enabled, true), updated_at = now()
  from public.customer_accounts ca
  where ca.id = p_account_id and ca.business_customer_id = bc.id;

  insert into public.audit_events (
    business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data
  ) values (
    v_business_id, v_user_id, 'credit_terms.updated', 'customer_account', p_account_id, p_request_id,
    jsonb_build_object(
      'terms_days', p_terms_days,
      'grace_days', p_grace_days,
      'enabled', coalesce(p_enabled, true),
      'currency_code', v_currency_code
    )
  );

  return jsonb_build_object(
    'accountId', p_account_id,
    'termsDays', p_terms_days,
    'graceDays', p_grace_days,
    'enabled', coalesce(p_enabled, true),
    'currencyCode', v_currency_code
  );
end;
$$;

create or replace function private.query_today_followups(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_as_of date default current_date,
  p_due_soon_days integer default 7
)
returns table (
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  oldest_due_at timestamptz,
  effective_overdue_at timestamptz,
  follow_up_state text,
  days_overdue integer,
  last_movement_at timestamptz,
  terms_days integer,
  grace_days integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Follow-up queue access is not permitted' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Follow-up limit must be between 1 and 200' using errcode = '22023';
  end if;
  if p_due_soon_days < 0 or p_due_soon_days > 90 then
    raise exception 'Due-soon days must be between 0 and 90' using errcode = '22023';
  end if;

  return query
  with account_base as (
    select
      bc.id as business_customer_id,
      ci.id as customer_identity_id,
      ci.display_name,
      ci.phone_e164,
      ca.id as account_id,
      ca.currency_code,
      private.account_balance(ca.id) as balance_minor,
      ct.terms_days,
      ct.grace_days
    from public.business_customers bc
    join public.customer_identities ci on ci.id = bc.customer_identity_id
    join public.customer_accounts ca on ca.business_customer_id = bc.id and ca.status <> 'closed'
    join private.customer_credit_terms ct on ct.account_id = ca.id and ct.is_enabled = true
    where bc.business_id = p_business_id and bc.status = 'active'
  ), due as (
    select
      d.account_id,
      min(d.due_at) as oldest_due_at,
      min(d.due_at + make_interval(days => d.grace_days)) as effective_overdue_at
    from private.credit_sale_due_dates d
    join public.ledger_transactions lt on lt.id = d.transaction_id
    where d.business_id = p_business_id
      and lt.status = 'posted'
    group by d.account_id
  ), movement as (
    select lt.account_id, max(lt.occurred_at) as last_movement_at
    from public.ledger_transactions lt
    where lt.business_id = p_business_id and lt.status in ('posted','reversed')
    group by lt.account_id
  ), ranked as (
    select
      ab.*,
      d.oldest_due_at,
      d.effective_overdue_at,
      m.last_movement_at,
      case
        when ab.balance_minor <= 0 or d.oldest_due_at is null then 'clear'
        when d.effective_overdue_at::date < p_as_of then 'overdue'
        when d.oldest_due_at::date <= p_as_of then 'due_today'
        when d.oldest_due_at::date <= p_as_of + p_due_soon_days then 'due_soon'
        else 'clear'
      end as follow_up_state,
      case
        when ab.balance_minor > 0 and d.effective_overdue_at::date < p_as_of
          then (p_as_of - d.effective_overdue_at::date)::integer
        else 0
      end as days_overdue
    from account_base ab
    left join due d on d.account_id = ab.account_id
    left join movement m on m.account_id = ab.account_id
  )
  select
    r.business_customer_id,
    r.customer_identity_id,
    r.display_name,
    r.phone_e164,
    r.account_id,
    r.currency_code,
    r.balance_minor,
    r.oldest_due_at,
    r.effective_overdue_at,
    r.follow_up_state,
    r.days_overdue,
    r.last_movement_at,
    r.terms_days,
    r.grace_days
  from ranked r
  where r.follow_up_state <> 'clear'
  order by
    case r.follow_up_state when 'overdue' then 0 when 'due_today' then 1 when 'due_soon' then 2 else 3 end,
    r.days_overdue desc,
    r.oldest_due_at asc,
    r.display_name asc,
    r.account_id
  limit p_limit;
end;
$$;

create or replace function public.app_set_customer_credit_terms(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_terms_days integer,
  p_grace_days integer default 0,
  p_enabled boolean default true,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_set_customer_credit_terms(
    p_actor_user_id, p_account_id, p_terms_days, p_grace_days, p_enabled, p_request_id
  );
$$;

create or replace function public.app_list_today_followups(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_as_of date default current_date,
  p_due_soon_days integer default 7
)
returns table (
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  oldest_due_at timestamptz,
  effective_overdue_at timestamptz,
  follow_up_state text,
  days_overdue integer,
  last_movement_at timestamptz,
  terms_days integer,
  grace_days integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.query_today_followups(
    p_actor_user_id, p_business_id, p_limit, p_as_of, p_due_soon_days
  );
$$;

revoke all on function public.app_set_customer_credit_terms(uuid, uuid, integer, integer, boolean, text) from public, anon;
revoke all on function public.app_list_today_followups(uuid, uuid, integer, date, integer) from public, anon;
grant execute on function public.app_set_customer_credit_terms(uuid, uuid, integer, integer, boolean, text) to authenticated;
grant execute on function public.app_list_today_followups(uuid, uuid, integer, date, integer) to authenticated;

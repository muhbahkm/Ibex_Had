-- IBEX HAD — Phase 3 atomic application commands.
-- Public RPCs are SECURITY INVOKER wrappers. Privileged writes live in private,
-- non-exposed SECURITY DEFINER implementations and re-check auth.uid(), roles,
-- scope, currency, idempotency, and ledger invariants.

begin;

create or replace function private.require_actor(p_actor_user_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_actor_user_id is null or v_user_id <> p_actor_user_id then
    raise exception 'Authenticated actor mismatch' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function private.can_manage_business(
  p_business_id uuid,
  p_allowed_roles text[] default array['owner','manager','cashier']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.businesses b
      where b.id = p_business_id
        and b.status = 'active'
        and (
          b.owner_user_id = auth.uid()
          or exists (
            select 1
            from public.business_members bm
            where bm.business_id = b.id
              and bm.user_id = auth.uid()
              and bm.status = 'active'
              and bm.role = any(p_allowed_roles)
          )
        )
    );
$$;

create or replace function private.account_balance(p_account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case
      when le.direction = 'debit' then le.amount_minor
      else -le.amount_minor
    end
  ), 0)::bigint
  from public.ledger_entries le
  join public.ledger_transactions lt on lt.id = le.transaction_id
  where le.account_id = p_account_id
    and lt.status in ('posted', 'reversed');
$$;

create or replace function private.command_create_business(
  p_actor_user_id uuid,
  p_name text,
  p_country_code text,
  p_default_currency_code text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_business public.businesses;
begin
  v_user_id := private.require_actor(p_actor_user_id);

  if length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160 then
    raise exception 'Invalid business name' using errcode = '22023';
  end if;
  if p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Invalid country code' using errcode = '22023';
  end if;
  if p_default_currency_code is not null
     and not exists (select 1 from public.currencies c where c.code = p_default_currency_code and c.is_active) then
    raise exception 'Unsupported currency' using errcode = '22023';
  end if;

  insert into public.businesses (owner_user_id, name, country_code, default_currency_code)
  values (v_user_id, btrim(p_name), p_country_code, p_default_currency_code)
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business.id, v_user_id, 'owner', 'active')
  on conflict (business_id, user_id) do nothing;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_business.id,
    v_user_id,
    'business.created',
    'business',
    v_business.id,
    p_request_id,
    jsonb_build_object('name', v_business.name, 'country_code', v_business.country_code)
  );

  return jsonb_build_object(
    'id', v_business.id,
    'name', v_business.name,
    'defaultCurrencyCode', v_business.default_currency_code
  );
end;
$$;

create or replace function private.command_create_customer(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_display_name text,
  p_phone_e164 text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_identity public.customer_identities;
  v_relationship public.business_customers;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id) then
    raise exception 'Business mutation is not permitted' using errcode = '42501';
  end if;
  if length(btrim(p_display_name)) < 2 or length(btrim(p_display_name)) > 160 then
    raise exception 'Invalid customer name' using errcode = '22023';
  end if;
  if p_phone_e164 is not null and p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Invalid E.164 phone' using errcode = '22023';
  end if;

  insert into public.customer_identities (display_name, phone_e164, created_by_business_id)
  values (btrim(p_display_name), p_phone_e164, p_business_id)
  returning * into v_identity;

  insert into public.business_customers (business_id, customer_identity_id)
  values (p_business_id, v_identity.id)
  returning * into v_relationship;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    p_business_id,
    v_user_id,
    'customer.created',
    'business_customer',
    v_relationship.id,
    p_request_id,
    jsonb_build_object('customer_identity_id', v_identity.id, 'display_name', v_identity.display_name)
  );

  return jsonb_build_object(
    'customerIdentityId', v_identity.id,
    'businessCustomerId', v_relationship.id,
    'displayName', v_identity.display_name
  );
end;
$$;

create or replace function private.command_open_customer_account(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_currency_code text,
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
  v_account public.customer_accounts;
  v_was_inserted boolean := false;
begin
  v_user_id := private.require_actor(p_actor_user_id);

  select bc.business_id into v_business_id
  from public.business_customers bc
  where bc.id = p_business_customer_id and bc.status = 'active';

  if v_business_id is null or not private.can_manage_business(v_business_id) then
    raise exception 'Customer account mutation is not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.currencies c where c.code = p_currency_code and c.is_active) then
    raise exception 'Unsupported currency' using errcode = '22023';
  end if;

  select * into v_account
  from public.customer_accounts ca
  where ca.business_customer_id = p_business_customer_id
    and ca.currency_code = p_currency_code;

  if not found then
    insert into public.customer_accounts (business_customer_id, currency_code)
    values (p_business_customer_id, p_currency_code)
    returning * into v_account;
    v_was_inserted := true;
  end if;

  if v_was_inserted then
    insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
    values (
      v_business_id,
      v_user_id,
      'customer_account.opened',
      'customer_account',
      v_account.id,
      p_request_id,
      jsonb_build_object('currency_code', v_account.currency_code, 'business_customer_id', p_business_customer_id)
    );
  end if;

  return jsonb_build_object(
    'id', v_account.id,
    'businessCustomerId', v_account.business_customer_id,
    'currencyCode', v_account.currency_code
  );
end;
$$;

create or replace function private.command_post_movement(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_customer_identity_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount_minor bigint,
  p_currency_code text,
  p_idempotency_key text,
  p_occurred_at timestamptz default null,
  p_description text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_account_currency text;
  v_expected_business_id uuid;
  v_expected_customer_id uuid;
  v_transaction public.ledger_transactions;
  v_existing_direction text;
  v_existing_amount bigint;
  v_existing_currency text;
  v_balance bigint;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id) then
    raise exception 'Ledger posting is not permitted' using errcode = '42501';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Amount must be positive' using errcode = '22023';
  end if;
  if length(btrim(p_idempotency_key)) < 8 or length(btrim(p_idempotency_key)) > 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_transaction_type not in ('opening_balance','sale_on_account','receipt','disbursement','return','discount','adjustment') then
    raise exception 'Unsupported transaction type' using errcode = '22023';
  end if;
  if p_direction not in ('debit','credit') then
    raise exception 'Unsupported ledger direction' using errcode = '22023';
  end if;
  if p_transaction_type in ('sale_on_account','disbursement') and p_direction <> 'debit' then
    raise exception 'Transaction direction does not match type' using errcode = '22023';
  end if;
  if p_transaction_type in ('receipt','return','discount') and p_direction <> 'credit' then
    raise exception 'Transaction direction does not match type' using errcode = '22023';
  end if;

  select bc.business_id, bc.customer_identity_id, ca.currency_code
    into v_expected_business_id, v_expected_customer_id, v_account_currency
  from public.customer_accounts ca
  join public.business_customers bc on bc.id = ca.business_customer_id
  where ca.id = p_account_id
    and ca.status = 'open'
    and bc.status = 'active';

  if v_expected_business_id is null
     or v_expected_business_id <> p_business_id
     or v_expected_customer_id <> p_customer_identity_id then
    raise exception 'Movement scope does not match account' using errcode = '22023';
  end if;
  if v_account_currency <> p_currency_code then
    raise exception 'Movement currency does not match account' using errcode = '22023';
  end if;

  select * into v_transaction
  from public.ledger_transactions lt
  where lt.business_id = p_business_id
    and lt.source_type = 'api'
    and lt.idempotency_key = p_idempotency_key;

  if found then
    select le.direction, le.amount_minor, le.currency_code
      into v_existing_direction, v_existing_amount, v_existing_currency
    from public.ledger_entries le
    where le.transaction_id = v_transaction.id
    order by le.created_at, le.id
    limit 1;

    if v_transaction.account_id <> p_account_id
       or v_transaction.customer_identity_id <> p_customer_identity_id
       or v_transaction.transaction_type <> p_transaction_type
       or v_existing_direction is distinct from p_direction
       or v_existing_amount is distinct from p_amount_minor
       or v_existing_currency is distinct from p_currency_code then
      raise exception 'Idempotency key was already used for a different command' using errcode = '23505';
    end if;

    v_balance := private.account_balance(p_account_id);
    return jsonb_build_object(
      'transactionId', v_transaction.id,
      'accountId', p_account_id,
      'balanceMinor', v_balance::text,
      'currencyCode', p_currency_code
    );
  end if;

  insert into public.ledger_transactions (
    account_id, business_id, customer_identity_id, transaction_type,
    occurred_at, description, source_type, idempotency_key, created_by_user_id
  ) values (
    p_account_id, p_business_id, p_customer_identity_id, p_transaction_type,
    coalesce(p_occurred_at, now()), nullif(btrim(p_description), ''), 'api', btrim(p_idempotency_key), v_user_id
  ) returning * into v_transaction;

  insert into public.ledger_entries (transaction_id, account_id, direction, amount_minor, currency_code)
  values (v_transaction.id, p_account_id, p_direction, p_amount_minor, p_currency_code);

  update public.ledger_transactions
  set status = 'posted', posted_at = now(), posted_by_user_id = v_user_id
  where id = v_transaction.id
  returning * into v_transaction;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    p_business_id,
    v_user_id,
    'ledger_transaction.posted',
    'ledger_transaction',
    v_transaction.id,
    p_request_id,
    jsonb_build_object(
      'transaction_type', p_transaction_type,
      'direction', p_direction,
      'amount_minor', p_amount_minor::text,
      'currency_code', p_currency_code,
      'account_id', p_account_id
    )
  );

  v_balance := private.account_balance(p_account_id);
  return jsonb_build_object(
    'transactionId', v_transaction.id,
    'accountId', p_account_id,
    'balanceMinor', v_balance::text,
    'currencyCode', p_currency_code
  );
end;
$$;

create or replace function private.command_reverse_transaction(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_idempotency_key text,
  p_occurred_at timestamptz default null,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_original public.ledger_transactions;
  v_reversal public.ledger_transactions;
  v_existing_by_key public.ledger_transactions;
  v_balance bigint;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if length(btrim(p_idempotency_key)) < 8 or length(btrim(p_idempotency_key)) > 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  select * into v_original
  from public.ledger_transactions lt
  where lt.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_business(v_original.business_id, array['owner','manager']::text[]) then
    raise exception 'Transaction reversal is not permitted' using errcode = '42501';
  end if;

  select * into v_existing_by_key
  from public.ledger_transactions lt
  where lt.business_id = v_original.business_id
    and lt.source_type = 'api'
    and lt.idempotency_key = p_idempotency_key;

  if found and (
    v_existing_by_key.transaction_type <> 'reversal'
    or v_existing_by_key.reversal_of_transaction_id is distinct from p_transaction_id
  ) then
    raise exception 'Idempotency key was already used for a different command' using errcode = '23505';
  end if;

  select * into v_reversal
  from public.ledger_transactions r
  where r.reversal_of_transaction_id = p_transaction_id;

  if found then
    v_balance := private.account_balance(v_original.account_id);
    return jsonb_build_object(
      'transactionId', v_reversal.id,
      'accountId', v_original.account_id,
      'balanceMinor', v_balance::text,
      'currencyCode', (select ca.currency_code from public.customer_accounts ca where ca.id = v_original.account_id)
    );
  end if;

  if v_original.status <> 'posted' then
    raise exception 'Only posted transactions can be reversed' using errcode = '22023';
  end if;

  insert into public.ledger_transactions (
    account_id, business_id, customer_identity_id, transaction_type,
    occurred_at, description, source_type, idempotency_key,
    created_by_user_id, reversal_of_transaction_id
  ) values (
    v_original.account_id,
    v_original.business_id,
    v_original.customer_identity_id,
    'reversal',
    coalesce(p_occurred_at, now()),
    coalesce(nullif(btrim(p_reason), ''), 'Reversal'),
    'api',
    btrim(p_idempotency_key),
    v_user_id,
    v_original.id
  ) returning * into v_reversal;

  insert into public.ledger_entries (transaction_id, account_id, direction, amount_minor, currency_code)
  select
    v_reversal.id,
    le.account_id,
    case when le.direction = 'debit' then 'credit' else 'debit' end,
    le.amount_minor,
    le.currency_code
  from public.ledger_entries le
  where le.transaction_id = v_original.id;

  update public.ledger_transactions
  set status = 'posted', posted_at = now(), posted_by_user_id = v_user_id
  where id = v_reversal.id
  returning * into v_reversal;

  update public.ledger_transactions
  set status = 'reversed'
  where id = v_original.id;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_original.business_id,
    v_user_id,
    'ledger_transaction.reversed',
    'ledger_transaction',
    v_original.id,
    p_request_id,
    jsonb_build_object('reversal_transaction_id', v_reversal.id, 'reason', p_reason)
  );

  v_balance := private.account_balance(v_original.account_id);
  return jsonb_build_object(
    'transactionId', v_reversal.id,
    'accountId', v_original.account_id,
    'balanceMinor', v_balance::text,
    'currencyCode', (select ca.currency_code from public.customer_accounts ca where ca.id = v_original.account_id)
  );
end;
$$;

create or replace function private.command_get_statement(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_limit integer default 50,
  p_before_occurred_at timestamptz default null
)
returns table (
  transaction_id uuid,
  transaction_type text,
  occurred_at timestamptz,
  description text,
  effect_minor bigint,
  balance_after_minor bigint,
  currency_code text
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
      lt.transaction_type,
      lt.occurred_at,
      lt.description,
      ca.currency_code,
      sum(case when le.direction = 'debit' then le.amount_minor else -le.amount_minor end)::bigint as effect_minor
    from public.ledger_transactions lt
    join public.customer_accounts ca on ca.id = lt.account_id
    join public.ledger_entries le on le.transaction_id = lt.id
    where lt.account_id = p_account_id
      and lt.status in ('posted','reversed')
    group by lt.id, lt.transaction_type, lt.occurred_at, lt.description, ca.currency_code
  ), running as (
    select
      e.*,
      sum(e.effect_minor) over (order by e.occurred_at, e.id rows unbounded preceding)::bigint as balance_after_minor
    from effects e
  )
  select
    r.id,
    r.transaction_type,
    r.occurred_at,
    r.description,
    r.effect_minor,
    r.balance_after_minor,
    r.currency_code
  from running r
  where p_before_occurred_at is null or r.occurred_at < p_before_occurred_at
  order by r.occurred_at desc, r.id desc
  limit p_limit;
end;
$$;

-- Data API wrappers. These perform no privileged writes themselves.
create or replace function public.app_create_business(
  p_actor_user_id uuid,
  p_name text,
  p_country_code text,
  p_default_currency_code text default null,
  p_request_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.command_create_business(p_actor_user_id, p_name, p_country_code, p_default_currency_code, p_request_id); $$;

create or replace function public.app_create_customer(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_display_name text,
  p_phone_e164 text default null,
  p_request_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.command_create_customer(p_actor_user_id, p_business_id, p_display_name, p_phone_e164, p_request_id); $$;

create or replace function public.app_open_customer_account(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_currency_code text,
  p_request_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.command_open_customer_account(p_actor_user_id, p_business_customer_id, p_currency_code, p_request_id); $$;

create or replace function public.app_post_movement(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_customer_identity_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount_minor bigint,
  p_currency_code text,
  p_idempotency_key text,
  p_occurred_at timestamptz default null,
  p_description text default null,
  p_request_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select private.command_post_movement(
    p_actor_user_id, p_business_id, p_customer_identity_id, p_account_id,
    p_transaction_type, p_direction, p_amount_minor, p_currency_code,
    p_idempotency_key, p_occurred_at, p_description, p_request_id
  );
$$;

create or replace function public.app_reverse_transaction(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_idempotency_key text,
  p_occurred_at timestamptz default null,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select private.command_reverse_transaction(
    p_actor_user_id, p_transaction_id, p_idempotency_key,
    p_occurred_at, p_reason, p_request_id
  );
$$;

create or replace function public.app_get_statement(
  p_actor_user_id uuid,
  p_account_id uuid,
  p_limit integer default 50,
  p_before_occurred_at timestamptz default null
)
returns table (
  transaction_id uuid,
  transaction_type text,
  occurred_at timestamptz,
  description text,
  effect_minor bigint,
  balance_after_minor bigint,
  currency_code text
)
language sql stable security invoker set search_path = ''
as $$
  select * from private.command_get_statement(p_actor_user_id, p_account_id, p_limit, p_before_occurred_at);
$$;

-- Private implementations are not exposed by PostgREST because the private schema
-- is not exposed, even though authenticated needs EXECUTE for invoker wrappers.
revoke all on function private.require_actor(uuid) from public, anon;
revoke all on function private.can_manage_business(uuid, text[]) from public, anon;
revoke all on function private.account_balance(uuid) from public, anon;
revoke all on function private.command_create_business(uuid,text,text,text,text) from public, anon;
revoke all on function private.command_create_customer(uuid,uuid,text,text,text) from public, anon;
revoke all on function private.command_open_customer_account(uuid,uuid,text,text) from public, anon;
revoke all on function private.command_post_movement(uuid,uuid,uuid,uuid,text,text,bigint,text,text,timestamptz,text,text) from public, anon;
revoke all on function private.command_reverse_transaction(uuid,uuid,text,timestamptz,text,text) from public, anon;
revoke all on function private.command_get_statement(uuid,uuid,integer,timestamptz) from public, anon;

grant execute on function private.require_actor(uuid) to authenticated, service_role;
grant execute on function private.can_manage_business(uuid, text[]) to authenticated, service_role;
grant execute on function private.account_balance(uuid) to authenticated, service_role;
grant execute on function private.command_create_business(uuid,text,text,text,text) to authenticated, service_role;
grant execute on function private.command_create_customer(uuid,uuid,text,text,text) to authenticated, service_role;
grant execute on function private.command_open_customer_account(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function private.command_post_movement(uuid,uuid,uuid,uuid,text,text,bigint,text,text,timestamptz,text,text) to authenticated, service_role;
grant execute on function private.command_reverse_transaction(uuid,uuid,text,timestamptz,text,text) to authenticated, service_role;
grant execute on function private.command_get_statement(uuid,uuid,integer,timestamptz) to authenticated, service_role;

revoke all on function public.app_create_business(uuid,text,text,text,text) from public, anon;
revoke all on function public.app_create_customer(uuid,uuid,text,text,text) from public, anon;
revoke all on function public.app_open_customer_account(uuid,uuid,text,text) from public, anon;
revoke all on function public.app_post_movement(uuid,uuid,uuid,uuid,text,text,bigint,text,text,timestamptz,text,text) from public, anon;
revoke all on function public.app_reverse_transaction(uuid,uuid,text,timestamptz,text,text) from public, anon;
revoke all on function public.app_get_statement(uuid,uuid,integer,timestamptz) from public, anon;

grant execute on function public.app_create_business(uuid,text,text,text,text) to authenticated, service_role;
grant execute on function public.app_create_customer(uuid,uuid,text,text,text) to authenticated, service_role;
grant execute on function public.app_open_customer_account(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.app_post_movement(uuid,uuid,uuid,uuid,text,text,bigint,text,text,timestamptz,text,text) to authenticated, service_role;
grant execute on function public.app_reverse_transaction(uuid,uuid,text,timestamptz,text,text) to authenticated, service_role;
grant execute on function public.app_get_statement(uuid,uuid,integer,timestamptz) to authenticated, service_role;

comment on function public.app_post_movement(uuid,uuid,uuid,uuid,text,text,bigint,text,text,timestamptz,text,text) is
  'Atomic application command: validates actor/scope/idempotency, writes draft+entry, posts transaction, audits, and returns deterministic balance.';
comment on function public.app_reverse_transaction(uuid,uuid,text,timestamptz,text,text) is
  'Atomic reversal command: exactly negates a posted transaction, posts the reversal, marks the original reversed, and audits.';

commit;

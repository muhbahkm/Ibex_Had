-- IBEX HAD — Ledger Core Schema v1
-- Source of truth: GitHub migration history.
-- Balance convention: debit increases the amount owed to the business; credit decreases it.

begin;

create schema if not exists private;
revoke all on schema private from public;

-- Opt in to explicit Data API grants for future public objects.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

create table public.currencies (
  code text primary key,
  exponent smallint not null check (exponent between 0 and 6),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint currencies_code_format check (code ~ '^[A-Z]{3}$')
);

insert into public.currencies (code, exponent, name)
values
  ('YER', 0, 'Yemeni Rial'),
  ('SAR', 2, 'Saudi Riyal'),
  ('USD', 2, 'US Dollar');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone_e164 text,
  phone_verified_at timestamptz,
  locale text not null default 'ar',
  timezone text not null default 'Asia/Aden',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
create unique index profiles_phone_e164_uidx on public.profiles (phone_e164) where phone_e164 is not null;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  default_currency_code text references public.currencies(code) on delete restrict,
  country_code text not null default 'YE' check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index businesses_slug_uidx on public.businesses (lower(slug)) where slug is not null;
create index businesses_owner_user_idx on public.businesses (owner_user_id);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'cashier', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint business_members_business_user_unique unique (business_id, user_id),
  constraint business_members_revoked_state check ((status = 'revoked') = (revoked_at is not null))
);
create index business_members_user_status_idx on public.business_members (user_id, status);
create index business_members_business_status_idx on public.business_members (business_id, status);

create table public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  claimed_user_id uuid references auth.users(id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 2 and 160),
  phone_e164 text,
  email text,
  identity_type text not null default 'person' check (identity_type in ('person', 'organization')),
  created_by_business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_identities_phone_e164_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
create index customer_identities_claimed_user_idx on public.customer_identities (claimed_user_id) where claimed_user_id is not null;
create index customer_identities_phone_idx on public.customer_identities (phone_e164) where phone_e164 is not null;

create table public.business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_identity_id uuid not null references public.customer_identities(id) on delete restrict,
  customer_code text,
  status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
  notes_private text,
  credit_enabled boolean not null default false,
  credit_limit_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_customers_business_identity_unique unique (business_id, customer_identity_id)
);
create index business_customers_business_idx on public.business_customers (business_id);
create index business_customers_identity_idx on public.business_customers (customer_identity_id);

create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  business_customer_id uuid not null references public.business_customers(id) on delete restrict,
  currency_code text not null references public.currencies(code) on delete restrict,
  status text not null default 'open' check (status in ('open', 'frozen', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  cached_balance_minor bigint,
  balance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_accounts_relationship_currency_unique unique (business_customer_id, currency_code),
  constraint customer_accounts_closed_state check ((status = 'closed') = (closed_at is not null))
);
create index customer_accounts_business_customer_idx on public.customer_accounts (business_customer_id);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_identity_id uuid not null references public.customer_identities(id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'opening_balance', 'sale_on_account', 'receipt', 'disbursement',
    'return', 'discount', 'adjustment', 'reversal'
  )),
  status text not null default 'draft' check (status in ('draft', 'posted', 'reversed', 'voided')),
  occurred_at timestamptz not null default now(),
  posted_at timestamptz,
  description text,
  reference_number text,
  source_type text not null default 'manual' check (source_type in ('manual', 'import', 'api', 'sanad', 'integration', 'system')),
  source_name text,
  external_reference text,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 200),
  created_by_user_id uuid references auth.users(id) on delete set null,
  posted_by_user_id uuid references auth.users(id) on delete set null,
  reversal_of_transaction_id uuid references public.ledger_transactions(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_transactions_idempotency_unique unique (business_id, source_type, idempotency_key),
  constraint ledger_transactions_reversal_shape check (
    (transaction_type = 'reversal' and reversal_of_transaction_id is not null)
    or (transaction_type <> 'reversal' and reversal_of_transaction_id is null)
  ),
  constraint ledger_transactions_posted_at_state check (
    (status in ('posted', 'reversed') and posted_at is not null)
    or (status in ('draft', 'voided'))
  )
);
create unique index ledger_transactions_one_reversal_uidx
  on public.ledger_transactions (reversal_of_transaction_id)
  where reversal_of_transaction_id is not null;
create index ledger_transactions_account_time_idx on public.ledger_transactions (account_id, occurred_at desc);
create index ledger_transactions_business_time_idx on public.ledger_transactions (business_id, occurred_at desc);
create index ledger_transactions_customer_time_idx on public.ledger_transactions (customer_identity_id, occurred_at desc);
create index ledger_transactions_status_idx on public.ledger_transactions (status);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id uuid not null references public.customer_accounts(id) on delete restrict,
  direction text not null check (direction in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null references public.currencies(code) on delete restrict,
  created_at timestamptz not null default now()
);
create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (account_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text,
  created_at timestamptz not null default now(),
  constraint documents_storage_object_unique unique (storage_bucket, storage_path)
);
create index documents_business_idx on public.documents (business_id);

create table public.transaction_documents (
  transaction_id uuid not null references public.ledger_transactions(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, document_id)
);
create index transaction_documents_document_idx on public.transaction_documents (document_id);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_identity_id uuid not null references public.customer_identities(id) on delete restrict,
  opened_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'rejected', 'withdrawn')),
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  resolution_note text,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_resolution_state check (
    (status in ('resolved', 'rejected') and resolved_at is not null)
    or (status in ('open', 'under_review', 'withdrawn'))
  )
);
create index disputes_transaction_idx on public.disputes (transaction_id);
create index disputes_business_status_idx on public.disputes (business_id, status);
create index disputes_customer_status_idx on public.disputes (customer_identity_id, status);

create table public.external_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked', 'error')),
  external_account_ref text,
  config_metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_integrations_identity_unique unique (business_id, provider, external_account_ref)
);
create index external_integrations_business_idx on public.external_integrations (business_id);

create table public.external_references (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.external_integrations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  object_type text not null check (object_type in ('customer_identity', 'business_customer', 'account', 'transaction')),
  internal_id uuid not null,
  external_id text not null,
  external_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint external_references_external_unique unique (integration_id, object_type, external_id),
  constraint external_references_internal_unique unique (integration_id, object_type, internal_id)
);
create index external_references_business_idx on public.external_references (business_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_business_time_idx on public.audit_events (business_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id);

-- Generic updated_at trigger.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function private.set_updated_at();
create trigger customer_identities_set_updated_at before update on public.customer_identities
for each row execute function private.set_updated_at();
create trigger business_customers_set_updated_at before update on public.business_customers
for each row execute function private.set_updated_at();
create trigger customer_accounts_set_updated_at before update on public.customer_accounts
for each row execute function private.set_updated_at();
create trigger ledger_transactions_set_updated_at before update on public.ledger_transactions
for each row execute function private.set_updated_at();
create trigger disputes_set_updated_at before update on public.disputes
for each row execute function private.set_updated_at();
create trigger external_integrations_set_updated_at before update on public.external_integrations
for each row execute function private.set_updated_at();

-- Scope consistency: transaction denormalized identifiers must match its account relationship.
create or replace function private.validate_transaction_scope()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  expected_business_id uuid;
  expected_customer_identity_id uuid;
  original_account_id uuid;
  original_business_id uuid;
  original_customer_identity_id uuid;
  original_status text;
begin
  select bc.business_id, bc.customer_identity_id
    into expected_business_id, expected_customer_identity_id
  from public.customer_accounts ca
  join public.business_customers bc on bc.id = ca.business_customer_id
  where ca.id = new.account_id;

  if expected_business_id is null then
    raise exception 'Unknown customer account %', new.account_id;
  end if;

  if new.business_id is distinct from expected_business_id
     or new.customer_identity_id is distinct from expected_customer_identity_id then
    raise exception 'Transaction scope does not match account relationship';
  end if;

  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'New transactions must start as draft';
  end if;

  if new.transaction_type = 'reversal' then
    select account_id, business_id, customer_identity_id, status
      into original_account_id, original_business_id, original_customer_identity_id, original_status
    from public.ledger_transactions
    where id = new.reversal_of_transaction_id;

    if original_account_id is null then
      raise exception 'Reversal target does not exist';
    end if;
    if original_status <> 'posted' then
      raise exception 'Only posted transactions can be reversed';
    end if;
    if original_account_id <> new.account_id
       or original_business_id <> new.business_id
       or original_customer_identity_id <> new.customer_identity_id then
      raise exception 'Reversal scope must match original transaction';
    end if;
  end if;

  return new;
end;
$$;

create trigger ledger_transactions_validate_scope
before insert or update on public.ledger_transactions
for each row execute function private.validate_transaction_scope();

-- Ledger entry integrity and currency/account consistency.
create or replace function private.validate_ledger_entry()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  transaction_account_id uuid;
  transaction_status text;
  account_currency_code text;
begin
  select account_id, status
    into transaction_account_id, transaction_status
  from public.ledger_transactions
  where id = new.transaction_id;

  if transaction_account_id is null then
    raise exception 'Unknown ledger transaction %', new.transaction_id;
  end if;
  if transaction_status <> 'draft' then
    raise exception 'Entries may only be added while transaction is draft';
  end if;
  if new.account_id <> transaction_account_id then
    raise exception 'Ledger entry account must match transaction account';
  end if;

  select currency_code into account_currency_code
  from public.customer_accounts
  where id = new.account_id;

  if new.currency_code <> account_currency_code then
    raise exception 'Ledger entry currency must match account currency';
  end if;

  return new;
end;
$$;

create trigger ledger_entries_validate
before insert on public.ledger_entries
for each row execute function private.validate_ledger_entry();

create or replace function private.prevent_ledger_entry_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Ledger entries are immutable; use reversal/adjustment';
end;
$$;

create trigger ledger_entries_no_update
before update on public.ledger_entries
for each row execute function private.prevent_ledger_entry_mutation();
create trigger ledger_entries_no_delete
before delete on public.ledger_entries
for each row execute function private.prevent_ledger_entry_mutation();

-- Transaction lifecycle and posting invariants.
create or replace function private.validate_transaction_lifecycle()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  net_effect bigint;
  original_effect bigint;
begin
  if old.status in ('posted', 'reversed') then
    if new.account_id is distinct from old.account_id
       or new.business_id is distinct from old.business_id
       or new.customer_identity_id is distinct from old.customer_identity_id
       or new.transaction_type is distinct from old.transaction_type
       or new.occurred_at is distinct from old.occurred_at
       or new.posted_at is distinct from old.posted_at
       or new.description is distinct from old.description
       or new.reference_number is distinct from old.reference_number
       or new.source_type is distinct from old.source_type
       or new.source_name is distinct from old.source_name
       or new.external_reference is distinct from old.external_reference
       or new.idempotency_key is distinct from old.idempotency_key
       or new.created_by_user_id is distinct from old.created_by_user_id
       or new.posted_by_user_id is distinct from old.posted_by_user_id
       or new.reversal_of_transaction_id is distinct from old.reversal_of_transaction_id
       or new.metadata is distinct from old.metadata
       or new.created_at is distinct from old.created_at then
      raise exception 'Posted financial transactions are immutable';
    end if;
  end if;

  if old.status = 'draft' and new.status = 'posted' then
    if new.posted_at is null then
      raise exception 'posted_at is required when posting a transaction';
    end if;

    select coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0)
      into net_effect
    from public.ledger_entries
    where transaction_id = old.id;

    if net_effect = 0 then
      raise exception 'Posted transaction must have a non-zero ledger effect';
    end if;

    if old.transaction_type in ('sale_on_account', 'disbursement') and net_effect <= 0 then
      raise exception '% must increase customer balance', old.transaction_type;
    end if;
    if old.transaction_type in ('receipt', 'return', 'discount') and net_effect >= 0 then
      raise exception '% must decrease customer balance', old.transaction_type;
    end if;

    if old.transaction_type = 'reversal' then
      select coalesce(sum(case when le.direction = 'debit' then le.amount_minor else -le.amount_minor end), 0)
        into original_effect
      from public.ledger_entries le
      join public.ledger_transactions lt on lt.id = le.transaction_id
      where lt.id = old.reversal_of_transaction_id and lt.status = 'posted';

      if original_effect = 0 or net_effect <> -original_effect then
        raise exception 'Reversal must exactly negate the posted original transaction';
      end if;
    end if;
  elsif old.status = 'draft' and new.status = 'voided' then
    if exists (select 1 from public.ledger_entries where transaction_id = old.id) then
      raise exception 'Draft with ledger entries cannot be voided; remove draft entries before voiding';
    end if;
  elsif old.status = 'posted' and new.status = 'reversed' then
    if not exists (
      select 1 from public.ledger_transactions r
      where r.reversal_of_transaction_id = old.id and r.status = 'posted'
    ) then
      raise exception 'Original can be marked reversed only after its reversal is posted';
    end if;
  elsif new.status is distinct from old.status then
    raise exception 'Invalid transaction status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger ledger_transactions_validate_lifecycle
before update on public.ledger_transactions
for each row execute function private.validate_transaction_lifecycle();

-- Immutable audit history.
create or replace function private.prevent_audit_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Audit events are immutable';
end;
$$;
create trigger audit_events_no_update before update on public.audit_events
for each row execute function private.prevent_audit_event_mutation();
create trigger audit_events_no_delete before delete on public.audit_events
for each row execute function private.prevent_audit_event_mutation();

-- RLS helper functions live in a non-exposed schema.
create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.businesses b
      left join public.business_members bm
        on bm.business_id = b.id
       and bm.user_id = (select auth.uid())
       and bm.status = 'active'
      where b.id = p_business_id
        and (b.owner_user_id = (select auth.uid()) or bm.id is not null)
    );
$$;

create or replace function private.is_customer_owner(p_customer_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.customer_identities ci
      where ci.id = p_customer_identity_id
        and ci.claimed_user_id = (select auth.uid())
    );
$$;

create or replace function private.can_access_customer_identity(p_customer_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select private.is_customer_owner(p_customer_identity_id)
    or exists (
      select 1
      from public.business_customers bc
      where bc.customer_identity_id = p_customer_identity_id
        and private.is_business_member(bc.business_id)
    );
$$;

create or replace function private.can_access_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.customer_accounts ca
    join public.business_customers bc on bc.id = ca.business_customer_id
    where ca.id = p_account_id
      and (private.is_business_member(bc.business_id) or private.is_customer_owner(bc.customer_identity_id))
  );
$$;

create or replace function private.can_access_transaction(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1
    from public.ledger_transactions lt
    where lt.id = p_transaction_id
      and (private.is_business_member(lt.business_id) or private.is_customer_owner(lt.customer_identity_id))
  );
$$;

create or replace function private.can_access_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_document_id and private.is_business_member(d.business_id)
  ) or exists (
    select 1
    from public.transaction_documents td
    where td.document_id = p_document_id
      and private.can_access_transaction(td.transaction_id)
  );
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.is_customer_owner(uuid) to authenticated;
grant execute on function private.can_access_customer_identity(uuid) to authenticated;
grant execute on function private.can_access_account(uuid) to authenticated;
grant execute on function private.can_access_transaction(uuid) to authenticated;
grant execute on function private.can_access_document(uuid) to authenticated;

-- Row Level Security.
alter table public.currencies enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customer_identities enable row level security;
alter table public.business_customers enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.documents enable row level security;
alter table public.transaction_documents enable row level security;
alter table public.disputes enable row level security;
alter table public.external_integrations enable row level security;
alter table public.external_references enable row level security;
alter table public.audit_events enable row level security;

create policy currencies_read on public.currencies
for select to anon, authenticated using (is_active = true);

create policy profiles_read_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy businesses_read_member on public.businesses
for select to authenticated using ((select private.is_business_member(id)));

create policy business_members_read_business on public.business_members
for select to authenticated using ((select private.is_business_member(business_id)));

create policy customer_identities_read_accessible on public.customer_identities
for select to authenticated using ((select private.can_access_customer_identity(id)));

create policy business_customers_read_accessible on public.business_customers
for select to authenticated using (
  (select private.is_business_member(business_id))
  or (select private.is_customer_owner(customer_identity_id))
);

create policy customer_accounts_read_accessible on public.customer_accounts
for select to authenticated using ((select private.can_access_account(id)));

create policy ledger_transactions_read_accessible on public.ledger_transactions
for select to authenticated using (
  (select private.is_business_member(business_id))
  or (select private.is_customer_owner(customer_identity_id))
);

create policy ledger_entries_read_accessible on public.ledger_entries
for select to authenticated using ((select private.can_access_transaction(transaction_id)));

create policy documents_read_accessible on public.documents
for select to authenticated using ((select private.can_access_document(id)));

create policy transaction_documents_read_accessible on public.transaction_documents
for select to authenticated using ((select private.can_access_transaction(transaction_id)));

create policy disputes_read_accessible on public.disputes
for select to authenticated using (
  (select private.is_business_member(business_id))
  or (select private.is_customer_owner(customer_identity_id))
);

create policy external_integrations_read_member on public.external_integrations
for select to authenticated using ((select private.is_business_member(business_id)));

create policy external_references_read_member on public.external_references
for select to authenticated using ((select private.is_business_member(business_id)));

create policy audit_events_read_member on public.audit_events
for select to authenticated using (business_id is not null and (select private.is_business_member(business_id)));

-- Explicit Data API grants. Financial writes intentionally remain unavailable to clients.
grant select on public.currencies to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select on public.customer_identities to authenticated;
grant select on public.business_customers to authenticated;
grant select on public.customer_accounts to authenticated;
grant select on public.ledger_transactions to authenticated;
grant select on public.ledger_entries to authenticated;
grant select on public.documents to authenticated;
grant select on public.transaction_documents to authenticated;
grant select on public.disputes to authenticated;
grant select on public.external_integrations to authenticated;
grant select on public.external_references to authenticated;
grant select on public.audit_events to authenticated;

-- Security-invoker balance view. The ledger is the truth; cache fields are optional derivatives.
create view public.customer_account_balances
with (security_invoker = true)
as
select
  ca.id as account_id,
  ca.business_customer_id,
  ca.currency_code,
  coalesce(sum(
    case
      when lt.status in ('posted', 'reversed') and le.direction = 'debit' then le.amount_minor
      when lt.status in ('posted', 'reversed') and le.direction = 'credit' then -le.amount_minor
      else 0
    end
  ), 0)::bigint as balance_minor
from public.customer_accounts ca
left join public.ledger_transactions lt on lt.account_id = ca.id and lt.status in ('posted', 'reversed')
left join public.ledger_entries le on le.transaction_id = lt.id
where private.can_access_account(ca.id)
group by ca.id, ca.business_customer_id, ca.currency_code;

grant select on public.customer_account_balances to authenticated;

commit;

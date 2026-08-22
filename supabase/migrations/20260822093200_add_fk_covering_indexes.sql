-- IBEX HAD — cover foreign-key columns reported by Supabase Performance Advisor.
-- Indexes on currently-empty tables may still appear as unused until real workloads exist.

begin;

create index audit_events_actor_user_idx
  on public.audit_events (actor_user_id)
  where actor_user_id is not null;

create index businesses_default_currency_idx
  on public.businesses (default_currency_code)
  where default_currency_code is not null;

create index customer_accounts_currency_idx
  on public.customer_accounts (currency_code);

create index customer_identities_created_by_business_idx
  on public.customer_identities (created_by_business_id)
  where created_by_business_id is not null;

create index disputes_opened_by_user_idx
  on public.disputes (opened_by_user_id)
  where opened_by_user_id is not null;

create index disputes_resolved_by_user_idx
  on public.disputes (resolved_by_user_id)
  where resolved_by_user_id is not null;

create index documents_uploaded_by_user_idx
  on public.documents (uploaded_by_user_id)
  where uploaded_by_user_id is not null;

create index external_integrations_created_by_user_idx
  on public.external_integrations (created_by_user_id)
  where created_by_user_id is not null;

create index ledger_entries_currency_idx
  on public.ledger_entries (currency_code);

create index ledger_transactions_created_by_user_idx
  on public.ledger_transactions (created_by_user_id)
  where created_by_user_id is not null;

create index ledger_transactions_posted_by_user_idx
  on public.ledger_transactions (posted_by_user_id)
  where posted_by_user_id is not null;

commit;

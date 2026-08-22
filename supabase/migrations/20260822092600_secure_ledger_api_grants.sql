-- IBEX HAD — explicit Data API hardening for Ledger Core v1.

begin;

-- Profile security fields are not user-editable. Phase 2 will introduce a
-- dedicated onboarding/update service that derives phone verification from Auth.
revoke insert, update on public.profiles from authenticated;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

-- The server-side application role can perform domain writes. RLS is still the
-- primary guard for end-user clients; service-role credentials are never public.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

-- Keep end-user financial access read-only until the Application/Domain command
-- layer is implemented. Writes will be exposed through narrow, reviewed commands.
revoke insert, update, delete on public.businesses from authenticated;
revoke insert, update, delete on public.business_members from authenticated;
revoke insert, update, delete on public.customer_identities from authenticated;
revoke insert, update, delete on public.business_customers from authenticated;
revoke insert, update, delete on public.customer_accounts from authenticated;
revoke insert, update, delete on public.ledger_transactions from authenticated;
revoke insert, update, delete on public.ledger_entries from authenticated;
revoke insert, update, delete on public.documents from authenticated;
revoke insert, update, delete on public.transaction_documents from authenticated;
revoke insert, update, delete on public.disputes from authenticated;
revoke insert, update, delete on public.external_integrations from authenticated;
revoke insert, update, delete on public.external_references from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;

commit;

# IBEX HAD — Ledger Core v1

## Status

Ledger Core Schema v1 is deployed to the production Supabase project `Ibex_Had v1` in Mumbai (`ap-south-1`) and has passed the Phase 1 verification checkpoint.

## Financial convention

IBEX HAD uses one internal balance convention everywhere:

- Positive balance = the customer owes the business.
- Negative balance = the business owes the customer.
- Zero = settled.
- Debit entries increase the customer balance.
- Credit entries decrease the customer balance.

Currencies are never implicitly aggregated or converted. YER, SAR, USD, and future currencies remain separate ledgers unless a reporting layer explicitly supplies an exchange rate, source, and timestamp.

## Monetary storage

Amounts are stored as integer minor units in PostgreSQL `bigint`; floating-point money is prohibited.

Initial currency metadata:

- YER exponent: 0
- SAR exponent: 2
- USD exponent: 2

Application/API boundaries must preserve integer precision. Financial values must not be converted through an unsafe JavaScript floating-point path; domain contracts will serialize monetary integer values safely when the API layer is introduced.

## Core entities

The v1 schema contains:

- `currencies`
- `profiles`
- `businesses`
- `business_members`
- `customer_identities`
- `business_customers`
- `customer_accounts`
- `ledger_transactions`
- `ledger_entries`
- `documents`
- `transaction_documents`
- `disputes`
- `external_integrations`
- `external_references`
- `audit_events`

`customer_account_balances` is a security-invoker derived view. It is not a source of financial truth.

## Transaction lifecycle

Transactions start as `draft`.

Supported states are:

```text
draft -> posted
  \-> voided   (only while still a clean draft)
posted -> reversed   (only after a matching posted reversal exists)
```

Posted financial facts are immutable. Corrections are represented as new explicit reversal/adjustment facts rather than silent edits.

## Ledger invariants enforced in PostgreSQL

- New transactions must start as draft.
- Transaction business/customer scope must match the selected customer account.
- Entries may only be added while a transaction is draft.
- Entry account must match transaction account.
- Entry currency must match account currency.
- Entry amount must be positive.
- Ledger entries cannot be updated or deleted.
- A posted transaction must have a non-zero net ledger effect.
- `sale_on_account` and `disbursement` must increase the customer balance.
- `receipt`, `return`, and `discount` must decrease the customer balance.
- A reversal must target a posted transaction in the same scope.
- A reversal must exactly negate the original transaction's ledger effect.
- One original transaction can have at most one reversal transaction.
- An original can be marked `reversed` only after its reversal is posted.
- Posted/reversed financial fields cannot be silently mutated.
- Audit events cannot be updated or deleted.
- Idempotency is unique within `(business_id, source_type, idempotency_key)`.

## Authorization boundary

All 15 public tables have RLS enabled.

Authenticated end-user clients currently have read-only access according to business membership or customer ownership. They cannot directly insert/update/delete financial transactions or ledger entries.

Financial/domain writes are reserved for the future Application/Domain command layer. Service-role credentials remain server-only.

RLS helper functions live in the non-exposed `private` schema, and privileged helper execution is explicitly controlled.

The balance view is created with `security_invoker=true` so it respects the caller's underlying RLS access.

## Production migrations

Repository migration files:

1. `20260822092500_init_ledger_core.sql`
2. `20260822092600_secure_ledger_api_grants.sql`
3. `20260822093200_add_fk_covering_indexes.sql`

Supabase records the corresponding applied migration names with platform-generated version timestamps:

- `init_ledger_core`
- `secure_ledger_api_grants`
- `add_fk_covering_indexes`

The SQL source of truth remains the migration files in GitHub; Supabase migration history verifies applied delivery order by migration name.

## Verification performed

### CI

The Ledger v1 pull request passed:

- ESLint
- TypeScript typecheck
- Vitest

TypeScript unit tests cover balance sign convention, draft/void behavior, reversal cancellation, direction rules, reversal equality, and positive entry amounts.

### Database structural verification

Verified in Supabase production:

- 15/15 application tables have RLS enabled.
- Authenticated users cannot insert ledger transactions.
- Authenticated users cannot insert ledger entries.
- Authenticated users cannot directly update profile verification fields.
- Authenticated users can read ledger data only through RLS.
- Server-side service role retains required write capability.
- `customer_account_balances` has `security_invoker=true`.

### Transactional invariant verification

A temporary production-database verification transaction was executed and fully rolled back. It proved:

1. Sale 1000 YER -> balance +1000.
2. Receipt 400 YER -> balance +600.
3. Direct ledger-entry mutation is rejected.
4. Silent mutation of a posted transaction is rejected.
5. Exact 1000 YER reversal of the sale can be posted.
6. Original sale can then be marked reversed.
7. Rebuilt ledger balance becomes -400 YER, preserving the receipt while canceling the sale.
8. Verification data was rolled back and did not remain in production.

## Advisors checkpoint

Security Advisor: no findings.

Performance Advisor: all initially reported unindexed foreign keys were resolved with covering indexes. Remaining notices are only `unused_index` informational items, which are expected on a newly-created database without production workload. They must be reevaluated using real query usage later rather than removed prematurely.

## Next architectural step

Phase 2 introduces identity/onboarding and safe application commands. No mobile/web/ChatGPT client should bypass the Application/Domain layer for financial writes.

# IBEX HAD — Atomic Application Commands

## Purpose

Phase 3 connects the provider-independent `IbexApplication` use cases to PostgreSQL without giving clients broad table-write privileges.

The boundary is:

`Mobile / Web / future ChatGPT -> IbexApplication -> ApplicationRepository -> narrow Supabase RPC -> PostgreSQL transaction + invariants`

## Security model

- `authenticated` still has no direct financial INSERT/UPDATE/DELETE grants.
- Public RPC functions are `SECURITY INVOKER` wrappers only.
- Privileged implementations live in the non-exposed `private` schema.
- Every mutation checks `auth.uid()` against the explicit actor supplied by the Application layer.
- Business mutations check active ownership/membership and the allowed role.
- Financial posting re-checks business/customer/account/currency scope in PostgreSQL.
- Reversal is limited to owner/manager and exactly negates the original entries.
- All important successful mutations append immutable audit events.

## Atomicity

`app_post_movement` executes as one PostgreSQL statement/transaction:

1. Validate actor and business permission.
2. Validate amount, transaction type, direction, idempotency key and account scope.
3. Detect a previous command with the same idempotency key.
4. Insert a draft transaction.
5. Insert the ledger entry while draft.
6. Transition the transaction to posted, invoking the existing lifecycle invariant trigger.
7. Append the audit event.
8. Rebuild and return the balance from ledger entries.

If any step raises an error, PostgreSQL rolls back every step.

`app_reverse_transaction` similarly locks the original, creates a reversal transaction, copies every original entry with the opposite direction, posts the reversal, marks the original reversed, writes audit history and returns the rebuilt balance atomically.

## Idempotency

Movement idempotency is scoped by the existing `(business_id, source_type, idempotency_key)` unique constraint with `source_type='api'`.

An exact repeat returns the existing transaction and current account balance. Reusing the key with a different account, customer, movement type, direction, amount or currency raises a conflict instead of silently accepting a different financial command.

A transaction can have only one reversal. Repeating a reversal returns the existing reversal rather than creating another.

## Money transport

JavaScript `number` is never used as the transport for money. The Application layer owns `bigint`; the Supabase adapter serializes it to decimal text before JSON/RPC transport and parses returned Postgres `bigint` values back to JavaScript `bigint`.

## Statement semantics

`app_get_statement` rebuilds each transaction effect from immutable entries and computes `balance_after_minor` with a deterministic ordered window. The API returns newest rows first while the balance is calculated chronologically.

## Next integration target

After production verification of these commands, the next Phase 3 increment is to bind a real Supabase client to `SupabaseApplicationRepository`, exercise authenticated integration tests, and then expose the same `IbexApplication` instance to the first Mobile/Web surface without duplicating business logic.

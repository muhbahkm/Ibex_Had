# Security

## Core rules

- Enable RLS on every client-accessible table.
- Authorization must reflect business membership and customer ownership, not only authenticated status.
- Never expose Supabase service-role or secret keys in mobile/web clients.
- Do not use user-editable metadata for authorization decisions.
- Sensitive financial writes go through controlled application/RPC/service boundaries.
- Financial transactions are auditable and are not silently deleted after posting.
- Use UUIDs as durable internal identities; phone numbers are mutable identifiers.
- Use idempotency for externally retried or repeated financial commands.
- Validate amount, currency, account ownership, membership, status, and source before posting.
- Use database transactions for composite financial mutations.

## Authentication baseline

Primary onboarding:

1. Name
2. Phone number
3. OTP verification

Sessions should be stored securely on device. Re-verification policies can be strengthened later for sensitive operations or new devices.

## ChatGPT / AI boundary

Future AI clients receive explicit domain tools only. They must not receive unrestricted SQL/database capabilities. Write operations should use narrow actions such as create draft, post approved transaction, reverse transaction, and create dispute, each with explicit authorization and auditability.

## Review cadence

After schema/security changes:

- Run Supabase security advisors.
- Run performance advisors when DDL/indexes change.
- Verify RLS with positive and negative access tests.
- Confirm GitHub migrations reproduce the deployed state.

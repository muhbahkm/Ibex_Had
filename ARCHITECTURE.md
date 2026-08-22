# Architecture

## Architectural style

IBEX HAD starts as a Modular Monolith. Do not introduce microservices before there is a demonstrated operational reason.

Suggested domain boundaries:

```text
features/auth
features/businesses
features/customers
features/accounts
features/ledger
features/documents
features/integrations
features/notifications
```

Each domain owns its types, services, validation, tests, and public contracts.

## Stack

- Mobile: React Native + Expo + TypeScript
- Merchant Web: Next.js + React + TypeScript
- Backend/Application Layer: TypeScript
- Database: PostgreSQL on Supabase
- Auth: Supabase Auth with phone OTP
- Storage: Supabase Storage
- Authorization: RLS plus application/domain authorization
- Validation: shared TypeScript schemas (Zod or equivalent)

## API-first and channel-agnostic

The domain is not coupled to a specific client.

```text
React Native / Next.js / ChatGPT / Integrations
                    |
              Application API
                    |
            Application Services
                    |
               Domain Core
                    |
          Ledger + PostgreSQL
```

Future ChatGPT support is implemented as another client/tool surface over the same use cases, not as direct database access.

## Financial write rule

Clients never insert ledger entries directly.

A client requests a business operation, for example `PostReceipt`. The application/domain layer validates authorization, account, currency, amount, state, idempotency, and invariants; then writes the transaction, entries, balance cache updates, and audit event atomically.

## Ledger principles

- Posted movements are immutable in their financial substance.
- Corrections use reversal/adjustment operations.
- Cached balances are performance derivatives, never the financial source of truth.
- Currency balances remain separate. No implicit FX aggregation.
- Monetary representation must avoid floating point.

## Supabase boundary

Supabase is managed infrastructure, not the architecture of the product. Avoid scattering direct `supabase.from(...)` financial writes throughout clients.

All production DDL must exist as repository migrations and be reproducible from source control.

## Deployment isolation

IBEX HAD remains independent from SANAD in repository, database, auth, storage, secrets, deployment pipeline, runtime, and domain. Future interoperability uses documented APIs/webhooks, never direct cross-database reads.

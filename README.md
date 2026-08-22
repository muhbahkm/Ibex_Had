# IBEX HAD

IBEX HAD is a shared customer ledger platform between businesses and their customers.

## Product principle

The product starts narrow: a trusted, auditable, multi-currency customer ledger that lets a business maintain customer movements while allowing each customer to see only their own accounts, balances, transactions, and supporting documents.

IBEX HAD is not an ERP, full general ledger, wallet, payment gateway, or financing platform in its MVP.

## Delivery channels

- Mobile: React Native + Expo + TypeScript, distributed through Google Play and App Store.
- Merchant Web: Next.js + React + TypeScript.
- Backend: TypeScript application/domain layer.
- Database platform: Supabase with PostgreSQL.
- Future channel: ChatGPT through MCP / OpenAI Apps SDK, using the same application use cases.

## Architecture

IBEX HAD is API-first and channel-agnostic. Financial rules live in a shared domain/application layer, never in individual UIs.

```text
Mobile / Web / ChatGPT / Integrations
              |
       Application API
              |
     Application Services
              |
         Domain Core
              |
      Ledger + PostgreSQL
```

No UI or AI client may create ledger entries directly or execute arbitrary SQL.

## Authentication

The primary onboarding flow is deliberately simple:

1. Name
2. Phone number
3. OTP verification

The permanent internal identity is a UUID. Phone numbers are practical identifiers and may change; they are not financial primary keys.

## Repository rules

- GitHub is the source of truth for code, migrations, tests, and reproducible implementation.
- Supabase is the running backend state.
- Notion is the product/architecture decision record and cross-session handoff reference.
- Production DDL must be represented by a migration committed to this repository.
- Important changes are considered complete only when Notion, GitHub, and Supabase are consistent.

See `PRODUCT.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `docs/DEVELOPMENT_PROTOCOL.md`.

# IBEX HAD — Execution Plan

This document is the repository-side execution plan for IBEX HAD. Notion is the product/decision reference; GitHub is the source of truth for code and migrations; Supabase is the managed runtime for PostgreSQL/Auth/Storage.

## Goal
Ship a production-grade MVP that proves the core Shared Customer Ledger use case between a business and its customers, with an official mobile app, merchant web interface, auditable financial core, and future readiness for ChatGPT and external integrations.

## Execution principles
1. Financial invariants and schema are finalized before implementation.
2. Every production DDL change exists as a migration in this repository before/with application to Supabase.
3. Architectural and product decisions are documented in Notion.
4. Clients never own financial logic; all channels call the same application/domain use cases.
5. MVP remains narrow until real usage validates the core workflow.
6. Every delivery ends with tests, verification, and relevant security/performance checks.

## Phase 0 — Foundation and governance
Status: TECHNICAL FOUNDATION COMPLETE; GITHUB ACCOUNT-LEVEL HARDENING PENDING.

Completed:
- Supabase Mumbai project `Ibex_Had v1` is the only active backend target.
- GitHub is source of truth for code/migrations; Notion is product/architecture decision truth.
- PR-based delivery, strict TypeScript, ESLint, Vitest, repository hygiene, PR template, CODEOWNERS, and environment conventions are established.
- CI now runs lint, typecheck, tests, Expo dependency validation, Expo Doctor, and a real Android Metro/Expo bundle smoke test.

Administrative hardening still required in GitHub settings:
- Change repository visibility from Public to Private.
- Protect `main` and require PR + CI before merge.

## Phase 1 — Ledger core and Schema v1
Status: COMPLETE AND PRODUCTION-VERIFIED.

Completed:
- Money uses PostgreSQL `bigint` minor units; floating-point money is prohibited.
- Positive balance means customer owes business; negative means business owes customer.
- Posted financial history and entries are immutable; corrections use explicit reversal.
- Core identity/business/customer/account/ledger/document/dispute/integration/audit schema is deployed with RLS.
- Client financial writes are denied; narrow application commands own mutations.
- Deterministic balance reconstruction, idempotency, transaction lifecycle, reversal, FK coverage, and audit immutability were verified transactionally with rollback.
- Security Advisor is clean; remaining Performance Advisor notices are INFO-level unused indexes expected before real workload.

Detailed verification: `docs/LEDGER_V1.md`.

## Phase 2 — Identity and onboarding
Status: CORE IMPLEMENTED; LIVE OTP DELIVERY DEFERRED FOR CURRENT DEVICE PREVIEW.

Completed:
- Primary production identity contract remains name + mobile + OTP.
- UUID is permanent identity; phone is mutable and never a financial key.
- Yemen-first E.164 normalization, safe `complete_profile`, explicit customer-identity claim, audit trail, and secure session persistence are implemented.
- Mobile Supabase session composition and SecureStore persistence are implemented.
- Phone OTP client flow, Arabic error handling, rate-limit messaging, and Yemen/Twilio production runbook are implemented.
- A temporary `EXPO_PUBLIC_AUTH_MODE=preview` exists for device/UI testing without SMS. It creates only a local preview session and intentionally cannot access real financial data.

Still required before production launch:
- Enable hosted Phone Auth and configure a real SMS/Verify provider.
- Prove delivery to a real +967 number, phone-change verification, and abuse/rate-limit controls.
- Remove/disable preview auth for release builds.

Detailed flow: `docs/IDENTITY_ONBOARDING.md` and `docs/PHONE_AUTH_RUNBOOK.md`.

## Phase 3 — Application and domain core
Status: COMPLETE AND BOUND TO A REAL SUPABASE SESSION CLIENT.

Completed:
- `IbexApplication` is provider/framework independent and shared by Mobile/Web/future ChatGPT/integrations.
- Money crosses JavaScript boundaries losslessly as decimal integer strings → `bigint`.
- `ApplicationRepository` ports isolate use cases from Supabase and UI frameworks.
- `SupabaseApplicationRepository` maps narrow RPCs and validates returned payloads.
- `IbexSessionApplication` derives actor identity from the authenticated Supabase session; callers cannot supply their own actor id.
- Atomic commands cover business/customer/account creation, posting sale/receipt, reversal, statement, read models, customer invitations, disputes, and transaction documents.
- Production verification proved idempotency, exact reversal, deterministic statements, merchant/customer isolation, invitation claim constraints, dispute behavior, and document preparation constraints.

Detailed command contract: `docs/ATOMIC_APPLICATION_COMMANDS.md` and `docs/CLIENT_RUNTIME.md`.

## Phase 4 — Mobile v1
Status: IN PROGRESS; CORE MERCHANT/CUSTOMER VERTICAL SLICE IMPLEMENTED.

Completed:
- Expo SDK 57 + React Native + TypeScript + Expo Router shell.
- Arabic-first RTL UI and Latin-number display conventions.
- Supabase client, secure session storage, real Session → Application → Repository → RPC composition.
- Merchant flow: create business → add/search customer → open currency account → post sale/receipt → statement → balance → reverse eligible transaction.
- Customer flow: `حساباتي` → account statement → balance → request review/dispute.
- Secure customer invitations and deep-link claim flow.
- Dispute/review screens for customer and merchant.
- Transaction-document screen and private attachment flow are being completed in PR #21.
- Expo dependency check, Expo Doctor, and Android bundle smoke test are enforced in CI.
- SDK 57 SafeArea compatibility cleanup merged in PR #20.

Current device-testing note:
- The Google Play Expo Go client available on the test phone reports SDK 54 support while the project uses SDK 57. This is a test-host compatibility issue, not an application bundle failure.
- Continue device testing with an SDK 57-compatible Expo Go binary or a project Development Build.

Exit criteria: a real authenticated merchant posts a transaction and a real customer sees the exact movement/balance/document on a physical device.

## Phase 5 — Merchant Web v1
Status: NOT STARTED.

Planned:
- Next.js + TypeScript.
- Efficient customer/transaction management, search, filters, statements, and limited imports where justified.
- Same Application/API contracts as mobile; no web-specific financial logic.

Exit criteria: merchant daily workflows on web produce identical financial outcomes to mobile.

## Phase 6 — Documents, disputes, notifications
Status: IN PROGRESS.

Completed/in implementation:
- Dispute/review workflow is implemented and production-verified without mutating ledger history.
- Transaction Documents v1 uses a private Supabase Storage bucket with a Prepare → Upload → Visible contract.
- Server generates the canonical storage path; client cannot choose another business/transaction scope.
- Upload is restricted to active owner/manager/cashier; customer reads are restricted to already-accessible transactions.
- No public file URLs; mobile opens documents through short-lived signed URLs.
- PDF/JPEG/PNG/WEBP only, maximum 10 MiB.

Remaining:
- Complete physical-device authenticated upload/download verification.
- Add useful, non-noisy notification delivery after the core device flow is stable.

Detailed document contract: `docs/TRANSACTION_DOCUMENTS.md`.

## Phase 7 — Security, quality, production readiness
Status: PARTIALLY ACTIVE THROUGHOUT DEVELOPMENT.

Already active:
- Unit/integration contract tests and CI gates.
- RLS/privilege verification after material backend changes.
- Supabase Security/Performance Advisors after DDL changes.
- Android bundle smoke test.

Still required:
- Full RLS role/ownership matrix and mobile E2E coverage.
- Structured logs, monitoring/error tracking.
- Backup/restore rehearsal.
- Final Auth/API rate limits, abuse controls, secrets/release review.

Exit criteria: no critical findings, restore procedure tested, critical flows covered end to end.

## Phase 8 — Beta and first release
Status: NOT STARTED.

- Limited real-business beta.
- Track active ledgers, customers, weekly movements, customer self-service usage, reduced manual statement requests, and retention.
- Fix beta issues before scope expansion.
- Prepare Play/App Store, privacy policy, terms, and release assets.

Exit criteria: real businesses use IBEX HAD weekly and customers return to view balances without manual merchant intervention.

## Phase 9 — After MVP proof
Only after usage validates the core product:
- Accounting imports/sync.
- Advanced reporting and receivables workflows.
- Public API/Webhooks.
- ChatGPT App via MCP/Apps SDK over the same Application Layer.
- Additional channels only where market value is demonstrated.

## Definition of Done
A feature/change is complete only when applicable items are satisfied:
- Code and migrations are committed in GitHub.
- Tests and CI gates pass.
- Supabase change is applied and verified for backend/DB work.
- Security/performance checks run when relevant.
- Notion is updated with decision/status.
- No untracked manual production changes remain.

## Current next delivery
Close Transaction Documents v1 through production verification and merge PR #21, then continue physical-device Mobile v1 validation with an SDK 57-compatible test host/Development Build. In parallel, keep live +967 OTP as a production-auth task rather than weakening the financial authorization boundary.

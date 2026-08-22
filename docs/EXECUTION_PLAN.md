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
- CI now runs lint, typecheck, tests, a real Next.js production build, Expo dependency validation, Expo Doctor, and a real Android Metro/Expo bundle smoke test.

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
- Phone OTP orchestration is shared by Mobile and Web through Runtime; channel-specific UI only maps errors and presentation.
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
- Money display and major↔minor presentation rules are centralized in Core for consistent Mobile/Web behavior.
- `ApplicationRepository` ports isolate use cases from Supabase and UI frameworks.
- `SupabaseApplicationRepository` maps narrow RPCs and validates returned payloads.
- `IbexSessionApplication` derives actor identity from the authenticated Supabase session; callers cannot supply their own actor id.
- Atomic commands cover business/customer/account creation, posting sale/receipt, reversal, statement, read models, customer invitations, disputes, transaction documents, and the durable notification inbox.
- Production verification proved idempotency, exact reversal, deterministic statements, merchant/customer isolation, invitation claim constraints, dispute behavior, document preparation constraints, notification ownership, and idempotent read marking.

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
- Transaction Documents v1 is merged through PR #21 with private attachment UX.
- Notification Inbox v1 adds an inbox screen and unread badge while remaining independent from Push providers.
- SDK 57 Development Build configuration is available with `expo-dev-client` and EAS profiles; actual cloud APK creation still requires a real Expo/EAS account session.
- Expo dependency check, Expo Doctor, and Android bundle smoke test are enforced in CI.
- SDK 57 SafeArea compatibility cleanup merged in PR #20.

Current device-testing note:
- The Google Play Expo Go client available on the test phone reports SDK 54 support while the project uses SDK 57. This is a test-host compatibility issue, not an application bundle failure.
- Continue device testing with the project-owned SDK 57 Development Build once EAS account linkage is completed.

Exit criteria: a real authenticated merchant posts a transaction and a real customer sees the exact movement/balance/document on a physical device.

## Phase 5 — Merchant Web v1
Status: CORE MERCHANT VERTICAL SLICE IMPLEMENTED; LIVE AUTHENTICATED BROWSER VERIFICATION REMAINS.

Completed:
- Next.js 16.3 + React 19 + TypeScript App Router foundation.
- Supabase SSR cookie clients; protected server routes verify `auth.getClaims()` instead of trusting cookie-loaded `getSession()` for authorization.
- Web uses the same `IbexSessionApplication`, Application Core, RLS, and narrow RPC surface as Mobile; no web-specific financial mutation logic exists.
- Arabic RTL responsive login with name + phone + OTP and shared Runtime phone-auth orchestration.
- Dashboard lists merchant businesses, customer-side accounts, and unread notifications.
- Merchant workflow: Dashboard → business → customer search/list/create → currency accounts list/open → statement → sale/receipt → balance → reverse eligible transaction.
- Customer search and financial views remain scoped through existing authorized read models rather than direct table reads.
- Sale/receipt inputs use the shared Core major→minor conversion; money stays lossless across the JavaScript boundary.
- Reversal is offered only when the statement read model returns `canReverse=true`; the command creates a separate reversal transaction and never edits posted history.
- Next.js production build is a permanent CI gate alongside the Mobile/Expo gates.
- NodeNext `.js` source imports are resolved only at the Webpack integration boundary via `resolve.extensionAlias`; the shared packages remain strict NodeNext.

Remaining:
- Verify the full flow in a real authenticated browser session against Supabase Phone Auth once live OTP is enabled.
- Add transaction-document UX and dispute/inbox management to Merchant Web where it improves daily workflow.
- Add higher-density search/filter/reporting only after the core workflow is validated with real usage.

Exit criteria: merchant daily workflows on web produce identical financial outcomes to mobile under a real authenticated session.

## Phase 6 — Documents, disputes, notifications
Status: BACKEND/CLIENT CORE COMPLETE; PHYSICAL-DEVICE DELIVERY VALIDATION REMAINS.

Completed:
- Dispute/review workflow is implemented and production-verified without mutating ledger history.
- Transaction Documents v1 uses a private Supabase Storage bucket with a Prepare → Upload → Visible contract.
- Server generates the canonical storage path; client cannot choose another business/transaction scope.
- Upload is restricted to active owner/manager/cashier; customer reads are restricted to already-accessible transactions.
- No public file URLs; mobile opens documents through short-lived signed URLs.
- PDF/JPEG/PNG/WEBP only, maximum 10 MiB.
- Durable Notification Inbox v1 is implemented independently from Expo Push/FCM/APNs/SMS.
- Notifications are generated only for high-value events: posted financial movement to a claimed customer, dispute opened to owner/managers, dispute resolved/rejected to the customer.
- RLS/read-mark ownership was production-verified; anon cannot execute inbox RPCs and authenticated clients cannot directly mutate notification rows.
- Security Advisor is clean after the notification migration; Performance Advisor remains INFO-only unused-index notices.

Remaining:
- Complete physical-device authenticated document upload/download verification.
- Complete live authenticated notification UX verification on device.
- Add Push delivery only as a future channel over the durable inbox/outbox boundary; Push must never become the notification source of truth.

Detailed contracts: `docs/TRANSACTION_DOCUMENTS.md` and `docs/NOTIFICATION_INBOX.md`.

## Phase 7 — Security, quality, production readiness
Status: PARTIALLY ACTIVE THROUGHOUT DEVELOPMENT.

Already active:
- Unit/integration contract tests and CI gates.
- RLS/privilege verification after material backend changes.
- Supabase Security/Performance Advisors after DDL changes.
- Next.js production build and Android bundle smoke tests.

Still required:
- Full RLS role/ownership matrix and cross-channel E2E coverage.
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
Validate Merchant Web and Mobile against real authenticated sessions once +967 Phone OTP is enabled, while completing the project-owned SDK 57 Development Build installation path. The next product-facing Web extensions are transaction documents and dispute/inbox workflows; no new financial logic should be introduced outside the shared Application/Domain Core.
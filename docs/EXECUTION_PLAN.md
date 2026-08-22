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
Status: technical foundation complete; GitHub account-level hardening pending.

Completed:
- Supabase Mumbai project `Ibex_Had v1` is the only active backend target.
- GitHub is established as source of truth for code and migrations.
- Notion is established as source of truth for product/architecture decisions.
- PR-based delivery flow is established and exercised.
- TypeScript/pnpm workspace foundation is committed.
- Strict TypeScript configuration, ESLint, Vitest, repository hygiene, PR template, CODEOWNERS, environment template, and engineering conventions are committed.
- GitHub Actions CI runs lint, typecheck, and tests and is green.

Administrative hardening still required in GitHub settings:
- Change repository visibility from Public to Private before sensitive implementation details/secrets/infrastructure are introduced.
- Enable branch protection/rules for `main`, requiring pull requests and the CI status check before merge.

These settings are tracked as owner-level repository administration because the connected GitHub tool surface does not expose repository visibility or branch-protection mutation.

## Phase 1 — Ledger core and Schema v1
Status: COMPLETE.

Completed:
- Schema v1 and financial invariants frozen for the MVP core.
- Money representation uses integer minor units (`bigint` in PostgreSQL); floating-point money is prohibited.
- Balance convention frozen: positive = customer owes business; negative = business owes customer.
- Transaction lifecycle and explicit reversal behavior enforced in PostgreSQL.
- Identity, business, membership, customer, account, transaction, entry, document, dispute, integration, and audit structures deployed.
- Idempotency and posted-transaction immutability enforced.
- Three repository migrations deployed to Supabase Mumbai in order: ledger core, API-grant hardening, FK covering indexes.
- RLS enabled on all 15 public application tables.
- End-user financial writes are not directly granted; writes go through narrow Application/Domain commands.
- `customer_account_balances` uses `security_invoker=true` and remains a derived view, not financial truth.
- TypeScript ledger invariant tests pass in CI.
- A temporary transactional database verification proved deterministic balances, immutable entries/posted transactions, and exact reversal behavior; all verification data was rolled back.
- Supabase Security Advisor has no findings.
- All initial unindexed-FK Performance Advisor findings were resolved. Remaining `unused_index` notices are INFO-only and expected before real workload exists.

Detailed verification is recorded in `docs/LEDGER_V1.md`.

Exit criteria met: balances were rebuilt deterministically from posted ledger entries without trusting cached balances.

## Phase 2 — Identity and onboarding
Status: BACKEND CORE COMPLETE; LIVE OTP DELIVERY AND MOBILE SESSION WORK PENDING.

Completed:
- Primary UX contract fixed as name + phone number + OTP only.
- UUID remains the permanent internal identity; phone is mutable and never a financial key.
- Shared name normalization and Yemen-first E.164 phone normalization are implemented and unit-tested.
- Migration `add_safe_identity_commands` is deployed to Supabase Mumbai.
- `complete_profile(full_name)` derives verified phone state from `auth.users`; clients cannot submit or forge phone verification fields.
- `claim_customer_identity(id)` claims one explicit identity only when its E.164 phone matches the caller's verified Auth phone; same-user retries are idempotent.
- Broad authenticated writes to profile/customer tables remain disabled.
- Onboarding/claim mutations create immutable audit events.
- Database verification transaction proved profile completion, successful claim, idempotent retry, and rejection of a mismatched phone; test data was rolled back.
- Function privileges verified: `authenticated` can execute the narrow commands; `anon` cannot.
- Supabase Security Advisor has no findings after the identity migration.
- Phone-change behavior is documented: change/verify in Auth first, then resynchronize profile; no silent customer-identity merge.

Pending external/mobile work:
- Enable Phone Auth in hosted Supabase settings.
- Select/configure an SMS provider with proven Yemen delivery.
- Test real OTP delivery and phone-change OTP.
- Review OTP rate limits and abuse controls.
- Implement secure session persistence in the Expo mobile app when the mobile shell is introduced.

Detailed flow and security contract: `docs/IDENTITY_ONBOARDING.md`.

Exit criteria remain open until a real Yemeni phone completes OTP login and the mobile session can be restored securely.

## Phase 3 — Application and domain core
Status: APPLICATION CORE + ATOMIC SUPABASE ADAPTER DEPLOYED AND PRODUCTION-VERIFIED; FIRST REAL CLIENT BINDING NEXT.

Completed:
- `IbexApplication` is provider/framework independent and shared by future Mobile, Web, ChatGPT, and integrations.
- Money crosses JavaScript boundaries losslessly: decimal integer strings at external boundaries and `bigint` internally; JavaScript `number` is prohibited for money.
- Core use cases implemented: CreateBusiness, CreateCustomer, OpenCustomerAccount, PostSale, PostReceipt, ReverseTransaction, and GetStatement.
- `ApplicationRepository` ports isolate business/application logic from Supabase and UI frameworks.
- `SupabaseApplicationRepository` maps those ports to narrow RPC commands and preserves PostgreSQL `bigint` values losslessly.
- Migration `add_atomic_application_commands` is deployed to Supabase Mumbai.
- Narrow RPC commands exist for business/customer/account creation, movement posting, reversal, and statement reconstruction.
- Posting is atomic: actor/role/scope/currency/idempotency validation -> draft transaction -> entry -> posted transaction -> audit event -> deterministic balance rebuild. Any failure rolls the statement back.
- Reversal is restricted to owner/manager, locks the original, posts exact opposite entries, then marks the original reversed.
- Idempotency is production-verified: exact retries return the same transaction; reusing a key with a conflicting financial payload is rejected; repeated reversal returns the existing reversal.
- Production verification inside a transaction proved sale 1000 -> balance 1000, receipt 400 -> balance 600, deterministic statement, reversal of sale -> balance -400; all verification data was rolled back.
- Authorization surface verified: authenticated users can execute the narrow posting/reversal RPCs; anon cannot; authenticated still cannot directly insert into `ledger_transactions`, `ledger_entries`, or `audit_events`.
- PR #8 (Application Core) and PR #9 (atomic adapter/RPCs) passed lint, typecheck, and tests and were squash-merged.
- Supabase Security Advisor has no findings. Performance Advisor only reports expected INFO-level unused indexes before real workload exists.

Detailed command contract: `docs/ATOMIC_APPLICATION_COMMANDS.md`.

Remaining before Phase 3 closes:
- Bind a real Supabase client/session to `SupabaseApplicationRepository` through a single composition root.
- Add an authenticated integration harness that exercises the Application layer through the client boundary.
- Add only the additional MVP use cases required by the first UI; do not duplicate financial logic in clients.

Exit criterion is materially met for provider-independent and database layers; Phase 3 closes after the same `IbexApplication` runs through the first real client binding without UI-specific financial logic.

## Phase 4 — Mobile v1
- React Native + Expo + TypeScript.
- Arabic-first, RTL, mobile-first, Latin digits 0-9.
- Onboarding/authentication.
- Merchant mode: create business, add customer, add movement, statement, balance, invitation.
- Customer mode: accounts, account detail, movement history, documents, review request.
- Deep Links / Universal Links.

Exit criteria: end-to-end journey works: merchant adds customer and posts transaction -> customer signs in and sees the correct movement and resulting balance.

## Phase 5 — Merchant Web v1
- Next.js + TypeScript.
- Efficient customer and transaction management for larger screens.
- Search, filters, statements, limited import when justified.
- Same domain/API contracts as mobile.

Exit criteria: merchant can perform daily workflows on web with identical financial outcomes to mobile.

## Phase 6 — Documents, disputes, notifications
- Supabase Storage with strict access policies.
- Transaction-document linking.
- Dispute/review workflow that never silently mutates ledger history.
- Useful, non-noisy notifications.

Exit criteria: every movement is explainable/reviewable and documents cannot leak across customers or businesses.

## Phase 7 — Security, quality, production readiness
- Unit, integration, and E2E coverage.
- RLS role/ownership test matrix.
- Supabase Security and Performance Advisors after material DDL changes.
- Structured logs, monitoring, error tracking.
- Backup/restore rehearsal.
- Auth/API rate limits and abuse controls.
- Secrets, CI/CD, and release review.

Exit criteria: no critical findings, restore procedure tested, critical flows covered by tests.

## Phase 8 — Beta and first release
- Limited real-business beta.
- Track active ledgers, customers, weekly movements, customer self-service access, reduced manual PDF/WhatsApp statement requests, and retention.
- Fix beta issues before scope expansion.
- Prepare Google Play/App Store, privacy policy, terms, and release assets.

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
- Tests pass.
- Supabase change is applied and verified for backend/DB work.
- Security/performance checks run when relevant.
- Notion is updated with the decision/status.
- No untracked manual production changes remain.

## Current next delivery
Create the real Supabase client composition root and authenticated integration boundary so the first Mobile/Web client can instantiate the same `IbexApplication` without owning any financial logic. Live OTP closure remains a parallel external-provider task.

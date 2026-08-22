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
- PR-based delivery flow was exercised successfully through PR #1.
- TypeScript/pnpm workspace foundation is committed.
- Strict TypeScript configuration, ESLint, Vitest, repository hygiene, PR template, CODEOWNERS, environment template, and engineering conventions are committed.
- GitHub Actions CI runs lint, typecheck, and tests and is green.
- Supabase remains intentionally schema-empty before Phase 1, with no migrations or Edge Functions.
- Supabase Security and Performance Advisors are clean at the Phase 0 checkpoint.

Administrative hardening still required in GitHub settings:
- Change repository visibility from Public to Private before sensitive implementation details/secrets/infrastructure are introduced.
- Enable branch protection/rules for `main`, requiring pull requests and the CI status check before merge.

These settings are tracked as owner-level repository administration because the connected GitHub tool surface does not expose repository visibility or branch-protection mutation.

Exit criteria for the technical foundation are met. Full governance hardening is complete once the two GitHub settings above are enabled.

## Phase 1 — Ledger core and Schema v1
Priority: critical.

- Review and freeze Schema v1.
- Freeze money representation and currency rules.
- Freeze balance convention: positive = customer owes business; negative = business owes customer.
- Freeze transaction lifecycle: draft -> posted -> reversed/voided under documented rules.
- Finalize identity, business, membership, customer, account, transaction, entry, document, dispute, integration, and audit tables.
- Define idempotency and posted-transaction immutability.
- Create migration 0001 and apply to Supabase.
- Enable RLS from the first migration.
- Add ledger invariant and balance-rebuild tests.

Exit criteria: test data can be posted and balances can be rebuilt deterministically from ledger entries without trusting cached balances.

## Phase 2 — Identity and onboarding
- Supabase Auth with phone OTP.
- UX: name + phone number + OTP only.
- UUID is the permanent internal identity; phone number is mutable and never a financial key.
- Profiles and Customer Identity claim flow.
- Secure mobile session persistence.
- Recovery and phone-change flow.

Exit criteria: a new user can sign up and return with minimal friction while RLS prevents cross-user/business access.

## Phase 3 — Application and domain core
- Modular Monolith boundaries: Auth, Businesses, Customers, Accounts, Ledger, Documents, Disputes, Notifications, Integrations.
- Shared use cases such as CreateCustomer, CreateDraftTransaction, PostReceipt, PostSale, ReverseTransaction, GetStatement.
- No client can create ledger entries directly.
- Audit events for important mutations.
- API contracts reusable by Mobile, Web, and future ChatGPT tooling.

Exit criteria: key use cases pass integration tests without any UI dependency.

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
Begin Phase 1: review and freeze Schema v1, then create the first production migration for the financial core with RLS and ledger invariant tests.

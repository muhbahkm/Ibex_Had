# IBEX HAD — Mobile testing readiness

This document defines when the mobile app is considered ready for a real-device test and how to test it without weakening production security.

## Current test target

- Expo SDK 57
- React Native 0.86
- Expo Router
- Supabase project: `Ibex_Had v1` in Mumbai (`ap-south-1`)
- Primary device test path: Expo Go for UI/navigation/runtime checks
- Store/development build is required later for final custom-scheme and store-grade validation

## Required local environment

Create `apps/mobile/.env` locally. Never commit this file.

```env
EXPO_PUBLIC_SUPABASE_URL=https://asvckwhrzoqupkihqhoj.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<current Supabase publishable key>
```

The publishable key is intentionally a client key; authorization remains enforced by RLS and narrow RPC commands. Secret/service-role keys must never be placed in Expo environment variables.

## Real-device readiness gates

A device test should only be announced after all gates below pass:

1. Root CI is green: lint, typecheck, tests.
2. `expo install --check` passes.
3. `expo-doctor` passes.
4. Supabase Security Advisor has no findings introduced by the batch.
5. Performance Advisor has no actionable missing-index findings introduced by the batch.
6. Application starts with a valid Expo public environment and reaches Supabase.
7. Authentication strategy for the test is explicitly defined. No hidden password, bypass account, service-role key, or disabled RLS is permitted.
8. Financial commands still pass production transaction/rollback verification.

## Expo Go scope

Expo Go is appropriate for:

- Arabic RTL layout and navigation
- phone/OTP screens once SMS delivery is enabled
- customer/business flows
- ledger reads and commands
- statement, invitation route UI, dispute UI
- SecureStore-backed session behavior supported by Expo Go

Do not treat Expo Go as the final validation for `ibexhad://` external links. The route itself can be tested, but the production custom scheme / Universal Links / App Links must later be validated in a development or store build because Expo Go owns its container URL scheme.

## No insecure test bypasses

IBEX HAD will not add a production authentication bypass merely to make Expo Go easier to test. Until a real Yemeni SMS provider is enabled, authenticated end-to-end testing must use a controlled Supabase test identity/session method that does not alter production authorization rules, or wait for SMS activation.

## First real-device checklist

When the project reaches the device-test checkpoint, the operator will be given exact commands from the repository root, normally:

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env
# fill the two EXPO_PUBLIC values
pnpm --dir apps/mobile start
```

Then scan the Expo QR code with Expo Go while the phone and development machine can reach the Metro server.

## Definition of ready to announce

The assistant should explicitly tell the project owner **"التطبيق جاهز، افتح Expo Go"** only after the readiness gates above have been verified for the current `main` revision.

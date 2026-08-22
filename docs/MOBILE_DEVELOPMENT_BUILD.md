# IBEX HAD — Mobile Development Build

## Why this exists

IBEX HAD uses Expo SDK 57. A Development Build is the controlled physical-device test host for the project and avoids depending on whatever SDK version happens to be bundled in the public Expo Go application.

The Development Build contains the native modules used by IBEX HAD, including SecureStore, Document Picker/FileSystem, and the Expo development client.

## Repository configuration

The mobile app lives under `apps/mobile` in the monorepo. Run EAS commands from that directory.

`apps/mobile/eas.json` defines three profiles:

- `development`: Development Client + internal distribution + installable Android APK.
- `preview`: internal installable Android APK without development-client semantics; useful for near-release internal checks.
- `production`: store-oriented profile with automatic build-number/version-code incrementing.

`expo-dev-client` is pinned to the Expo SDK 57-compatible range recommended by Expo.

## First EAS account linkage

This is intentionally not hard-coded in GitHub because Expo project ownership belongs to the authenticated Expo account.

From the repository root:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build:configure
```

Review any `app.json` changes proposed by EAS before committing them. The important generated value is the legitimate EAS project identity (`extra.eas.projectId`), not a guessed UUID.

No Supabase service-role key, SMS provider secret, signing key, or other private credential belongs in `app.json`, `eas.json`, or GitHub.

## Android Development Build

After the project is linked to the intended Expo account:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile development
```

The development profile is configured to produce an APK for direct installation on the physical Android test device.

After installing the APK, start the JavaScript development server from the same app directory:

```bash
pnpm start:dev-client
```

Open the installed IBEX HAD Development Build and connect it to the development server from the launcher/QR flow.

## Environment contract

The app still requires:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

For the temporary UI-only no-SMS path, `EXPO_PUBLIC_AUTH_MODE=preview` may be used locally. Preview Auth intentionally cannot access real financial data and must not be enabled in release builds.

For real end-to-end verification, use the normal authenticated mode with Phone OTP once the SMS provider is configured.

## Device validation checklist

A Development Build is considered useful only after the device proves these flows against the canonical backend:

1. App launches without Expo Go SDK mismatch.
2. Session can be restored securely after app restart.
3. Merchant can load businesses/customers and post a sale/receipt.
4. Customer sees the exact resulting statement/balance.
5. Merchant can attach a permitted document and both authorized sides can open it.
6. Notification Inbox loads, unread badge refreshes, and mark-as-read persists.
7. Customer review/dispute reaches the merchant and the closed result returns to the customer inbox.
8. No user can cross business/customer/document/notification authorization boundaries.

## Rebuild rule

Rebuild the Development Client whenever a new native-code dependency or native configuration is introduced. Pure TypeScript/JavaScript changes normally only require restarting/reloading the development server.

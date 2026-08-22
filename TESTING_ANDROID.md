# IBEX HAD — Android Preview Testing

The repository can produce an installable standalone Android APK for product testing without Expo Go and without live phone OTP.

## Safety profile
- Build uses `EXPO_PUBLIC_AUTH_MODE=preview`.
- Preview Auth is local/testing-only and does not prove a real phone number.
- Preview Runtime remains local/in-memory for product flows that are designed for preview.
- The APK contains only the publishable Supabase client configuration already used by the mobile client; it contains no service-role credential.
- The build does not weaken Ledger, RLS, or production Auth.

## GitHub artifact
Workflow: `.github/workflows/android-preview-apk.yml`
Artifact: `IBEX-HAD-preview-apk`
APK inside artifact: `IBEX-HAD-preview.apk`

The workflow uses Expo prebuild and Gradle `assembleRelease`, then publishes the APK plus a SHA-256 checksum as a GitHub Actions artifact.

## Install
1. Download the `IBEX-HAD-preview-apk` artifact from the latest successful **Android Preview APK** GitHub Actions run.
2. Extract the ZIP.
3. Open `IBEX-HAD-preview.apk` on the Android phone.
4. Allow installation from the browser/files app if Android asks.
5. Launch **IBEX HAD** and use the Manager Preview entry.

This preview is for UX and operational-flow validation. Live OTP/WhatsApp identity validation remains intentionally deferred.

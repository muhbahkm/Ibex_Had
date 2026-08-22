# IBEX HAD — Phone Auth production runbook

## Decision

IBEX HAD keeps the primary sign-in experience intentionally narrow: **name + mobile number + SMS OTP**. The internal user UUID remains the durable identity; a phone number is a verified identifier, not a financial primary key.

For the first Yemen real-device test, the preferred provider is **Twilio / Twilio Verify** because Supabase supports Twilio for phone login and Twilio publishes Yemen (+967) messaging guidance and geographic/fraud controls.

This is an operational provider choice, not an architectural dependency. The application continues to call Supabase Auth only, so the SMS provider can be replaced without changing the Ledger or mobile domain model.

## What must never be committed

Never put any of these values in GitHub, Expo public environment variables, screenshots, logs, or Notion:

- Twilio Auth Token
- Supabase secret/service-role key
- Supabase Management access token
- any provider private API secret

The Expo app receives only the Supabase project URL and publishable client key.

## Hosted Supabase configuration checklist

In the `Ibex_Had v1` hosted project:

1. Open Authentication → Providers → Phone.
2. Enable Phone sign-in/sign-up.
3. Configure the selected SMS provider with its credentials in the Supabase Dashboard.
4. Keep the app on a 6-digit SMS OTP flow.
5. Review Authentication → Rate Limits before public launch.
6. Add CAPTCHA / bot protection before broad public signup, following the Supabase production checklist.

The project connector currently does not expose hosted Auth-provider credential mutation. This configuration must therefore be performed through an authorized Supabase Dashboard session or a secure management workflow; secrets must not be sent through source control.

## Twilio readiness checklist for Yemen

Before the first live OTP:

1. Create/verify the Twilio account.
2. Configure a Twilio Messaging/Verify service as required by the chosen Supabase provider mode.
3. In Twilio Geo Permissions, explicitly allow **Yemen (+967)** for the channel being tested.
4. Disable countries IBEX HAD does not serve during the first pilot.
5. Enable/retain Twilio fraud protections such as Verify Fraud Guard where applicable.
6. Use one controlled Yemeni test number first.
7. Confirm OTP receipt, latency, sender presentation, and successful Supabase `verifyOtp()`.
8. Check Twilio and Supabase Auth logs after the test.

## Application behavior

The mobile client already:

- normalizes Yemen local numbers to E.164
- requests OTP through `supabase.auth.signInWithOtp()`
- verifies 6-digit SMS codes with `verifyOtp()`
- creates the profile only after the Auth phone is verified
- persists the resulting session securely on device
- maps common Supabase Auth failures to safe Arabic messages
- respects the resend cooldown in UI

No password, hidden test login, RLS bypass, or service-role client path is permitted.

## First live-device acceptance test

Use a clean phone session and a controlled +967 number.

1. Open IBEX HAD in Expo Go.
2. Enter name and Yemeni mobile number.
3. Confirm only one OTP request is emitted.
4. Receive the 6-digit OTP on the same number.
5. Enter the code and verify that the session is created.
6. Confirm `complete_profile` succeeds and the home screen opens.
7. Close and reopen Expo Go; verify session persistence.
8. From a merchant test identity, create a customer with the same verified number and issue an invitation.
9. Confirm the customer claims only that matching identity and sees only their own accounts.
10. Exercise statement, sale/receipt from merchant side, customer review request, and merchant resolution.
11. Confirm Security Advisor remains clean and inspect Auth/API logs for unexpected errors.

## Go / no-go rule for Expo Go announcement

Only announce **«التطبيق جاهز، افتح Expo Go»** after:

- main CI is green including Android bundle smoke test and Expo Doctor
- hosted Phone Auth + SMS provider is configured
- a real +967 OTP has been delivered and verified successfully
- no production authorization bypass is present

Until those conditions hold, the application may be technically bundle-ready but is not considered ready for a complete authenticated phone test.

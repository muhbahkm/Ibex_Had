# IBEX HAD — Identity & Onboarding v1

## Goal

The primary user journey is deliberately minimal:

```text
Name -> Phone number -> OTP -> authenticated session -> profile completion -> optional customer-account claim
```

No username, email, or password is required in the primary flow.

## Identity rules

- `auth.users.id` UUID is the permanent login identity.
- Phone number is an operational identifier and can change; it is never a financial foreign key.
- Supabase Auth is the authority for whether a phone is verified.
- `profiles.phone_e164` and `profiles.phone_verified_at` are derived from Auth, never trusted from client input.
- Client code may submit a display/full name, but it cannot directly write verification fields.
- All phone values used by IBEX HAD are canonical E.164.

## Yemen-first normalization

The UI accepts:

- a valid E.164 number such as `+967777123456`; or
- a Yemen local mobile number such as `777123456` or `0777123456`, normalized to `+967777123456`.

The product remains international-ready because already-canonical E.164 numbers for other countries are preserved.

## Supabase Phone OTP

The supported flow follows Supabase Phone Login:

1. Normalize the phone number to E.164.
2. Request OTP through `supabase.auth.signInWithOtp({ phone })`.
3. User enters the 6-digit OTP.
4. Verify with `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
5. After a session exists, call the narrow `complete_profile` command with the user's name.
6. Persist the authenticated session securely in the mobile application.

Phone Auth must be enabled in the hosted Supabase Auth provider settings and an SMS provider must be configured. Provider credentials are operational secrets and are never stored in GitHub.

Supported Supabase providers currently include Twilio, MessageBird, Vonage, and TextLocal (community-supported). Provider selection for Yemen should be based on verified delivery quality, sender support, and cost rather than hard-coding a vendor into the domain.

## Safe profile completion

Clients do not receive broad `INSERT/UPDATE` access to `profiles`.

The public command:

```text
complete_profile(full_name)
```

is a narrow SECURITY INVOKER wrapper. Its privilege-elevated implementation lives in the non-exposed `private` schema and:

- requires `auth.uid()`;
- reads the caller phone and `phone_confirmed_at` from `auth.users`;
- refuses unverified/malformed phone state;
- normalizes and validates the name;
- upserts only the caller's profile;
- records an immutable audit event.

This same command can resynchronize the public profile after a verified phone-change flow.

## Customer identity claim

A customer identity may exist before the person installs IBEX HAD.

The v1 command:

```text
claim_customer_identity(customer_identity_id)
```

claims one explicit identity only when:

- the caller is authenticated;
- the caller has a verified Auth phone;
- the target identity is unclaimed, or is already claimed by the same caller (idempotent success);
- the target identity's E.164 phone exactly matches the verified Auth phone.

It never searches by name and never bulk-merges identities. A later invitation-token flow can cover identities without phone numbers or controlled exceptional cases.

## Phone change

Changing a phone number is an Auth operation, not a direct profile edit:

1. authenticated user requests `auth.updateUser({ phone })`;
2. Supabase verifies the new phone using the phone-change OTP flow;
3. after verification, `complete_profile(existingName)` synchronizes the profile from Auth.

Customer identities are not silently rewritten or merged just because the login phone changes. Identity reconciliation requires an explicit product flow.

## Session storage

For Expo/React Native, session persistence will use the Supabase-supported secure-storage pattern rather than plain application state. Secrets/service-role keys never ship in the mobile bundle; only publishable client configuration is allowed.

## External operational dependency

Code and database support can be completed before SMS delivery is activated. End-to-end live OTP cannot be declared complete until:

- Phone Auth is enabled in Supabase;
- an SMS provider account is selected/configured;
- real Yemen phone delivery is tested;
- OTP rate limits/abuse controls are reviewed.

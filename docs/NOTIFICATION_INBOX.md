# IBEX HAD — Notification Inbox v1

## Purpose

Notification Inbox v1 provides a durable, provider-independent record of important user-facing events. It is intentionally separate from Expo Push, FCM, APNs, SMS, or email. Those channels may deliver a notification later, but the database inbox remains the source of truth for what the user should be able to see inside IBEX HAD.

## Events in v1

The MVP keeps notifications narrow and useful:

- `transaction_posted`: a claimed customer is notified when a new financial movement is posted to their account by another user.
- `dispute_opened`: the business owner and active managers are notified when a customer opens a review request.
- `dispute_closed`: the claimed customer is notified when the business resolves or rejects the review request.

No promotional, marketing, low-value, or noisy events are generated in v1.

## Security and ownership

`public.notifications.recipient_user_id` is the authorization boundary.

- RLS permits an authenticated user to read only rows addressed to their own `auth.uid()`.
- Clients receive no direct INSERT, UPDATE, or DELETE grants on `public.notifications`.
- Notification generation happens from database triggers after the corresponding authoritative domain state changes.
- Mark-as-read is exposed only through `app_mark_notification_read`, which derives and verifies the authenticated actor before changing a row.
- A user cannot mark another user's notification as read by supplying another notification UUID.
- `app_list_notifications` also requires the explicit actor to match the authenticated session and then filters again by recipient.

## Domain ordering

Notifications are downstream effects, never financial commands.

A ledger posting or dispute change succeeds according to its own domain rules first. The notification trigger observes the authoritative state transition in the same database transaction. No mobile client fabricates notification records.

## Delivery architecture

Current architecture:

`Domain state change -> durable in-app notification -> mobile inbox`

Future optional architecture:

`Domain state change -> durable in-app notification -> delivery outbox/worker -> Expo Push / FCM / APNs / other channel`

Push delivery must never become the source of truth. A missed device push must not cause the inbox event itself to disappear.

## Mobile UX

The home screen queries unread inbox rows and displays a compact Latin-digit badge. Opening the notification screen lists recent events newest first. Unread rows can be marked read through the shared Session/Application boundary. Returning home refreshes the unread count.

Preview authentication never calls the real notification API.

## Verification before merge

The production migration must not be merged until all of the following are true:

1. GitHub CI is green: lint, typecheck, tests, Expo dependency check, Expo Doctor, Android bundle smoke test.
2. Migration is applied to the canonical Mumbai Supabase project.
3. Transactional verification proves event generation for customer posting, merchant dispute opening, customer dispute closure, ownership isolation, and idempotent read marking, with test data rolled back.
4. `anon` cannot execute notification RPCs.
5. `authenticated` cannot directly mutate `public.notifications`.
6. Supabase Security Advisor is clean; Performance Advisor findings are reviewed.

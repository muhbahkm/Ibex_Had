# IBEX HAD — Authenticated Client Runtime

## Goal

Mobile and Web must not construct or trust `actorUserId` themselves. The runtime binds the shared `IbexApplication` to the currently authenticated Supabase session and derives the actor from `auth.getUser()` before every use case.

## Composition

A platform creates its normal `@supabase/supabase-js` client, including the platform-specific session storage strategy. It then passes that client through `adaptSupabaseJsClient(...)` and into `createIbexSessionApplication(...)`.

Conceptually:

```text
SupabaseClient (Mobile/Web config)
  -> adaptSupabaseJsClient
  -> IbexSessionApplication
  -> IbexApplication
  -> SupabaseApplicationRepository
  -> narrow app_* RPC commands
  -> PostgreSQL invariants + RLS/permissions
```

`IbexSessionApplication` exposes the same business use cases without an actor argument. It obtains the authenticated user id from Supabase, constructs the internal `RequestContext`, and only then delegates to `IbexApplication`.

## Security properties

- A UI cannot choose another user's `actorUserId` through this runtime.
- Missing sessions stop before any application RPC is sent.
- `auth.getUser()` failures are surfaced as structured infrastructure errors.
- PostgreSQL independently verifies that the explicit actor in the RPC equals `auth.uid()`, so the runtime is convenience plus defense in depth, not the only authorization boundary.
- The runtime contains no money arithmetic and no duplicated financial rules.

## SDK dependency strategy

The shared runtime intentionally depends only on the structural interface needed from Supabase. `@supabase/supabase-js` remains a dependency of the concrete Mobile/Web application, where storage, deep-linking, refresh behavior, and platform lifecycle belong.

The SDK's RPC result is Promise-like rather than necessarily a native `Promise`; `adaptSupabaseJsClient` converts that shape into the repository runtime contract.

## Mobile session requirement

When the Expo app is created, its Supabase client must use secure persistent session storage appropriate for React Native, with token auto-refresh and app foreground/background handling. That platform configuration is Phase 4 work and does not change the Application/Domain contracts.

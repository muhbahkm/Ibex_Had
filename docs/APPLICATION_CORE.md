# IBEX HAD — Application Core v1

## Purpose

The Application Core is the single business-operation surface shared by Mobile, Web, future ChatGPT tools, and external integrations.

```text
Mobile / Web / ChatGPT / Integrations
              |
        Application Core
              |
      Infrastructure Ports
              |
   PostgreSQL / Supabase / APIs
```

Presentation clients do not implement financial behavior and do not directly compose ledger entries.

## Dependency rule

`packages/application` may depend on the framework-free domain primitives in `packages/core`.

It must not depend on:

- React / React Native / Expo
- Next.js
- Supabase client SDK types
- HTTP framework request/response objects
- UI state

Infrastructure implements the ports declared by the Application Core.

## Initial use cases

The initial provider-independent surface includes:

- `createBusiness`
- `createCustomer`
- `openCustomerAccount`
- `postSale`
- `postReceipt`
- `reverseTransaction`
- `getStatement`

Additional transaction types and dispute/document flows will be added through the same boundary rather than introduced directly in clients.

## Money contract

PostgreSQL stores monetary minor units as `bigint`. JavaScript `number` is not accepted as an API/domain money boundary because it cannot safely represent the full PostgreSQL bigint range.

External/API inputs therefore use decimal integer strings:

```json
{
  "amountMinor": "12500",
  "currencyCode": "SAR"
}
```

The Application Core validates the string and converts it directly to JavaScript `bigint` without a floating-point intermediate. Infrastructure must serialize bigint losslessly when crossing JSON/HTTP boundaries.

## Financial mappings

The Application Core maps human business intentions to domain effects:

- `postSale` -> `sale_on_account` + debit
- `postReceipt` -> `receipt` + credit
- `reverseTransaction` -> explicit reversal command, never an edit/delete

PostgreSQL remains the final invariant enforcement layer. Application validation improves correctness and developer ergonomics but never replaces database constraints.

## Idempotency

Every externally retryable financial command requires an explicit idempotency key. The Application Core validates key shape before infrastructure, while PostgreSQL enforces uniqueness within the documented business/source scope.

Future ChatGPT tools must generate/reuse operation-level idempotency keys for mutation requests so retries cannot silently duplicate financial facts.

## Authorization boundary

The Application Core always receives an authenticated `actorUserId` in `RequestContext`. Infrastructure is responsible for mapping that actor to the authorization checks / narrow server commands appropriate to the operation.

The presence of an actor ID is not itself authorization. Business membership/customer ownership is enforced at the infrastructure/database boundary as well.

## Statement contract

Statement requests are bounded (default 50, maximum 200) to avoid unbounded reads. Infrastructure will implement stable pagination using transaction time plus a deterministic tie-breaker when the Supabase adapter is introduced.

## Next step

Implement the Supabase/PostgreSQL adapter as narrow atomic commands. Financial write adapters must execute business mutation + ledger entries + audit event atomically and return the resulting balance without exposing direct `ledger_entries` writes to clients.

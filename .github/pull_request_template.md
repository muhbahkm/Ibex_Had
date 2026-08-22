## Summary

Describe the change and why it is needed.

## Scope

- [ ] Product/UI
- [ ] Domain/Application logic
- [ ] Database/Migration/RLS
- [ ] Infrastructure/CI
- [ ] Documentation only

## Financial safety

- [ ] No financial behavior changed
- [ ] Financial invariants were reviewed and tested
- [ ] No client writes ledger entries directly
- [ ] Idempotency/reversal behavior was considered where applicable

## Verification

- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Supabase change applied and verified, if applicable
- [ ] Security Advisor checked after material DDL, if applicable
- [ ] Performance Advisor checked after material DDL, if applicable
- [ ] Notion updated for material product/architecture/status changes

## Database drift

Confirm there are no manual production changes that are missing from repository migrations.

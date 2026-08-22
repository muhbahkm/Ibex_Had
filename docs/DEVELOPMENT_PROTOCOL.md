# Development Protocol

## Three synchronized project surfaces

### Notion
Decision record, product scope, architecture rationale, roadmap, and cross-session handoff context.

### GitHub
Source of truth for code, migrations, tests, CI/CD, security docs, architecture docs, and reproducible implementation.

### Supabase
Running backend state: PostgreSQL, Auth, RLS, Storage, Edge Functions, and deployed database behavior.

## Change workflow

1. Understand and document the decision in Notion when it has durable product/architecture value.
2. Implement code and database migrations in GitHub first whenever possible.
3. Apply the tracked migration/deployment to Supabase.
4. Verify tests, RLS, security/performance advisors, and CI status.
5. Update Notion with the resulting implementation state and any new decision made during delivery.

## Schema rule

Every production DDL change must have a migration in GitHub. Avoid manual production-only changes that cannot be reproduced from source control.

## Definition of done

A meaningful batch is not complete until:

- Notion reflects the current decision/state.
- GitHub contains implementation, migration, and tests as applicable.
- Supabase matches the intended GitHub state.
- Verification has been performed and drift is understood/resolved.

Documentation-only changes do not require artificial database mutations, but Supabase should still be checked when the change claims or affects deployed backend state.

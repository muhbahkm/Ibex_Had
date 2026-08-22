# Supabase

Project: `Ibex_Had`

The Supabase project was created and verified healthy on 2026-08-22. At the time of repository bootstrap it intentionally contained no application tables, no application migrations, and no Edge Functions.

## Rule

Do not make untracked production DDL changes. New schema, RLS policies, SQL functions, indexes, triggers, and other database objects must be introduced through migrations stored in this repository, then applied to Supabase and verified.

## Current phase

Schema implementation has not started yet. The financial Schema v1 blueprint is documented in Notion and must be reviewed/finalized before the first migration is created.

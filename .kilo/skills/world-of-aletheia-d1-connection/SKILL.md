---
name: world-of-aletheia-d1-connection
description: Connect to, inspect, or wire Cloudflare D1 access in World of Aletheia, including the current world-of-aletheia databases, Wrangler commands, Astro runtime bindings, migrations, and safe verification steps.
---

# World of Aletheia D1 Connection

Use this skill when asked to connect to, inspect, debug, or implement access to Cloudflare D1 in this repository.

## Goal

Produce repo-grounded instructions or code changes for D1 access without guessing about bindings, environments, or schema state.

## Current database facts

Source of truth: `wrangler.jsonc`

- Binding name: `DB`
- Production database name: `world-of-aletheia`
- Production database ID: `38825456-2299-45de-a25e-ee1b98bea6ec`
- Staging database name: `world-of-aletheia-staging`
- Staging database ID: `500030de-a6b3-47dc-8ab7-dd51128f35c8`
- Local development uses Wrangler local D1 via `wrangler d1 execute DB --local ...`

Do not hardcode database IDs into application code. Application/runtime code should rely on the `DB` binding.

## What to inspect

1. Project foundations
   - `package.json`
   - `wrangler.jsonc`
   - `src/env.d.ts`

2. Runtime D1 access
   - `src/lib/d1.ts`
   - `src/lib/auth.ts`
   - any repo using `getD1BindingFromLocals()`

3. Build-time or script-driven D1 access
   - `src/lib/content-index-loader.mjs`
   - `scripts/db-migrate-auth-plan.mjs`
   - `scripts/content-sync/*.mjs`

4. Schema and operational docs
   - `migrations/*.sql`
   - `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`
   - relevant ADRs, especially `plans/adrs/0016-d1-as-canonical-cloud-content-index-and-r2-blob-storage.md`

## Connection modes in this repo

### 1. Worker runtime access

Use this when the code runs inside the Cloudflare runtime.

Canonical pattern in this repo:

```ts
const { env } = await import('cloudflare:workers');
const db = env.DB;
```

Preferred helper:

- `src/lib/d1.ts`
- `getD1BindingFromLocals()` is the project wrapper

Important repo rule:

- In Astro v6 Cloudflare, this project treats `cloudflare:workers` as canonical.
- Do **not** rely on `Astro.locals.cfContext` for D1 in API routes.

### 2. CLI / operator access with Wrangler

Use this when inspecting, verifying, migrating, or querying D1 from the terminal.

Read-only environment checks:

```bash
pnpm wrangler whoami
pnpm wrangler d1 list
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging
```

Read-only query examples:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Use `--json` when the result will be parsed by code or a script.

### 3. Build-time lookup access

This repo also reads D1 from Node-based build helpers via Wrangler subprocess calls.

Relevant env contract:

- `CONTENT_LOADER_D1_MODE=local|remote`
- `CONTENT_LOADER_D1_ENV=staging|<empty for prod>`

Current pattern:

- `src/lib/content-index-loader.mjs` shells out to `wrangler d1 execute DB`
- local mode uses `--local`
- remote mode uses `--remote`
- staging adds `--env staging`

## Current D1 responsibilities in this project

The D1 databases are not only for auth. They currently back:

- Better Auth tables: `user`, `account`, `session`, `verification`
- Campaign access data: `campaign_memberships`
- Cloud content lookup: `content_index`
- Cloud search index: `content_search` and `content_search_fts`

Per ADR 0016, D1 is the canonical cloud content index and R2 stores blobs only.

## Local workflow guidance

- `pnpm dev` is the fast UI/content lane, not the authoritative D1/auth parity lane.
- Use `pnpm dev:cf` or `pnpm dev:cf:auth` when verifying Cloudflare runtime behavior with D1 bindings.
- Ensure schema is current before parity testing:

```bash
pnpm db:migrate:plan:local
```

Optional local seed:

```bash
pnpm db:seed:memberships:local
```

## Migration workflow

Migration runner source:

- `scripts/db-migrate-auth-plan.mjs`

Ordered migration set currently includes:

- `0001_campaign_memberships.sql`
- `0002_campaign_gm_assignments.sql`
- `0003_auth_core.sql`
- `0004_auth_email_hardening.sql`
- `0005_campaign_gm_assignments_multi.sql`
- `0006_content_index.sql`
- `0007_content_index_r2_lookup.sql`
- `0008_content_index_collection_scoped_identity.sql`
- `0009_campaign_memberships_role_unification.sql`
- `0010_drop_campaign_gm_assignments.sql`
- `0011_content_search_fts.sql`

Preferred commands:

```bash
pnpm db:migrate:plan:local:dry-run
pnpm db:migrate:plan:staging:dry-run
pnpm db:migrate:plan:prod:dry-run

pnpm db:migrate:plan:local
pnpm db:migrate:plan:staging
pnpm db:migrate:plan:prod
```

Use `:force` variants only when collision/conflict behavior is understood and explicitly intended.

## Safe verification queries

Use these first when validating connectivity:

```sql
SELECT 1 AS ok;
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
PRAGMA table_info(content_index);
SELECT COUNT(*) AS total_rows FROM content_index;
SELECT collection, COUNT(*) AS row_count FROM content_index GROUP BY collection ORDER BY collection;
SELECT campaign_slug, user_id, role FROM campaign_memberships ORDER BY campaign_slug, user_id;
```

## Output format

Return bullets under these headings:

- **Current D1 topology**
- **How to connect with Wrangler**
- **How runtime code should access D1**
- **Required bindings and env**
- **Schema or migration state**
- **Verification queries**
- **Risks or gotchas**

## Rules

- Be precise and repo-specific.
- Prefer `pnpm` commands only.
- Prefer read-only verification before any write path.
- Prefer local or staging before production for validation.
- Do not recommend direct production mutations unless the user explicitly asks for them.
- Do not suggest `Astro.locals.cfContext` as the primary D1 access path in this repo.
- Do not invent table names or bindings; confirm them from `wrangler.jsonc`, migrations, or repo code.
- Distinguish clearly between runtime D1 access and build/script Wrangler access.
- If local D1/auth behavior matters, steer verification toward `pnpm dev:cf` or `pnpm dev:cf:auth`, not plain `pnpm dev`.

## Example summary shape

- **Current D1 topology:** Production uses `DB -> world-of-aletheia`; staging uses `DB -> world-of-aletheia-staging`; local uses Wrangler `--local` D1 state.
- **How to connect with Wrangler:** Use `pnpm wrangler d1 execute DB --local|--remote [--env staging] --command "SELECT 1 AS ok;"` plus `d1 info` for environment verification.
- **How runtime code should access D1:** Import `env` from `cloudflare:workers` or use `getD1BindingFromLocals()` from `src/lib/d1.ts`; do not depend on `locals.cfContext` in API routes.
- **Required bindings and env:** Binding must be named `DB`; build-time lookups may also depend on `CONTENT_LOADER_D1_MODE` and `CONTENT_LOADER_D1_ENV`.
- **Schema or migration state:** Auth, campaign membership, content index, and content search tables are created through the ordered migrations in `scripts/db-migrate-auth-plan.mjs`.
- **Verification queries:** Start with `SELECT 1`, table listing, then inspect `content_index` and `campaign_memberships` counts.
- **Risks or gotchas:** `pnpm dev` is not the parity lane for D1/auth, and this repo's Astro v6 Cloudflare runtime expects D1 from `cloudflare:workers`.

# Option A2 Static Audit Handoff to Code (2026-03-09)

## Scope and constraints

This handoff is **design-and-plan only** (no live DB assumptions).

- Source artifacts audited:
  - `scripts/operator-sql/*.sql`
  - `src/lib/auth.ts`
  - `src/pages/login.astro`
  - `src/pages/api/auth/[...all].ts`
  - `migrations/0001_campaign_memberships.sql`
  - `migrations/0002_campaign_gm_assignments.sql`
- No reliance on dev fixtures or repository example identities.
- Verified-vs-unverified stance applies: production identity/assignment claims require production query evidence.

---

## Static findings

## 1) UI auth flow expectations from code

### UI and runtime are email-dependent

- Email signup/signin forms exist:
  - `/api/auth/sign-in/email`
  - `/api/auth/sign-up/email`
  - with required email inputs in `src/pages/login.astro`
- Better Auth config enables email/password in `src/lib/auth.ts`:
  - `emailAndPassword.enabled = true`
  - `requireEmailVerification = false`
- Auth handler route is active in `src/pages/api/auth/[...all].ts`.

### Verification behavior configured as optional/disabled by default

- `requireEmailVerification: false`
- `sendOnSignUp: false`
- `sendOnSignIn: false`
- Verification sender hook exists, but verification persistence requirements are not represented in repo migrations.

## 2) Persistence expectations implied by code and operator SQL

From `src/lib/auth.ts` and operator SQL templates, expected Better Auth persistence includes:

1. `user`
   - expected fields used by operator SQL: `id`, `email`, `name`, `createdAt`, `updatedAt`
2. `account`
   - expected fields in template: `id`, `accountId`, `providerId`, `userId`, token fields, timestamps
3. `session`
   - required by Better Auth runtime/session retrieval
4. `verification`
   - required for robust verification token/challenge lifecycle when verification is enabled

## 3) Current schema coverage in repository

Current checked-in migrations only define campaign assignment tables:

- `campaign_memberships`
- `campaign_gm_assignments`

There is **no checked-in auth core migration** for `user/account/session/verification`.

## 4) Schema/data-shape gaps that block production-safe email auth

1. Missing auth core DDL artifact in repository.
2. No repo-level guarantee that `user.email` exists and is `NOT NULL`.
3. No repo-level case-insensitive uniqueness guarantee for email.
4. No canonical email normalization strategy at schema level.
5. No verification table/index/expiry constraints defined in migrations.
6. Operator identity resolution uses `lower(email)` but no canonical storage/index policy ensures deterministic lookup.
7. No explicit conflict policy for case/whitespace-colliding email identities.

---

## Production-safe Option A2 refactor plan (for Code)

## Phase A — Add forward-only idempotent auth migrations

### A1. Add auth core migration

Add:

- `migrations/0003_auth_core.sql`

Must define (with `CREATE TABLE IF NOT EXISTS` and required indexes/constraints):

1. `user`
2. `account`
3. `session`
4. `verification`

Minimum safety requirements:

- `user.email` present and `NOT NULL`
- `user.emailVerified` present and non-null default (`0/false`)
- timestamp fields present on core tables
- account uniqueness at least `(providerId, accountId)`
- session lookup index on `session.userId`
- verification token/challenge uniqueness and expiry field support

### A2. Add auth email hardening migration

Add:

- `migrations/0004_auth_email_hardening.sql`

Goals:

1. Deterministic canonicalization (`trim(lower(email))` policy).
2. Backfill canonical data.
3. Detect conflicts before uniqueness enforcement.
4. Enforce unique canonical email only after conflicts are resolved.

Implementation guidance (non-destructive):

- If adding `email_canonical` column:
  - populate from existing `email`
  - index/unique on canonical column
- If normalizing in place:
  - update `email = trim(lower(email))`
  - enforce unique index with collision guard

### A3. Conflict policy (mandatory)

No auto-merge, no auto-delete.

- Introduce `auth_email_conflicts` table (or equivalent) during hardening migration.
- If duplicates collide on canonical email:
  - write conflict rows
  - stop short of final uniqueness enforcement
  - require operator adjudication runbook step

---

## Phase B — Harden Option A2 operator SQL bundle

## B1. Add/adjust templates

Add templates:

1. `scripts/operator-sql/templates/user-upsert.sql`
2. `scripts/operator-sql/templates/user-email-update.sql`
3. `scripts/operator-sql/templates/verification-upsert.sql` (only if verification operations are operator-managed)

Update templates:

- `identity-resolution.sql`
  - resolve by canonical email first, name secondary
  - return deterministic result flags (0/1/many)
- `account-link-upsert.sql`
  - include precondition check comments and verification query snippets to ensure referenced `userId` exists

## B2. Strengthen preflight/verify SQL

Update:

- `scripts/operator-sql/preflight.sql`
- `scripts/operator-sql/verify.sql`
- `scripts/operator-sql/audit.sql`

Add checks for:

1. table existence for `user/account/session/verification`
2. required column presence (`email`, `emailVerified`, verification expiry fields)
3. unique/index presence for canonical email and provider-account tuple
4. data-quality checks:
   - null/empty emails
   - non-canonical email rows
   - duplicate canonical emails

---

## Phase C — Command wrappers and execution order

## C1. `package.json` scripts to add

Add explicit wrappers (staging + prod):

1. `db:migrate:auth:staging`
2. `db:migrate:auth:prod`
3. `db:migrate:email-hardening:staging`
4. `db:migrate:email-hardening:prod`

Keep existing Option A2 wrappers and ensure sequence docs align.

## C2. Ordered apply sequence (staging first, then production)

Document as exact order:

1. `0001_campaign_memberships.sql`
2. `0002_campaign_gm_assignments.sql`
3. `0003_auth_core.sql`
4. `0004_auth_email_hardening.sql`

Then Option A2 operations:

- preflight
- identity resolution (if needed)
- apply operation SQL file
- verify
- audit

---

## Phase D — Runbook and plan doc updates

Update these docs to final production guidance:

1. `docs/runbook/phase-2-1-auth-google-d1-cloudflare-email.md`
2. `plans/auth-mvp-production-readiness-plan-2026-03.md`
3. `plans/auth-production-account-management-mvp-options-2026-03.md`

Required content updates:

- D1-native auth + assignment source of truth
- canonical email policy and conflict handling
- explicit acceptance criteria for:
  - UI signup/signin by email
  - optional verification mode (disabled)
  - future verification-required readiness
  - deterministic operator lookup by email
- failure modes and mitigations (no destructive rollback assumptions)

---

## Acceptance criteria for Code completion

All must be satisfied:

1. Repository contains forward-only idempotent migrations for auth core + email hardening.
2. Preflight verifies auth tables and required email/verification columns and indexes.
3. Canonical email uniqueness is enforceable with explicit collision handling policy.
4. Operator lookup by email is deterministic under canonicalization policy.
5. Option A2 scripts/runbook provide repeatable staging-first then production execution sequence.
6. No operational path requires deleting data or rollback-dependent destructive steps.

---

## Assumptions / dependencies

1. Better Auth table naming is compatible with planned migration names or is explicitly mapped in docs.
2. Cloudflare D1 supports required constraints/indexes used in migrations.
3. Operator process remains manual-first (Option A2), with private SQL execution files.

---

## Failure modes and mitigations

1. **Canonical email collisions**
   - Mitigation: conflict table + pause uniqueness enforcement until adjudicated.
2. **Provider account link collisions**
   - Mitigation: unique constraint on `(providerId, accountId)` and deterministic upsert policy.
3. **Template/schema drift**
   - Mitigation: preflight column/index checks before apply.
4. **Ambiguous operator identity resolution**
   - Mitigation: canonical-email-first lookup with explicit many-match guard.

---

## Notes to Code

This handoff is intentionally static and does not rely on current remote DB state. Implement against repository artifacts and migration-first discipline so operators can execute Option A2 safely once environments are provisioned.

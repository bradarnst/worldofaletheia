# Remove `email_canonical` Refactor Plan

## Goal

Simplify auth identity storage so `user.email` is the single email identity field. All persisted and compared emails should use `trim(lower(email))`; `email_canonical` should be removed from runtime code, diagnostics, docs, and future schema expectations.

## Current Findings

- Better Auth's built-in user schema lowercases email values (`email: z.string().transform((val) => val.toLowerCase())` in the installed package), but it does not visibly enforce trimming at the repo boundary.
- Current project migrations added a non-standard `user.email_canonical` column in `migrations/0003_auth_core.sql` and unique canonical index in `migrations/0004_auth_email_hardening.sql`.
- Production/historical rows have already been checked by the operator and all current `email` values are lowercase and all `email_canonical` values are populated.
- Runtime campaign-member add-by-email currently queries `email_canonical` first and falls back to `lower(email)`.
- The migration runner, operator SQL diagnostics, handoff docs, old plans, and the local Better Auth skill instructions all reference `email_canonical`.
- The active user preference is simplicity: do not preserve email case, do not carry a duplicate app-specific canonical field, and rely on lowercase `email` as the source of truth.

## Target State

- `user.email` is `TEXT NOT NULL` and stores only `trim(lower(email))`.
- `user.email` has a unique index for identity uniqueness.
- No runtime code reads or writes `user.email_canonical`.
- New database setup no longer creates `email_canonical`.
- Existing databases get a forward migration that removes `email_canonical` after validating normalized, unique `email` values.
- Operator diagnostics check `email` directly for null/empty, non-normalized, and duplicate normalized groups.
- Documentation says canonical email policy means normalized `user.email`, not a separate column.

## Implementation Steps

1. Add a small shared email normalization helper.

   - Create or update a utility near auth code, for example `src/lib/email-normalization.ts` or an auth-local helper.
   - Implement `normalizeEmail(value: string): string` as `value.trim().toLowerCase()`.
   - Use this helper anywhere project code accepts an email before passing it to Better Auth or D1 lookup.
   - Keep the helper minimal; no dependency and no elaborate RFC email handling.

2. Normalize email before Better Auth receives email/password form submissions.

   - Update `/api/auth/[...all].ts` to wrap only relevant auth requests before calling `auth.handler(request)`.
   - For `POST /api/auth/sign-in/email`, `POST /api/auth/sign-up/email`, and password-reset/email flows if present, parse form or JSON bodies and replace `email` with `normalizeEmail(email)`.
   - Preserve all other request fields and headers.
   - Avoid changing Google OAuth callback behavior; Better Auth already lowercases provider emails, and social flow bodies are not the same as credential forms.
   - If wrapping Better Auth request bodies is too invasive, use client-side lowercase as a supplemental UX measure only, not as the primary invariant.

3. Change runtime account lookup to use `email` only.

   - Update `CampaignMembershipRepo.findUserByExactEmail()` to query:
     ```sql
     SELECT id AS user_id, name AS display_name, email
     FROM "user"
     WHERE email = ?1
     ORDER BY id ASC
     LIMIT 2
     ```
   - Keep `LIMIT 2` and duplicate fail-closed handling until the unique email index is fully deployed everywhere.
   - Update tests to assert `email = ?1` and remove `email_canonical` expectations.
   - Keep `parseCampaignMemberEmailAddRequest()` normalizing input to `trim(lower(email))`.

4. Add a forward D1 migration to remove `email_canonical` safely.

   - Add a new migration after the latest existing migration, for example `migrations/0011_drop_email_canonical.sql`.
   - Use a rebuild-table pattern for SQLite/D1 compatibility rather than relying on `ALTER TABLE DROP COLUMN`.
   - Precondition intent:
     - no null/empty `email`
     - no rows where `email <> trim(lower(email))`
     - no duplicate `email` values
   - Migration outline:
     ```sql
     DROP TABLE IF EXISTS user_next;

     CREATE TABLE user_next (
       id TEXT PRIMARY KEY,
       name TEXT,
       email TEXT NOT NULL,
       emailVerified INTEGER NOT NULL DEFAULT 0 CHECK (emailVerified IN (0, 1)),
       image TEXT,
       createdAt TEXT NOT NULL,
       updatedAt TEXT NOT NULL
     );

     INSERT INTO user_next (id, name, email, emailVerified, image, createdAt, updatedAt)
     SELECT id, name, trim(lower(email)), emailVerified, image, createdAt, updatedAt
     FROM "user"
     WHERE email IS NOT NULL AND trim(email) <> '';

     DROP TABLE "user";
     ALTER TABLE user_next RENAME TO "user";

     CREATE UNIQUE INDEX idx_user_email_unique ON "user"(email);
     CREATE INDEX idx_user_created_at ON "user"(createdAt);
     ```
   - Confirm all indexes needed by Better Auth are recreated after the table rebuild.
   - Because `account`, `session`, and `campaign_memberships` do not declare foreign keys in current migrations, table rebuild should not require FK juggling, but validate against D1 behavior in staging first.

5. Update base auth migrations for new local installs.

   - Update `migrations/0003_auth_core.sql` so new databases do not create `email_canonical`.
   - Replace `idx_user_email` with a unique email index, preferably `idx_user_email_unique`.
   - Update `migrations/0004_auth_email_hardening.sql` to normalize `email` and create/enforce unique `email`, without backfilling or indexing `email_canonical`.
   - Keep historical migration numbering; do not remove old migration files.
   - Ensure the migration runner can handle databases that already applied the older shape and fresh databases created after the migration-file edits.

6. Update the migration runner.

   - In `scripts/db-migrate-auth-plan.mjs`, remove `email_canonical` from `requiredUserColumns`.
   - Replace `users_with_missing_email_canonical` metrics with direct email uniqueness/normalization metrics.
   - Update dry-run summary text from "backfill email_canonical" to "normalize and uniquely index user.email".
   - Remove forced-collision code that updates `email_canonical`; keep any collision handling focused on rewriting `email` only when `--force` is explicitly used.
   - Ensure the ordered migration list includes the new `0011_drop_email_canonical.sql`.

7. Update operator diagnostics.

   - Update `scripts/operator-sql/preflight.sql`, `verify.sql`, and `audit.sql` to remove column/index checks for `email_canonical`.
   - Replace duplicate checks with grouping by `email` or `trim(lower(email))`.
   - Remove `email_canonical` from selected user audit output.
   - Keep privacy posture: diagnostics can show targeted operational rows, but do not add broad dumps beyond existing behavior.

8. Update contracts and docs.

   - Update `docs/handoff/woa-admin-user-account-management-handoff.md` to say `user.email` is the normalized identity lookup field.
   - Update `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md` and `scripts/operator-sql/README.md` to remove references to a separate canonical column.
   - Update active plans/handoffs that are still relevant, especially `.kilo/plans/campaign-member-email-add-hld-handoff.md`, to use normalized `email` only.
   - Historical plans can be left alone if they are clearly archival, but any current handoff or implementation guidance should not recommend `email_canonical`.
   - Update `.kilo/skills/world-of-aletheia-better-auth-accounts/SKILL.md` so future agents do not reintroduce `email_canonical`.

9. Update uncommitted campaign admin/member work.

   - Keep the accepted risk documentation for exact-email add-by-email account discovery in the appropriate handoff/contract note: campaign GMs are trusted for exact-email add, with audit/rate-limit as mitigations.
   - Remove `CloudflareAccess` from campaign-scoped public-site endpoint security in `docs/contracts/user-account-management-api.openapi.yaml` while touching the contract.
   - Ensure add-member contract language says exact email is normalized to `trim(lower(email))` and matched against `user.email`.

10. Verification.

   - Run `pnpm test`.
   - Run `pnpm db:migrate:plan:local:dry-run`.
   - Run `pnpm db:migrate:plan:local` against local D1.
   - Run `pnpm dev:cf:auth` and verify:
     - email sign-up stores lowercase `email`
     - email sign-in works with mixed-case input
     - Google sign-in/account linking still works
     - campaign member add by exact email works with mixed-case input
   - Run staging dry-run before any remote apply:
     - `pnpm db:migrate:plan:staging:dry-run`
     - `pnpm run ops:a2:preflight:staging`
   - Apply staging, verify, then repeat for production only after staging confirms no duplicate/non-normalized email issues.

## Rollout Notes

- This is a schema simplification with production DB impact, so deploy code and migration sequencing matters.
- Preferred sequence:
  1. Ship code that no longer depends on `email_canonical` but still works while the old column exists.
  2. Apply migration that drops `email_canonical` and creates unique `user.email`.
  3. Verify production auth and campaign member add-by-email.
- Do not delete the old column before runtime code has stopped querying it.
- Do not proceed if preflight finds duplicate or non-normalized emails; repair those explicitly first.

## Open Decisions

- Decide whether historical/archival plans under `plans/` should be updated for search hygiene or left unchanged as historical records. Recommendation: update active handoffs/runbooks/skills and leave clearly historical implementation plans alone unless they are still used as guidance.
- Decide whether to enforce lowercase at the UI with `input` event normalization. Recommendation: do not rely on UI enforcement; normalize server-side before Better Auth and D1 lookups.

# Auth, User Onboarding, and RBAC MVP Production Readiness Plan (2026-03)

## Status

- Date: 2026-03-15
- Scope: MVP production readiness for Better Auth + D1 + campaign RBAC
- Status: Implemented (staging + production) via Option A2 runbook
- Active path: **Option A2** (Wrangler-applied D1 SQL files)
- Posture: static-first, low-risk, operator-driven

## Evidence and identity disclaimer

- Personal names in repository examples are fictional placeholders, not identity assertions.
- Production identity/assignment claims are valid only when confirmed by production query output.
- Without successful production query output, user/assignment state is **unverified**.

---

## 1) MVP objective

Launch production with:

1. Better Auth identities persisted in D1.
2. Campaign assignment state managed in D1 only.
3. Operator-safe SQL workflow (preflight → apply → verify → audit) using Wrangler.
4. No real account/assignment details in Git-tracked files.

---

## 2) Current-state summary

### Implemented

- Auth runtime plumbing exists in `src/lib/auth.ts`, `src/lib/auth-session.ts`, `src/pages/api/auth/[...all].ts`.
- Campaign authorization seam exists in `src/utils/campaign-access.ts`.
- Membership persistence table exists in `migrations/0001_campaign_memberships.sql`.
- Auth core + email hardening migration artifacts exist in `migrations/0003_auth_core.sql` and `migrations/0004_auth_email_hardening.sql`.

### Verification evidence (2026-03-15)

1. Auth + email hardening migrations (`0001`–`0004`) applied in staging and production with `ops:a2:preflight/apply/verify/audit` wrappers per runbook.
2. Runtime GM lookup now reads D1 (`campaign_gm_assignments`) in staging/production; legacy config path remains dev-only fallback (see Option 2 LLD).
3. Operator workflow for Option A2 documented in `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md` and executed during rollout; private logs capture staging + production evidence.

---

## 3) Active MVP operations model (Option A2)

### Source of truth

1. Identity/auth tables: Better Auth tables in D1.
2. Membership assignments: `campaign_memberships` in D1.
3. GM assignments: `campaign_gm_assignments` in D1.
4. Canonical email identity: `user.email_canonical = trim(lower(email))` with fail-fast collision detection in migration workflow.

### Operator mechanism

Use Wrangler `d1 execute --file` with placeholder-only templates copied to private gitignored operator files.

Repository components:

- Migration: `migrations/0002_campaign_gm_assignments.sql`
- Operator SQL bundle: `scripts/operator-sql/`
- SOP: `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md` (Section 12)
- Command wrappers: `package.json` `ops:a2:*` scripts

---

## 4) Required execution sequence

### Phase A — Preflight and schema

1. `pnpm wrangler whoami`
2. `pnpm wrangler d1 list`
3. Apply migrations in strict order on staging, then production:
   - `0001_campaign_memberships.sql`
   - `0002_campaign_gm_assignments.sql`
   - `0003_auth_core.sql`
   - `0004_auth_email_hardening.sql`
4. `pnpm run ops:a2:preflight:staging`
5. `pnpm run ops:a2:preflight:prod`
6. If preflight shows missing shape/indexes, stop and fix migration state before any assignment changes.

### Phase B — Identity resolution and operation prep

1. Copy template from `scripts/operator-sql/templates/` to private `./.wrangler/operators/` file.
2. Resolve identity ambiguity with `scripts/operator-sql/identity-resolution.sql` if needed.
3. Confirm target env explicitly (staging first, production second).

### Phase C — Apply and verify

1. `OP_FILE=... pnpm run ops:a2:apply:staging`
2. `pnpm run ops:a2:verify:staging`
3. `OP_FILE=... pnpm run ops:a2:apply:prod`
4. `pnpm run ops:a2:verify:prod`

### Phase D — Audit and incident logging

1. `pnpm run ops:a2:audit:prod`
2. Record private incident/operation log entry (no PII in Git).

---

## 5) Failure handling and rollback rules

1. Do not retry failed SQL blindly.
2. Fix root cause, rerun preflight, then re-apply once.
3. Use inverse templates for mistaken assignments:
   - membership grant ↔ membership revoke
   - GM upsert ↔ GM revoke
   - account-link upsert ↔ account-link revoke
4. Verify after every correction.
5. For canonical email collisions: fail fast by default; resolve manually or use approved `--force` override, then re-run preflight/verify/audit.

---

## 6) MVP done definition (strict minimal)

MVP is done only when all are true:

1. Staging and production have required assignment tables (`campaign_memberships`, `campaign_gm_assignments`) and auth tables.
2. Operators can run end-to-end Option A2 flow with wrappers:
   - `ops:a2:preflight:*`
   - `ops:a2:apply:*`
   - `ops:a2:verify:*`
   - `ops:a2:audit:*`
3. Campaign assignment updates and revocations are deterministic/idempotent where feasible.
4. Production assignment claims are backed by production query output.
5. No real identity/assignment data appears in tracked repository files.
6. Canonical email lookup is deterministic (canonical-first) and collision policy is explicit and non-destructive.

---

## 7) Post-MVP follow-up

1. Update runtime GM resolution path to D1-first in `src/utils/campaign-access.ts`.
2. Add auth core migration artifact if still missing.
3. Consider protected admin API (Option B) only after repeated manual-op pain.

# Auth, User Onboarding, and RBAC MVP Production Readiness Plan (2026-03)

## Status

- Date: 2026-03-06
- Scope: MVP production readiness for Better Auth + D1 + campaign RBAC
- Decision posture: static-first, incremental, low-ops-risk

## 1) Current State Assessment (from repository + live diagnostics)

### 1.1 What is already implemented

- Better Auth runtime initialization and route proxy are implemented in:
  - `src/lib/auth.ts`
  - `src/pages/api/auth/[...all].ts`
- Session resolution for request-time authorization is implemented in:
  - `src/lib/auth-session.ts`
- Campaign authorization seam is implemented with deny-by-default behavior in:
  - `src/utils/campaign-access.ts`
- Campaign membership persistence integration is implemented in:
  - `src/lib/campaign-membership-repo.ts`
  - `migrations/0001_campaign_memberships.sql`
- Login/account/logout UI exists in:
  - `src/pages/login.astro`
  - `src/pages/account.astro`
  - `src/pages/logout.astro`

### 1.2 What is currently blocking MVP production readiness

1. **Remote D1 schema is uninitialized**
   - Live diagnostics show `num_tables = 0` for both staging and production databases.
2. **Auth core tables are not present in repo migrations**
   - Only `campaign_memberships` migration exists under `migrations/`.
3. **RBAC assignment source is still JSON in repo**
   - `src/content/campaigns/access.config.json` currently carries `memberships` and `gmAssignments`.
   - This is acceptable as bootstrap/local fallback, but not ideal as authoritative production assignment system.
4. **No production operations runbook for user/membership inventory and correction**
   - Existing runbook does not provide explicit remote inspection commands for auth users + memberships.

### 1.3 Clarification on prior authorization error (7403)

- `wrangler whoami`, `wrangler d1 list`, and `wrangler d1 info` succeeded against the target account/db IDs.
- Therefore, current root blocker is not account mismatch; it is empty DB schema.
- Keep 7403 as a known intermittent failure class, but do not treat it as primary blocker now.

---

## 2) Precise RBAC Assessment (including user-specific assignments)

### 2.1 Runtime enforcement model that exists today

Authorization at runtime is implemented in `src/utils/campaign-access.ts`:

- Visibility gate values: `public | campaignMembers | gm`
- Decision behavior:
  - `public`: always allow
  - `campaignMembers`: allow member OR GM
  - `gm`: allow GM only
- Membership source (primary): D1 table `campaign_memberships`
- GM source (current): `gmAssignments` JSON (repo/env)
- Failure mode: deny-by-default when session/db checks fail

### 2.2 What role/permission assignment configuration exists today

Current assignment inputs:

1. **Membership assignments**
   - Source file: `src/content/campaigns/access.config.json` (`memberships` object)
   - Optional env override: `CAMPAIGN_MEMBERSHIPS` (legacy fallback pathway)

2. **GM assignments**
   - Source file: `src/content/campaigns/access.config.json` (`gmAssignments` object)
   - Optional env override: `CAMPAIGN_GM_ASSIGNMENTS`

3. **`campaign_memberships.role` column**
   - Exists in schema, currently default/seeded as `'member'`
   - Not currently used as an authorization input

4. **Better Auth native role plugin**
   - Not configured in `src/lib/auth.ts`
   - No platform-wide user roles (e.g., admin/editor) are currently active in auth runtime

### 2.3 Explicit assignment status for Andy / specific users

- Current repository assignment entries include `jim`, `fred`, `martha`, `tom`, `nancy`, `bob` in `src/content/campaigns/access.config.json`.
- **No assignment entry exists for `andy` (or `Andy`) in repository config.**
- Since production DB currently has zero tables, there are also no persisted production assignments yet.

Conclusion:
- Campaign RBAC logic exists and is wired.
- Assignment data exists only in bootstrap JSON (not production-safe as long-term source of truth).
- No current assignment for Andy.

---

## 3) Recommended MVP Target Approach (low risk, low ops overhead)

### 3.1 Must-change-now (MVP gate)

1. Initialize staging + production DB schemas (auth core + campaign memberships).
2. Manually ingest initial real users (you + brother) directly into auth user table if needed.
3. Manually insert campaign memberships in D1.
4. Keep GM mapping in env (`CAMPAIGN_GM_ASSIGNMENTS`) for MVP, not hardcoded in repo JSON for production.
5. Disable production reliance on `CAMPAIGN_MEMBERSHIPS` legacy fallback.
6. Run strict smoke validations before promoting.

### 3.2 Should-change-soon (post-MVP hardening)

1. Move GM assignments from env/JSON to D1 table (`campaign_gm_assignments`).
2. Add minimal admin-only ops script(s) for membership + GM updates.
3. Add staging/prod audit commands to runbook.

### 3.3 Later (defer)

1. Full Better Auth RBAC plugin / generalized app roles.
2. Self-service onboarding and invitation UI.
3. Discord auth and account linking.

Rationale:
- This matches ADR/YAGNI direction and avoids premature framework/abstraction work.
- It accepts your explicit decision to manually ingest initial users.

---

## 4) Concrete Implementation Plan (file changes + commands)

## Phase A — Schema and environment readiness (blocking)

### A1. Add auth core migration SQL artifact

**Add file:** `migrations/0002_auth_core.sql`

Content should create Better Auth required tables for your configured features (email/password + social + sessions + verification).

Minimum expected table set (exact names depend on Better Auth adapter schema):
- user table
- session table
- account table
- verification table

> Implementation note: generate this from Better Auth migration tooling or from a known-good schema for Better Auth v1.5.3 on SQLite/D1, then check it into repo.

### A2. Add remote migration scripts

**Edit:** `package.json`

Add scripts:
- `db:migrate:staging` → apply `0001_campaign_memberships.sql` + `0002_auth_core.sql` with `--remote --env staging`
- `db:migrate:prod` → same for production (`--remote`)

### A3. Keep Wrangler env contract explicit

**Edit:** `wrangler.jsonc`

No architecture change needed, but verify:
- `d1_databases` IDs are correct for prod/staging
- `BETTER_AUTH_URL` values are correct per env
- no `CAMPAIGN_MEMBERSHIPS` var in production env
- if using env override for GM mapping, set only `CAMPAIGN_GM_ASSIGNMENTS`

### A4. Validate migration applied

Run:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Pass criteria:
- expected auth tables exist
- `campaign_memberships` exists

---

## Phase B — Initial user onboarding (manual, accepted for MVP)

### B1. Identify actual auth user table name

Run on staging first:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%user%';"
```

### B2. Manual ingest first two real users (you + brother)

Approach options (pick one for MVP):

1. **Preferred:** create via actual `/login` flow (Google or email signup) in staging then prod.
2. **Allowed by your directive:** manual SQL insert into auth user table, ensuring required columns are populated correctly.

If manual SQL is used, validate with:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT id,email,name FROM <auth_user_table> ORDER BY createdAt DESC LIMIT 10;"
```

### B3. Add memberships

Insert membership rows manually in D1 (staging first):

```sql
INSERT INTO campaign_memberships (id, user_id, campaign_slug, role, created_at)
VALUES ('<userId>:<campaignSlug>', '<userId>', '<campaignSlug>', 'member', '<ISO8601>');
```

Validate:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT user_id,campaign_slug,role FROM campaign_memberships ORDER BY campaign_slug,user_id;"
```

---

## Phase C — RBAC configuration safety for MVP

### C1. Stop treating repo JSON as production authority

**Edit runtime behavior in `src/pages/campaigns/[...slug].astro`, `src/pages/campaigns/[campaign]/sessions/index.astro`, `src/pages/campaigns/[campaign]/sessions/[...slug].astro`:**

- For production hostnames, do not source membership from repo JSON.
- Keep current primary membership source as D1 only.
- Allow legacy fallback only on localhost.

(Existing logic is close; ensure no production path can accidentally rely on `membershipConfigRaw` from static JSON.)

### C2. GM assignments for MVP

- Keep using `CAMPAIGN_GM_ASSIGNMENTS` env var for production/staging during MVP.
- Remove/ignore repo default gm assignments at runtime in production.

### C3. Document explicit assignments

**Edit:** `docs/runbook/phase-2-1-auth-google-d1-cloudflare-email.md`

Add sections:
- “Production assignment source of truth (MVP)”
- “How to update GM assignments safely”
- “How to list current users + memberships + GM map”

---

## Phase D — Validation and release

### D1. Endpoint validation

Run in staging then production:

```bash
curl -i https://staging.worldofaletheia.com/api/auth/get-session
curl -i https://worldofaletheia.com/api/auth/get-session
```

Expected:
- unauthenticated response should be non-500 and schema-consistent.

### D2. Auth flow validation

1. Open `/login`.
2. Authenticate with one real account.
3. Open `/account` and verify user identity + memberships render.
4. Hit protected campaign route:
   - non-member denied
   - member allowed
   - GM-only route allowed only for GM

### D3. DB verification queries

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS users FROM <auth_user_table>;"
pnpm wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS memberships FROM campaign_memberships;"
pnpm wrangler d1 execute DB --remote --command "SELECT user_id,campaign_slug,role FROM campaign_memberships ORDER BY campaign_slug,user_id;"
```

### D4. Automated checks

```bash
pnpm test
pnpm build
```

---

## 5) Safe configuration options beyond JSON-in-GitHub

### Option A (MVP recommended): D1 memberships + env GM map

- Membership truth in D1.
- GM mapping in protected env var (`CAMPAIGN_GM_ASSIGNMENTS`).
- Pros: low implementation effort, no admin UI required.
- Cons: GM updates require env change + deploy.

### Option B (recommended post-MVP): D1 for both memberships and GM assignments

- Add `campaign_gm_assignments` table.
- Query D1 for GM checks instead of env/JSON.
- Pros: single source of truth, auditable, no deploy needed for assignment change.
- Cons: small extra migration + code change.

### Option C (later): Admin UI/CLI layer over D1

- Keep D1 as source; add tooling to reduce manual SQL.

Decision recommendation:
- Use **Option A now** to reach MVP quickly.
- Move to **Option B next** for production safety and operational sanity.

---

## 6) Migration path from JSON config to production-safe setup

### Step 1 (Now)

- Treat `src/content/campaigns/access.config.json` as local/bootstrap only.
- Do not use it as authority in production runtime.

### Step 2 (Now)

- Move initial real memberships into D1 manually.
- Set GM assignments in env.

### Step 3 (Soon)

- Add migration file: `migrations/0003_campaign_gm_assignments.sql`.
- Update `src/utils/campaign-access.ts` to read GM from D1 repo (with env fallback only on localhost).

### Step 4 (Soon)

- Remove production dependence on `CAMPAIGN_GM_ASSIGNMENTS`.
- Keep env value only as emergency override.

---

## 7) Rollout order

1. Staging schema migration.
2. Staging manual users + memberships.
3. Staging auth/RBAC smoke tests.
4. Production schema migration.
5. Production manual users + memberships.
6. Production smoke tests.
7. Freeze MVP baseline and document assignments.

---

## 8) Rollback strategy (minimal)

If auth release fails:

1. Keep DB migrations in place (non-destructive).
2. Roll back application deployment to last known good commit.
3. Keep campaign routes deny-by-default.
4. For temporary local troubleshooting only, use localhost fallback path.

Do **not** roll back by deleting D1 auth tables.

---

## 9) Strict but minimal MVP “Done” definition

MVP is done only when all are true:

1. Staging and production D1 each have auth core tables + `campaign_memberships` table.
2. Exactly two real initial users (you + brother) exist in production auth user table.
3. No test users exist in production tables.
4. Required campaign memberships for those two users exist in D1.
5. GM checks work for configured campaigns.
6. `/api/auth/get-session` does not return 500 in staging/prod.
7. `/login`, `/account`, `/logout` work end-to-end in production.
8. Protected campaign pages enforce `public` / `campaignMembers` / `gm` as expected.
9. Production assignment source of truth is documented in runbook.
10. `pnpm build` and test suite pass on release commit.

---

## 10) Appendix: immediate command checklist

```bash
# 0) account + db sanity
pnpm wrangler whoami
pnpm wrangler d1 list
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging

# 1) migrate staging then prod (after scripts are added)
pnpm run db:migrate:staging
pnpm run db:migrate:prod

# 2) verify tables
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# 3) verify users + memberships (after manual ingest)
pnpm wrangler d1 execute DB --remote --command "SELECT id,email,name FROM <auth_user_table> ORDER BY createdAt DESC;"
pnpm wrangler d1 execute DB --remote --command "SELECT user_id,campaign_slug,role FROM campaign_memberships ORDER BY campaign_slug,user_id;"
```

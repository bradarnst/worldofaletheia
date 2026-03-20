# Phase 2.1 Runbook — Better Auth + Google OAuth + Cloudflare D1 + Mailjet Email

This runbook is the execution path for Phase 2.1 auth and campaign membership enforcement.

## 1) Required environment contract

Runtime vars (non-secret):

- `BETTER_AUTH_URL`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (optional)
- `CONTACT_TO_EMAIL`
- `MAILJET_SANDBOX_MODE` (`on` or `off`)
- `CAMPAIGN_GM_ASSIGNMENTS` (optional local/dev-only fallback JSON override for campaign → GM mapping)

Secrets:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`

Cloudflare bindings:

- D1 binding name must be `DB`.

## 2) OAuth redirect URIs

Configure these in Google Cloud Console for your OAuth web client:

- `https://worldofaletheia.com/api/auth/callback/google`
- `https://staging.worldofaletheia.com/api/auth/callback/google`
- `http://localhost:4321/api/auth/callback/google`

## 3) D1 setup and migration

Create databases (or reuse existing):

```bash
wrangler d1 create world-of-aletheia
wrangler d1 create world-of-aletheia-staging
```

Copy resulting database IDs into [`wrangler.jsonc`](wrangler.jsonc).

Run local migration plan dry-run first:

```bash
pnpm db:migrate:plan:local:dry-run
```

Apply full ordered schema sequence (staging first, then production) via a single migration runner:

```bash
# dry-run first (no writes)
pnpm db:migrate:plan:staging:dry-run
pnpm db:migrate:plan:prod:dry-run

# apply after clean dry-run
pnpm db:migrate:plan:staging
pnpm db:migrate:plan:prod
```

Ordered migration files are:

1. `migrations/0001_campaign_memberships.sql`
2. `migrations/0002_campaign_gm_assignments.sql`
3. `migrations/0003_auth_core.sql`
4. `migrations/0004_auth_email_hardening.sql`
5. `migrations/0005_campaign_gm_assignments_multi.sql`

Policy constraints:

- Canonical email is `trim(lower(email))`.
- Canonical collisions are fail-fast by default (migration runner exits with explicit collision output).
- No persistent conflict-backlog table is used.

Conflict-handling behavior in migration runner:

1. By default, if conflicts are detected (canonical-email collisions or schema/object conflicts), execution stops with actionable error output.
2. `--force` allows continuing despite conflicts and performs intentional collision overwrite behavior for duplicate canonical emails prior to apply.
3. This behavior is identical across local/staging/production wrappers.

## 4) Membership seed bootstrap (optional)

Seed source: [`config/campaign-access.config.json`](config/campaign-access.config.json)

Run local seed:

```bash
pnpm db:seed:memberships:local
```

The seed is idempotent (`INSERT OR IGNORE`) and will not overwrite existing membership rows.

GM assignment source-of-truth:

- staging/prod: D1 `campaign_gm_assignments`
- local/dev fallback only: `gmAssignments` in [`config/campaign-access.config.json`](config/campaign-access.config.json)
- local/dev fallback only: optional env override through `CAMPAIGN_GM_ASSIGNMENTS`

## 5) Secret provisioning

Generate values:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
```

Set production secrets:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MAILJET_API_KEY
wrangler secret put MAILJET_SECRET_KEY
```

Set staging secrets:

```bash
wrangler secret put BETTER_AUTH_SECRET --env staging
wrangler secret put GOOGLE_CLIENT_ID --env staging
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
wrangler secret put MAILJET_API_KEY --env staging
wrangler secret put MAILJET_SECRET_KEY --env staging
```

## 6) Local workflow model (dual-lane)

Use two lanes locally:

1. **Fast lane (UI/content iteration):**
   - `pnpm dev` (or `pnpm dev:fast`)
   - Runs Astro dev runtime for quick feedback.
   - Do **not** treat this lane as authoritative for auth/session parity.

2. **Cloudflare parity lane (auth/session verification):**
   - Runs the built worker output under Wrangler local runtime with D1 binding.
   - This is the source-of-truth lane for Better Auth and session-dependent campaign access checks.

## 7) Local Cloudflare parity setup

1. Create local Wrangler vars/secrets file (gitignored):

```bash
cat > .dev.vars <<'EOF'
BETTER_AUTH_URL=http://127.0.0.1:8788
BETTER_AUTH_SECRET=replace-with-32-byte-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
MAILJET_API_KEY=replace-with-mailjet-key
MAILJET_SECRET_KEY=replace-with-mailjet-secret
EMAIL_FROM=gm@worldofaletheia.com
EMAIL_REPLY_TO=gm@worldofaletheia.com
CONTACT_TO_EMAIL=brad@worldofaletheia.com,barry@worldofaletheia.com
MAILJET_SANDBOX_MODE=on
EOF
```

If needed for local/dev fallback override, add:

```bash
CAMPAIGN_GM_ASSIGNMENTS={"brad":{"userId":"jim"},"barry":{"userId":"tom"}}
```

2. Ensure local DB schema is current:

```bash
pnpm db:migrate:plan:local
```

3. Optionally seed membership bootstrap data:

```bash
pnpm db:seed:memberships:local
```

4. Run parity lane:

```bash
pnpm dev:cf:auth
```

This command builds Astro Cloudflare server output, applies local D1 migration/seed scripts, then starts Wrangler dev against [`entry.mjs`](dist/server/entry.mjs) with generated config [`wrangler.json`](dist/server/wrangler.json).

## 8) Auth/session verification checklist (parity lane)

1. Open `/login` and confirm Google + email/password forms are present.
2. Call `/api/auth/get-session` before login and confirm null/unauthenticated behavior.
3. Complete sign-in (Google or email/password), then open `/account`.
4. Verify campaign access behavior:
   - unauthenticated: restricted routes show restricted message
   - authenticated non-member: `campaignMembers` and `gm` routes remain blocked
   - authenticated member: `campaignMembers` routes render
   - authenticated campaign GM: `gm` and `campaignMembers` routes render
   - verify GM rows in D1 for expected campaign/user pairs:

   ```sql
   SELECT campaign_slug, user_id, created_at, updated_at
   FROM campaign_gm_assignments
   ORDER BY campaign_slug ASC, user_id ASC;
   ```
5. Test contact relay with Mailjet sandbox mode:
   - `POST /api/contact` with valid JSON returns `{ "ok": true }`

## 9) Future option (not implemented in this phase)

- Add a lightweight staging smoke gate before production release:
  - deploy to `staging`
  - run auth/session/campaign access smoke checks
  - promote only when staging checks pass

## 10) Troubleshooting

### `authentication_unavailable` from `/api/auth/*`

- Confirm `DB` binding exists and is named exactly `DB` in [`wrangler.jsonc`](wrangler.jsonc).
- Confirm `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are set for the active env.
- If reproducing locally, confirm you are using the parity lane (`pnpm dev:cf:auth`) instead of plain `pnpm dev`.

### Protected campaign route always denies

- Confirm user session exists at `/account`.
- Confirm `campaign_memberships` row exists for `(user_id, campaign_slug)`.
- For `visibility: gm`, confirm `campaign_gm_assignments` has a row for `(campaign_slug, user_id)` in D1.
- In local-only fallback mode, confirm `CAMPAIGN_MEMBERSHIPS` JSON shape matches [`src/utils/campaign-membership-config.ts`](src/utils/campaign-membership-config.ts).

### Contact endpoint returns `503 unavailable`

- Confirm `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` are configured.
- Confirm `MAILJET_SANDBOX_MODE` is set to `on` if you want non-delivery testing behavior.
- Check server logs for `contact.relay.failed` with request ID.

## 11) Rollback notes

- Membership migration is additive and non-destructive.
- Application rollback path is code-only revert of auth route/resolver updates.
- As emergency local fallback, `CAMPAIGN_MEMBERSHIPS` map can still be enabled for localhost-only development behavior.

## 12) Operator SOP — Active MVP path (Option A2: Wrangler-applied D1 SQL files)

This is the **active production workflow** for account ingestion and campaign assignment management.

### 12.1 Identity evidence policy and privacy rules

1. Real account and assignment data must live only in D1 + private operator files.
2. Do not store real identifiers in tracked repo files.
3. Any claim about production identities/assignments is valid only when supported by production query output.
4. Placeholder names in SQL templates are not identity assertions.

### 12.2 Prerequisites (required before any operation)

Run:

```bash
pnpm wrangler whoami
pnpm wrangler d1 list
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging
```

Expected:

- Correct Cloudflare account
- Both target databases visible

Migrate required schema (one-time per env):

```bash
pnpm db:migrate:plan:local:dry-run
pnpm db:migrate:plan:local

pnpm db:migrate:plan:staging:dry-run
pnpm db:migrate:plan:staging

pnpm db:migrate:plan:prod:dry-run
pnpm db:migrate:plan:prod
```

Force mode examples:

```bash
pnpm db:migrate:plan:staging:force
pnpm db:migrate:plan:prod:force
```

Use force only when conflicts are understood, documented, and intentionally overridden.

### 12.3 Environment selection safeguard

Always run preflight first and verify output target before apply:

```bash
pnpm run ops:a2:preflight:staging
pnpm run ops:a2:preflight:prod
```

If preflight does not show expected tables, stop and fix migrations first.

If migration dry-run reports conflicts, do not apply until resolved unless an approved force override is required.

### 12.4 Option A2 execution model

Use SQL templates from [`scripts/operator-sql/templates/`](scripts/operator-sql/templates/) and execute copied files from private gitignored path:

```bash
mkdir -p ./.wrangler/operators
cp ./scripts/operator-sql/templates/membership-grant.sql ./.wrangler/operators/op.sql
```

Edit placeholders, then apply:

```bash
OP_FILE=./.wrangler/operators/op.sql pnpm run ops:a2:apply:staging
OP_FILE=./.wrangler/operators/op.sql pnpm run ops:a2:apply:prod
```

### 12.5 Deterministic operation templates

Available templates:

- membership grant/upsert: [`scripts/operator-sql/templates/membership-grant.sql`](scripts/operator-sql/templates/membership-grant.sql)
- membership revoke: [`scripts/operator-sql/templates/membership-revoke.sql`](scripts/operator-sql/templates/membership-revoke.sql)
- membership role update: [`scripts/operator-sql/templates/membership-role-update.sql`](scripts/operator-sql/templates/membership-role-update.sql)
- GM assignment upsert: [`scripts/operator-sql/templates/gm-assignment-upsert.sql`](scripts/operator-sql/templates/gm-assignment-upsert.sql)
- GM assignment revoke: [`scripts/operator-sql/templates/gm-assignment-revoke.sql`](scripts/operator-sql/templates/gm-assignment-revoke.sql)
- auth account link upsert: [`scripts/operator-sql/templates/account-link-upsert.sql`](scripts/operator-sql/templates/account-link-upsert.sql)
- auth account link revoke: [`scripts/operator-sql/templates/account-link-revoke.sql`](scripts/operator-sql/templates/account-link-revoke.sql)

### 12.6 Create user/account records when needed

Preferred account creation path:

1. Use normal Better Auth sign-up/login flow in staging then production.
2. Use manual account-table templates only for corrective linking operations.

If identity is ambiguous, resolve before any assignment:

```bash
cp ./scripts/operator-sql/identity-resolution.sql ./.wrangler/operators/resolve.sql
# fill <email>/<name>
OP_FILE=./.wrangler/operators/resolve.sql pnpm run ops:a2:resolve:prod
```

Additional optional operator templates for controlled auth maintenance:

- user upsert: `scripts/operator-sql/templates/user-upsert.sql`
- user email update: `scripts/operator-sql/templates/user-email-update.sql`
- verification upsert: `scripts/operator-sql/templates/verification-upsert.sql`

These are intended for corrective operations only; normal sign-up/sign-in remains preferred.

### 12.7 Post-operation verification (mandatory)

Run after every apply:

```bash
pnpm run ops:a2:verify:staging
pnpm run ops:a2:verify:prod
```

Periodic audit:

```bash
pnpm run ops:a2:audit:staging
pnpm run ops:a2:audit:prod
```

### 12.8 Transaction and integrity expectations

- Each operation file should target one clear action.
- Upsert templates are idempotent for repeat-safe execution where feasible.
- For destructive operations (revoke), verify affected rows immediately.
- Do not batch unrelated mutations in one file.

### 12.9 Failure handling and incident recovery

If apply command fails:

1. Stop and fix SQL/runtime issue.
2. Re-run preflight.
3. Re-apply corrected file once.

If wrong assignment applied:

1. Execute corresponding revoke template.
2. Re-apply correct assignment template.
3. Run verify and audit scripts.
4. Record incident in private ops log (timestamp, env, action, resolution).

If identity mismatch discovered after change:

1. Revoke incorrect mapping.
2. Resolve identity with `identity-resolution.sql`.
3. Re-apply to verified user id only.

If canonical email collisions are reported:

1. Stop and resolve manually, or run approved `--force` path.
2. Under force, duplicate identities are deterministically rewritten to unique forced aliases before migration apply.
3. Re-run preflight, verify, and audit after apply.

### 12.12 Acceptance criteria and readiness checks

All of the following must hold before declaring the Option A2 auth/email path production-ready:

1. `/login` presents Google and email/password forms and email auth endpoints are reachable.
2. Better Auth runtime is email-capable with verification optional mode (currently disabled):
   - `requireEmailVerification = false`
   - `sendOnSignUp = false`
   - `sendOnSignIn = false`
3. D1 has all required tables and indexes validated by `ops:a2:preflight:*`:
   - `user`, `account`, `session`, `verification`
   - canonical email + provider/account uniqueness indexes
4. Operator identity resolution is deterministic under canonical email policy (canonical-first, name fallback only).
5. Canonical collisions are explicitly handled through immediate fail-fast-or-force behavior with no conflict backlog table.

### 12.10 Rollback guidance for mistaken assignments

Use deterministic inverse operations:

- membership grant ↔ membership revoke
- GM upsert ↔ GM revoke
- account-link upsert ↔ account-link revoke

Always verify with:

```bash
pnpm run ops:a2:verify:prod
pnpm run ops:a2:audit:prod
```

### 12.11 Complete operator execution sequence (new operator safe-start)

1. Run account/database preflight commands.
2. Run environment preflight SQL.
3. Copy template into private operator file.
4. Fill placeholders.
5. Apply to staging.
6. Verify staging output.
7. Apply to production.
8. Verify production output.
9. Record private ops log entry.

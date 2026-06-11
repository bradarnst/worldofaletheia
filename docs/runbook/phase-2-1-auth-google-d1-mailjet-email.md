# Phase 2.1 Runbook — Better Auth + Google OAuth + Cloudflare D1 + Mailjet Email

This runbook is the execution path for Phase 2.1 auth and campaign membership enforcement.

## 1) Required environment contract

Runtime vars (non-secret):

- `BETTER_AUTH_URL`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (optional)
- `CONTACT_TO_EMAIL`
- `MAILJET_SANDBOX_MODE` (`on` or `off`)
- `CAMPAIGN_MEMBERSHIPS` (optional local/dev-only fallback JSON override for user → campaign role map)

Secrets:

- `BETTER_AUTH_SECRET`
- `PASSWORD_HASH_PEPPER`
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
6. `migrations/0006_content_index.sql`
7. `migrations/0007_content_index_r2_lookup.sql`
8. `migrations/0008_content_index_collection_scoped_identity.sql`
9. `migrations/0009_campaign_memberships_role_unification.sql`
10. `migrations/0010_drop_campaign_gm_assignments.sql`

Policy constraints:

- `user.email` stores `trim(lower(email))` and is the only persisted identity email.
- Normalized-email collisions are fail-fast by default (migration runner exits with explicit collision output).
- No persistent conflict-backlog table is used.

Conflict-handling behavior in migration runner:

1. By default, if conflicts are detected (normalized-email collisions or schema/object conflicts), execution stops with actionable error output.
2. `--force` allows continuing despite conflicts and performs intentional collision overwrite behavior for duplicate normalized emails prior to apply.
3. This behavior is identical across local/staging/production wrappers.

## 4) Campaign membership authority

Campaign membership mutation is no longer managed by tracked public-site seed files or operator SQL templates.

Campaign entitlement authority after cutover:

- Better Auth remains the auth/session boundary.
- staging/prod entitlement authority: D1 `campaign_memberships`
- `campaign_memberships.role = 'gm'` is the only live GM authority.
- membership add/update/revoke workflows belong to `woa-admin` and the API contract in `docs/contracts/user-account-management-api.openapi.yaml`.
- local protected-content testing should use local D1 fixtures created outside tracked operator-management files.

## 5) Secret provisioning

Generate values:

```bash
openssl rand -base64 32   # BETTER_AUTH_SECRET
```

Set production secrets:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put PASSWORD_HASH_PEPPER
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put MAILJET_API_KEY
wrangler secret put MAILJET_SECRET_KEY
```

Set staging secrets:

```bash
wrangler secret put BETTER_AUTH_SECRET --env staging
wrangler secret put PASSWORD_HASH_PEPPER --env staging
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
PASSWORD_HASH_PEPPER=replace-with-password-hash-pepper
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

2. Ensure local DB schema is current:

```bash
pnpm db:migrate:plan:local
```

3. Run parity lane:

```bash
pnpm dev:cf:auth
```

This command builds Astro Cloudflare server output, applies local D1 migrations, then starts Wrangler dev against [`entry.mjs`](dist/server/entry.mjs) with generated config [`wrangler.json`](dist/server/wrangler.json).

## 8) Auth/session verification checklist (parity lane)

1. Open `/login` and confirm Google + email/password forms are present.
2. Call `/api/auth/get-session` before login and confirm null/unauthenticated behavior.
3. Complete sign-in (Google or email/password), then open `/account`.
4. Verify campaign access behavior:
    - unauthenticated: restricted routes show restricted message
    - authenticated non-member: `campaignMembers` and `gm` routes remain blocked
    - authenticated member: `campaignMembers` routes render
    - authenticated campaign GM: `gm` and `campaignMembers` routes render
    - verify canonical GM rows in D1 for expected campaign/user pairs:

    ```sql
    SELECT campaign_slug, user_id, role, created_at, updated_at
    FROM campaign_memberships
    WHERE role = 'gm'
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
- For `visibility: gm`, confirm the row in `campaign_memberships` has `role = 'gm'`.
- In local-only fallback mode, confirm `CAMPAIGN_MEMBERSHIPS` JSON shape matches the role-map examples in [`docs/runbook/campaign-access-local-dev.md`](docs/runbook/campaign-access-local-dev.md).

### Contact endpoint returns `503 unavailable`

- Confirm `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` are configured.
- Confirm `MAILJET_SANDBOX_MODE` is set to `on` if you want non-delivery testing behavior.
- Check server logs for `contact.relay.failed` with request ID.

## 11) Rollback notes

- Better Auth session plumbing is unchanged by this tranche.
- Application rollback after Release 2 is forward-fix on top of canonical `campaign_memberships` roles.
- As emergency local fallback, `CAMPAIGN_MEMBERSHIPS` can still be enabled for localhost-only development behavior.

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

### 12.4 Administrative operation boundary

This public-site repository no longer carries direct D1 mutation templates for user, account, provider-link, verification-token, or campaign-membership administration.

Administrative mutation workflows belong to `woa-admin`:

- Front-end consumption guide: `docs/integrations/woa-admin-campaign-user-management-front-end-guide.md`
- API contract: `docs/contracts/user-account-management-api.openapi.yaml`

Use the public site for Better Auth self-service flows and campaign authorization reads. Use `woa-admin` for add/update/revoke campaign memberships, global user search, administrator-required resets, session revocation, provider repair, and deletion/deprovisioning.

### 12.5 Create user/account records when needed

Preferred account creation path:

1. Use normal Better Auth sign-up/login flow in staging then production.
2. Use Better Auth self-service account APIs for user-managed account changes.
3. Use `woa-admin` for corrective or administrator-required operations.

### 12.6.1 Password reset paths

Normal user password recovery is self-service:

1. User opens `/forgot-password` and enters only their email address.
2. The site returns the same generic response for known, unknown, and Google-only accounts.
3. Better Auth handles reset-token persistence and calls the public site's Mailjet `sendResetPassword` callback when eligible.
4. User opens `/reset-password?token=...` and sets a new password without providing their current password.
5. Better Auth resets the credential password through the configured ADR-0023 hash hook and revokes sessions when configured.

Do not query or print `verification.value` during routine checks because it contains password-reset token hashes. Never log raw reset tokens, full reset URLs, passwords, full hashes, salts, derived keys, or pepper values.

Application reset-token verification query examples:

```sql
SELECT identifier, expiresAt, createdAt
FROM verification
WHERE identifier LIKE 'password-reset:%'
ORDER BY createdAt DESC
LIMIT 20;
```

Expected credential hash prefix after self-service reset:

```text
woa-pbkdf2-sha256-v1
```

### 12.6.2 Administrator-required password reset/recreation

Administrator-required reset, credential recreation, and verified support recovery belong to `woa-admin`, not to public-site scripts. The public site keeps only Better Auth self-service forgot/reset/change password flows.

Verify recent credential hash prefixes without dumping full hashes:

```sql
SELECT providerId, substr(password, 1, 24) AS password_prefix, updatedAt
FROM account
WHERE providerId = 'credential'
ORDER BY updatedAt DESC
LIMIT 20;
```

After any reset workflow, verify campaign memberships still point at the same preserved `user.id`:

```sql
SELECT campaign_slug, user_id, role, created_at, updated_at
FROM campaign_memberships
WHERE user_id = '<better-auth-user-id>'
ORDER BY campaign_slug ASC;
```

Then sign in with the new password, open `/account`, and confirm the campaign membership list and restricted campaign access still behave as expected.

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

If an administrative mutation fails or the wrong assignment is applied, stop using public-site tooling and resolve through `woa-admin` so authorization, audit, and postcondition checks remain in one privileged system.

If identity mismatch is discovered after a change:

1. Stop additional public-site deploy or sync activity that depends on the bad assignment.
2. Resolve identity in `woa-admin` using normalized email/user-id policy.
3. Apply the corrective membership/account action in `woa-admin`.
4. Run public-site read-only verify/audit scripts if needed.
5. Record the incident in the private ops log (timestamp, env, action, resolution).

If normalized-email collisions are reported:

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
   - `user.email` + provider/account uniqueness indexes
4. Operator identity resolution is handled by `woa-admin` under normalized email policy.
5. Normalized-email collisions are explicitly handled through immediate fail-fast-or-force behavior with no conflict backlog table.

### 12.10 Rollback guidance for mistaken assignments

Use `woa-admin` corrective operations for mistaken assignments:

- membership grant/update/revoke
- account/provider repair
- administrator-required password/session actions

Always verify with:

```bash
pnpm run ops:a2:verify:prod
pnpm run ops:a2:audit:prod
```

### 12.11 Complete operator execution sequence

1. Run account/database preflight commands.
2. Use `woa-admin` for administrative mutation workflows.
3. Verify staging output where applicable.
4. Apply to production only after staging verification.
5. Verify production output.
6. Record private ops log entry.

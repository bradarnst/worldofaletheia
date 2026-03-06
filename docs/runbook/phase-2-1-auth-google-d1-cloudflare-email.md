# Phase 2.1 Runbook — Better Auth + Google OAuth + Cloudflare D1 + Mailjet Email

This runbook is the execution path for Phase 2.1 auth and campaign membership enforcement.

## 1) Required environment contract

Runtime vars (non-secret):

- `BETTER_AUTH_URL`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (optional)
- `CONTACT_TO_EMAIL`
- `MAILJET_SANDBOX_MODE` (`on` or `off`)
- `CAMPAIGN_GM_ASSIGNMENTS` (optional JSON override for campaign → GM mapping)

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

Run local migration:

```bash
pnpm db:migrate:local
```

## 4) Membership seed bootstrap (optional)

Seed source: [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json)

Run local seed:

```bash
pnpm db:seed:memberships:local
```

The seed is idempotent (`INSERT OR IGNORE`) and will not overwrite existing membership rows.

GM assignment source (no DB seed required):

- `gmAssignments` in [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json)
- optional env override through `CAMPAIGN_GM_ASSIGNMENTS`

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

If needed for local override, add:

```bash
CAMPAIGN_GM_ASSIGNMENTS={"brad":{"userId":"jim"},"barry":{"userId":"tom"}}
```

2. Ensure local DB schema is current:

```bash
pnpm db:migrate:local
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
- For `visibility: gm`, confirm campaign slug has `gmAssignments[campaignSlug].userId` configured.
- In local-only fallback mode, confirm `CAMPAIGN_MEMBERSHIPS` JSON shape matches [`src/utils/campaign-membership-config.ts`](src/utils/campaign-membership-config.ts).

### Contact endpoint returns `503 unavailable`

- Confirm `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` are configured.
- Confirm `MAILJET_SANDBOX_MODE` is set to `on` if you want non-delivery testing behavior.
- Check server logs for `contact.relay.failed` with request ID.

## 11) Rollback notes

- Membership migration is additive and non-destructive.
- Application rollback path is code-only revert of auth route/resolver updates.
- As emergency local fallback, `CAMPAIGN_MEMBERSHIPS` map can still be enabled for localhost-only development behavior.

## 12) Operator Runbook — Production account and assignment operations (Option A)

This section defines a manual operator workflow for production-safe account assignment management using Wrangler + D1.

### 12.1 Scope and data handling rules

- Use this flow for **membership and GM assignment operations** in staging/production.
- Keep real identity/assignment data in D1 and private operator tooling only.
- Do not commit real user identifiers, email addresses, or assignment snapshots to Git.
- Repository SQL examples must use placeholders only.

### 12.2 Operator prerequisites

1. Wrangler authenticated to correct Cloudflare account:

```bash
pnpm wrangler whoami
```

2. Target databases visible:

```bash
pnpm wrangler d1 list
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging
```

3. Schema present before assignment operations:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected minimum:

- Better Auth core tables (names depend on installed Better Auth schema)
- `campaign_memberships`
- if enabled, `campaign_gm_assignments`

### 12.3 Preferred execution mode (A2): SQL file + Wrangler

Use a private/ignored path for operation SQL files.

Recommended local ignored path:

- `./.wrangler/operators/`

Example execute commands:

```bash
pnpm wrangler d1 execute DB --remote --file ./.wrangler/operators/op-prod.sql
pnpm wrangler d1 execute DB --remote --env staging --file ./.wrangler/operators/op-staging.sql
```

### 12.4 Command templates

#### Grant campaign membership

```sql
INSERT INTO campaign_memberships (id, user_id, campaign_slug, role, created_at)
VALUES ('<userId>:<campaignSlug>', '<userId>', '<campaignSlug>', 'member', '<ISO8601>')
ON CONFLICT(user_id, campaign_slug) DO UPDATE SET
  role = excluded.role,
  updated_at = '<ISO8601>';
```

#### Revoke campaign membership

```sql
DELETE FROM campaign_memberships
WHERE user_id = '<userId>' AND campaign_slug = '<campaignSlug>';
```

#### Set/update GM assignment (if table exists)

```sql
INSERT INTO campaign_gm_assignments (campaign_slug, user_id, created_at, updated_at)
VALUES ('<campaignSlug>', '<userId>', '<ISO8601>', '<ISO8601>')
ON CONFLICT(campaign_slug) DO UPDATE SET
  user_id = excluded.user_id,
  updated_at = '<ISO8601>';
```

#### Revoke GM assignment (if table exists)

```sql
DELETE FROM campaign_gm_assignments
WHERE campaign_slug = '<campaignSlug>';
```

### 12.5 Verification queries (required after each operation)

#### Membership verification

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT user_id,campaign_slug,role,created_at,updated_at FROM campaign_memberships ORDER BY campaign_slug,user_id;"
```

#### Membership count check

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS memberships FROM campaign_memberships;"
```

#### GM assignment verification (if table exists)

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT campaign_slug,user_id,created_at,updated_at FROM campaign_gm_assignments ORDER BY campaign_slug;"
```

### 12.6 Safe-ops checklist (every run)

1. Confirm target environment (`staging` vs `production`) before execute.
2. Preview SQL in editor and verify placeholders have expected values.
3. Execute exactly once.
4. Run required verification queries.
5. Record private operator log entry (timestamp, operator, env, action type, success/failure).
6. Do not paste full PII-bearing query results into public channels or Git commits.

### 12.7 Failure handling

- If SQL fails: do not retry blindly; inspect error and re-run only corrected statement.
- If verification query fails: stop and resolve DB/runtime access before further ops.
- If unexpected row changes occur: restore expected state with explicit corrective SQL and re-verify.

### 12.8 Environment variable policy for Option A

- Allowed for non-sensitive defaults only (target env flags, command convenience).
- Do not store real user identifiers/emails/assignment payloads in persistent shell env files.
- Prefer runtime prompt/input and private SQL files that are gitignored.

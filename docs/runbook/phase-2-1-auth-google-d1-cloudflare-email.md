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

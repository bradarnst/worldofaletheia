# Phase 2.1 Runbook — Better Auth + Google OAuth + Cloudflare D1 + Mailjet Email

This runbook is the execution path for Phase 2.1 auth and campaign membership enforcement.

## 1) Required environment contract

Runtime vars (non-secret):

- `BETTER_AUTH_URL`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (optional)
- `CONTACT_TO_EMAIL`
- `MAILJET_SANDBOX_MODE` (`on` or `off`)

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

## 6) Local verification checklist

1. Start dev server: `pnpm dev`
2. Visit `/login` and confirm Google sign-in button is present.
3. Complete OAuth and open `/account`.
4. Verify campaign access behavior:
   - unauthenticated: restricted routes show restricted message
   - authenticated non-member: restricted routes remain blocked
   - authenticated member: restricted routes render content
5. Test contact relay with Mailjet sandbox mode:
   - `POST /api/contact` with valid JSON returns `{ "ok": true }`

## 7) Troubleshooting

### `authentication_unavailable` from `/api/auth/*`

- Confirm `DB` binding exists and is named exactly `DB` in [`wrangler.jsonc`](wrangler.jsonc).
- Confirm `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` are set for the active env.

### Protected campaign route always denies

- Confirm user session exists at `/account`.
- Confirm `campaign_memberships` row exists for `(user_id, campaign_slug)`.
- In local-only fallback mode, confirm `CAMPAIGN_MEMBERSHIPS` JSON shape matches [`src/utils/campaign-membership-config.ts`](src/utils/campaign-membership-config.ts).

### Contact endpoint returns `503 unavailable`

- Confirm `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` are configured.
- Confirm `MAILJET_SANDBOX_MODE` is set to `on` if you want non-delivery testing behavior.
- Check server logs for `contact.relay.failed` with request ID.

## 8) Rollback notes

- Membership migration is additive and non-destructive.
- Application rollback path is code-only revert of auth route/resolver updates.
- As emergency local fallback, `CAMPAIGN_MEMBERSHIPS` map can still be enabled for localhost-only development behavior.

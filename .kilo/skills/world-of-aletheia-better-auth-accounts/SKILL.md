---
name: world-of-aletheia-better-auth-accounts
description: Analyze, verify, or implement Better Auth account and user behavior in World of Aletheia, including D1 tables, auth routes, session handling, email/password and Google sign-in, canonical email policy, and operator-safe account maintenance.
---

# World of Aletheia Better Auth Accounts

Use this skill when asked to inspect, debug, explain, or implement Better Auth account and user flows in this repository.

## Goal

Produce repo-specific guidance or code changes for Better Auth users, accounts, sessions, and verification behavior without guessing about runtime, schema, or operational policy.

## Current auth baseline

Source files:

- `src/lib/auth.ts`
- `src/pages/api/auth/[...all].ts`
- `src/lib/auth-session.ts`
- `src/pages/login.astro`
- `src/pages/account.astro`
- `src/pages/logout.astro`
- `migrations/0003_auth_core.sql`
- `migrations/0004_auth_email_hardening.sql`
- `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`

Current implementation facts:

- Auth library: `better-auth`
- Runtime persistence: Cloudflare D1 binding `DB`
- Runtime env source: `cloudflare:workers`
- Catch-all auth route: `/api/auth/[...all]`
- User-facing auth pages: `/login`, `/account`, `/logout`
- Email/password auth: enabled
- Google social auth: enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are present
- Auto sign-in after email/password auth: enabled
- Email verification requirement: disabled
- Email verification send-on-sign-up/sign-in: disabled
- Account linking: enabled

## What to inspect

1. Project foundations
   - `package.json`
   - `wrangler.jsonc`
   - `src/env.d.ts`

2. Better Auth runtime wiring
   - `src/lib/auth.ts`
   - `src/pages/api/auth/[...all].ts`
   - `src/lib/d1.ts`
   - `src/lib/auth-session.ts`

3. User-facing entry points
   - `src/pages/login.astro`
   - `src/pages/account.astro`
   - `src/pages/logout.astro`

4. Persistence and account maintenance
   - `migrations/0003_auth_core.sql`
   - `migrations/0004_auth_email_hardening.sql`
   - `scripts/operator-sql/templates/user-upsert.sql`
   - `scripts/operator-sql/templates/user-email-update.sql`
   - `scripts/operator-sql/templates/account-link-upsert.sql`
   - `scripts/operator-sql/templates/account-link-revoke.sql`
   - `scripts/operator-sql/templates/verification-upsert.sql`

5. Operational policy
   - `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`
   - `plans/auth-production-account-management-mvp-options-2026-03.md`

## Current Better Auth configuration in this repo

From `src/lib/auth.ts`:

- `baseURL` comes from `BETTER_AUTH_URL`
- `secret` comes from `BETTER_AUTH_SECRET`
- `database` is `env.DB`
- `trustedOrigins` always includes `BETTER_AUTH_URL`
- `trustedOrigins` also includes `https://${CF_PAGES_URL}` when present
- `useSecureCookies` is derived from whether `BETTER_AUTH_URL` starts with `https://`
- default cookies are `httpOnly`, `sameSite: 'lax'`, and `secure` when HTTPS
- `emailAndPassword.enabled = true`
- `emailAndPassword.autoSignIn = true`
- `emailAndPassword.requireEmailVerification = false`
- `emailVerification.sendOnSignUp = false`
- `emailVerification.sendOnSignIn = false`
- `account.accountLinking.enabled = true`

Important repo rule:

- In Astro v6 Cloudflare, this project treats `cloudflare:workers` as canonical runtime env access.
- Do **not** treat `Astro.locals.cfContext` as the primary auth/D1 source for API routes.

## Current account and user data model

Primary Better Auth tables in D1:

- `user`
- `account`
- `session`
- `verification`

Current schema highlights:

### `user`

- `id` primary key
- `name`
- `email` (the normalized identity email; stores `trim(lower(email))`)
- `emailVerified` integer boolean
- `image`
- `createdAt`, `updatedAt`

### `account`

- `id` primary key
- `accountId`
- `providerId`
- `userId`
- optional token fields
- optional `password`
- `createdAt`, `updatedAt`
- unique index on `(providerId, accountId)`

### `session`

- `id` primary key
- `token`
- `userId`
- `expiresAt`
- `ipAddress`, `userAgent`
- `createdAt`, `updatedAt`
- unique index on `token`

### `verification`

- `id` primary key
- `identifier`
- `value`
- `expiresAt`
- `createdAt`, `updatedAt`

## Email identity policy

This repo enforces canonical email handling via `migrations/0004_auth_email_hardening.sql` and the forward migration that drops the legacy duplicate column.

Rules:

- canonical email is the persisted `user.email` value after `trim(lower(email))`
- `email` is normalized in place during hardening migration and at auth/account input boundaries
- uniqueness is enforced on `user.email`
- do not reintroduce a separate `email_canonical` column or fallback lookup
- collisions are fail-fast by default in the migration runner
- `--force` is an intentional operator override, not a normal path

When discussing user identity, prefer canonical email semantics over raw email string comparisons.

## Current user-facing auth flow

### Login page

`src/pages/login.astro` currently provides:

- Google sign-in via `POST /api/auth/sign-in/social`
- email sign-in via `POST /api/auth/sign-in/email`
- email sign-up via `POST /api/auth/sign-up/email`
- sanitized internal `next` handling via `callbackURL`

Important details:

- `next` must be an internal path beginning with `/` and not `//`
- default post-login destination is `/campaigns`
- Google sign-in is initiated client-side and follows returned redirect URLs

### Session resolution

`src/lib/auth-session.ts` currently:

- gets the Better Auth instance via `getAuth()`
- calls `/api/auth/get-session`
- forwards only the incoming `cookie` header
- narrows payload to `{ user, session }`
- returns `null` on any failure

### Account page

`src/pages/account.astro` currently shows:

- signed-in user name and email
- Better Auth session ID
- campaign memberships from `campaign_memberships`
- fallback unauthenticated state with link to `/login`

### Logout page

`src/pages/logout.astro` currently:

- posts to `/api/auth/sign-out`
- ignores client-side sign-out failures
- redirects to `/campaigns`

## Runtime and env requirements

Required auth env/bindings:

- `DB`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`

Commonly required for active project auth flows:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional/related:

- `CF_PAGES_URL`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `MAILJET_SANDBOX_MODE`

Note:

- verification email transport exists in `src/lib/email.ts`
- but verification-on-sign-up and verification-on-sign-in are currently disabled

## Operational account-management policy

This project does **not** treat the repo as a source of truth for real identities.

Rules from current runbooks/plans:

- real users/accounts live only in D1 and private operator files
- do not commit real identifiers to tracked repo files
- preferred account creation path is the normal Better Auth sign-up/login flow
- operator SQL templates are for corrective maintenance, linking, and controlled repair work
- staging should be validated before production

Current corrective/operator templates include:

- `user-upsert.sql`
- `user-email-update.sql`
- `account-link-upsert.sql`
- `account-link-revoke.sql`
- `verification-upsert.sql`

## Safe verification workflow

Prefer these checks first:

```bash
pnpm wrangler whoami
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging
pnpm dev:cf:auth
```

Read-only auth verification queries:

```sql
SELECT COUNT(*) AS total_users FROM "user";
SELECT COUNT(*) AS total_accounts FROM account;
SELECT COUNT(*) AS total_sessions FROM session;
SELECT COUNT(*) AS total_verifications FROM verification;

SELECT id, email, emailVerified, createdAt
FROM "user"
ORDER BY createdAt DESC
LIMIT 20;

SELECT providerId, accountId, userId, createdAt
FROM account
ORDER BY createdAt DESC
LIMIT 20;

SELECT id, userId, expiresAt, createdAt
FROM session
ORDER BY createdAt DESC
LIMIT 20;
```

For privacy-sensitive audits, prefer counts and targeted lookups over broad dumps.

## Output format

Return bullets under these headings:

- **Current auth baseline**
- **User/account data model**
- **Current sign-in/sign-up flow**
- **Required env and bindings**
- **Canonical email policy**
- **Operational maintenance path**
- **Verification checklist**
- **Gaps or risks**

## Rules

- Be precise and repo-specific.
- Prefer `pnpm` commands only.
- Distinguish runtime auth behavior from operator SQL maintenance.
- Distinguish normal Better Auth flows from corrective/manual account linking.
- Prefer the existing Better Auth setup over introducing a new auth abstraction.
- Do not recommend storing real users or assignments in tracked repo content.
- Do not assume verification emails are actively enforced; confirm current config first.
- Do not suggest `Astro.locals.cfContext` as the primary runtime env source in this repo.
- When discussing identity matching, mention canonical email policy.
- If auth parity matters locally, direct verification toward `pnpm dev:cf:auth`, not plain `pnpm dev`.

## Example summary shape

- **Current auth baseline:** The project uses Better Auth on Cloudflare with D1-backed `user`, `account`, `session`, and `verification` tables behind `/api/auth/[...all]`.
- **User/account data model:** Users are canonicalized by normalized email, external/provider links live in `account`, and session state lives in `session`.
- **Current sign-in/sign-up flow:** `/login` provides Google sign-in plus email sign-in/sign-up, while `/account` reads session state through `getRequestSession()` and shows memberships.
- **Required env and bindings:** `DB`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET` are required; Google envs are required for social sign-in.
- **Canonical email policy:** `trim(lower(email))` is the identity-normalization rule, with unique canonical email enforcement and fail-fast collision handling.
- **Operational maintenance path:** Normal sign-up/sign-in is preferred; operator SQL templates are reserved for corrective user/account link maintenance.
- **Verification checklist:** Validate `/login`, `/api/auth/get-session`, `/account`, and D1 table state in the Cloudflare parity lane.
- **Gaps or risks:** Email verification transport exists but enforcement is currently disabled, and account mistakes should be corrected through private D1 ops rather than tracked repo data.

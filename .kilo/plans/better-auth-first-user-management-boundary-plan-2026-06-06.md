# Better Auth-First User Management Boundary Plan

## Status

- Date: 2026-06-06
- Status: Proposed plan only
- Scope: Re-align user/account/campaign management around Better Auth and `woa-admin` without removing public-site self-service auth flows.
- Primary rule: use Better Auth by default for sign-up, sign-in, self-service account/password operations, and account-provider behavior. Any non-Better Auth implementation needs a specific approved reason.

## Corrected Boundary

This repo should continue to own:

- Public-site Better Auth runtime authentication.
- Google and email/password sign-in/sign-up.
- User self-service forgot-password and reset-password flows.
- Signed-in self-service change password.
- Signed-in self-service set password for OAuth-only users if added.
- Signed-in self-service user profile updates if added, using Better Auth `updateUser`.
- Session resolution for protected campaign content.
- Campaign authorization reads from `campaign_memberships`.
- Public/campaign front-end UI that consumes `woa-admin` campaign-management APIs.

`woa-admin` should own:

- Admin-required password reset or forced reset workflows.
- Operator/global user search and account inspection.
- Admin user deletion, soft-delete, deprovisioning, and session revocation.
- Provider account repair/link correction done by an operator.
- Campaign membership mutation APIs: add/update/revoke/list/manage members.
- Any global user/campaign management API implementation.

This repo should stop owning:

- Direct D1 mutation tooling for user/account/campaign administration.
- Operator SQL templates for user/account/campaign membership mutations.
- Operator password-reset scripts that bypass Better Auth.
- Public-site backends that reimplement Better Auth features without an approved reason.

## Better Auth Findings

Better Auth docs confirm first-class support for:

- `signUp.email` and `signIn.email`.
- `signOut`.
- `sendVerificationEmail` and verification flows.
- `requestPasswordReset` and `resetPassword` via `emailAndPassword.sendResetPassword`.
- `revokeSessionsOnPasswordReset`.
- `changePassword` for signed-in users with current password.
- `setPassword` for OAuth users that do not have credential accounts.
- `verifyPassword` for server-side sensitive-operation checks.
- `updateUser` for user profile fields such as `name` and `image`.
- `changeEmail` if enabled and backed by verification email.
- `listAccounts`, `linkSocial`, and `unlinkAccount` for self-managed account provider behavior.
- `deleteUser`, but this should remain disabled in this repo unless explicitly approved because deletion/deprovisioning belongs to `woa-admin` policy.

Current repo implementation already uses Better Auth for:

- `/api/auth/[...all]` catch-all.
- Google sign-in.
- email sign-in/sign-up.
- sign-out.
- get-session.
- signed-in change password through `/api/auth/change-password`.
- custom ADR-0023 password hashing via Better Auth `emailAndPassword.password.hash/verify`.

Current repo implementation reimplements instead of using Better Auth for:

- Forgot-password request handling.
- Reset-token generation/storage/hash/expiry/rate-limit handling.
- Reset-password completion.

## Current Boundary Conflicts To Fix

### Keep But Refactor Toward Better Auth

- `src/pages/forgot-password.astro`
- `src/pages/reset-password.astro`
- `src/pages/account.astro` change-password section
- `sendPasswordResetEmail` in `src/lib/email.ts`

These are allowed self-service surfaces, but the backend should use Better Auth native APIs where feasible.

### Remove Or Supersede

- `src/pages/api/auth/request-password-reset.ts` if it only wraps custom reset code and Better Auth native `/api/auth/request-password-reset` can be used directly.
- `src/pages/api/auth/complete-password-reset.ts` if it only wraps custom reset code and Better Auth native `/api/auth/reset-password` can be used directly.
- `src/lib/password-reset.ts`
- `src/lib/password-reset-tokens.ts`
- `src/lib/password-reset.test.ts`
- `src/lib/password-reset-tokens.test.ts`
- `scripts/operator-reset-password.mjs`
- `scripts/operator-reset-password.test.mjs`

### Remove Or Move To woa-admin

- `scripts/operator-sql/templates/membership-grant.sql`
- `scripts/operator-sql/templates/membership-role-update.sql`
- `scripts/operator-sql/templates/membership-revoke.sql`
- `scripts/operator-sql/templates/user-upsert.sql`
- `scripts/operator-sql/templates/user-email-update.sql`
- `scripts/operator-sql/templates/account-link-upsert.sql`
- `scripts/operator-sql/templates/account-link-revoke.sql`
- `scripts/operator-sql/templates/verification-upsert.sql`
- `scripts/operator-sql/identity-resolution.sql`
- `scripts/operator-sql/brad-user-id-remap.sql`
- `ops:a2:*` package scripts that apply operator SQL.

### Keep For Authz Reads

- `src/lib/campaign-membership-repo.ts` read methods.
- `src/utils/campaign-access.ts`.
- `src/lib/search-access.ts`.
- D1 migrations for Better Auth and campaign memberships.

### Revisit Local Development Fixtures

- `scripts/seed-campaign-memberships.mjs`
- `config/campaign-access.config.json`
- `db:seed:memberships:local`
- `dev:cf:auth`

These may still be needed for local protected-content testing, but they must be documented as local-only fixtures, not production/operator user management.

## Implementation Plan

### Phase 1: Better Auth Native Reset Discovery

1. Confirm exact Better Auth endpoints exposed by this installed version through `/api/auth/[...all]`.
   - Expected: `/api/auth/request-password-reset`.
   - Expected: `/api/auth/reset-password`.
   - Existing: `/api/auth/change-password`.

2. Confirm Better Auth `sendResetPassword` option receives `user`, `url`, and `token`, and that `url` respects the `redirectTo` supplied by the client/form.

3. Confirm custom password hashing remains applied on native reset.
   - The expected behavior is Better Auth uses the configured `emailAndPassword.password.hash` function.
   - Verify with tests or staging by checking the `woa-pbkdf2-sha256-v1` prefix after reset.

4. Confirm native reset can revoke sessions.
   - Configure `emailAndPassword.revokeSessionsOnPasswordReset = true` if desired.

5. If any native Better Auth reset behavior is incompatible with Cloudflare/D1/custom hash/Mailjet, document the specific blocker before keeping a custom reset implementation.

### Phase 2: Configure Better Auth For Native Reset

1. Update `src/lib/auth.ts` plan target:
   - Add `emailAndPassword.sendResetPassword` using existing Mailjet sender.
   - Add `emailAndPassword.revokeSessionsOnPasswordReset = true` unless there is a reason not to.
   - Keep `emailAndPassword.password.hash/verify` using `src/lib/password-hashing.ts`.
   - Keep Google provider and existing sign-in/sign-up behavior.

2. Keep reset email delivery in `src/lib/email.ts`, but align it to Better Auth semantics.
   - It should accept Better Auth-provided reset URL.
   - It must not generate or inspect tokens.
   - It must not log reset URLs or tokens.
   - It should keep Mailjet sandbox support and request-id/header behavior if Better Auth/request context can provide a usable request id.

3. Update tests around `src/lib/auth.ts` and `src/lib/email.ts` as needed.
   - Test Mailjet payload shape.
   - Test required env failure.
   - Test reset URL is not included in thrown error text.

### Phase 3: Refactor Forgot/Reset Pages To Use Better Auth

1. Keep `src/pages/forgot-password.astro` as the user-facing page.
   - Form should submit to Better Auth native `/api/auth/request-password-reset`, or use a tiny wrapper only if needed for redirect/status UX.
   - Body should include `email` and `redirectTo` pointing to `/reset-password`.
   - User response must remain generic.
   - Keep `robots="noindex,nofollow"`.

2. Keep `src/pages/reset-password.astro` as the user-facing reset completion page.
   - Read Better Auth token from query string.
   - Render new-password and confirm-password inputs.
   - Submit to Better Auth native `/api/auth/reset-password`, or use a tiny wrapper only if needed for redirect/status UX.
   - Body should include `token` and `newPassword`.
   - It should not query D1 directly to prevalidate tokens unless Better Auth requires this. Avoid duplicating token validation.

3. Remove custom reset backend if native Better Auth works:
   - Delete `src/lib/password-reset.ts`.
   - Delete `src/lib/password-reset-tokens.ts`.
   - Delete corresponding tests.
   - Delete custom API wrapper routes unless retained only for UX redirect glue.

4. If wrapper routes are retained:
   - They must call Better Auth APIs, not D1 token logic.
   - They must not generate tokens, hash tokens, write verification rows directly, update account passwords directly, or delete sessions directly.

### Phase 4: Improve Self-Service Account Page With Better Auth

1. Keep the signed-in change-password UI in `src/pages/account.astro`.
   - It is allowed because it is self-managed by the current signed-in user.
   - It should continue posting to Better Auth `/api/auth/change-password` or use a Better Auth client helper if introduced.
   - It must require current password.
   - It may offer `revokeOtherSessions`.

2. Add self-service update-user functionality to `/account` in a later slice.
   - Use Better Auth `updateUser` for fields such as `name` and possibly `image`.
   - Do not implement direct D1 `UPDATE user` logic.

3. Consider self-service set-password for OAuth-only users in a later slice.
   - Use Better Auth server `setPassword`.
   - Require an active session.
   - Do not create credential accounts manually.

4. Consider account listing/linking/unlinking in a later slice.
   - Use Better Auth `listAccounts`, `linkSocial`, and `unlinkAccount`.
   - Prevent lockout behavior by relying on Better Auth defaults.
   - Do not expose operator/provider repair workflows.

5. Do not enable user deletion in this repo.
   - Deletion/deprovisioning remains a `woa-admin` policy/workflow.

### Phase 5: Route Guarding And Safety

1. Do not block self-service Better Auth endpoints needed by current users:
   - sign-up/email
   - sign-in/email
   - sign-in/social
   - callback routes
   - sign-out
   - get-session
   - request-password-reset
   - reset-password
   - change-password
   - update-user if added
   - set-password if added

2. Consider route guards only for disallowed destructive/admin-like endpoints if Better Auth exposes them and they are enabled.
   - Do not enable `deleteUser` in `src/lib/auth.ts`.
   - Do not add admin plugin functionality in this repo unless explicitly approved.

3. Any custom public-site API route for account operations must be justified as presentation/redirect glue around Better Auth, not as a replacement backend.

### Phase 6: Remove Direct Admin Mutation Tooling

1. Remove `scripts/operator-reset-password.mjs` and `scripts/operator-reset-password.test.mjs` after Better Auth native reset is verified.
   - Rationale: operator-required reset belongs in `woa-admin`.
   - Self-service reset remains in this repo through Better Auth.

2. Remove or archive direct mutation SQL templates:
   - membership grant/update/revoke.
   - user upsert/email update.
   - account link upsert/revoke.
   - verification upsert.

3. Remove or archive one-off/private-looking SQL files if no longer needed:
   - `scripts/operator-sql/brad-user-id-remap.sql`.
   - `scripts/operator-sql/identity-resolution.sql`.

4. Update `package.json` scripts.
   - Remove `ops:a2:apply:*` and `ops:a2:resolve:*` if mutation SQL is removed.
   - Keep read-only audit/preflight scripts only if they remain useful for public-site runtime auth diagnostics.

5. Update runbooks to point operator actions to `woa-admin` and `user-account-management-api.openapi.yaml`.

### Phase 7: Local Membership Fixture Decision

1. Keep campaign membership read access in this repo because protected campaign content still uses it for authz.

2. Decide whether local fixture seeding is still needed.

3. If kept:
   - Rename/re-document as local-only fixture data.
   - Ensure scripts cannot target staging/prod.
   - Keep test identities obviously non-production.

4. If removed:
   - Remove `scripts/seed-campaign-memberships.mjs`.
   - Remove `config/campaign-access.config.json`.
   - Remove `db:seed:memberships:local`.
   - Update `dev:cf:auth` to use another local test setup.

Proposed default: keep local-only fixture seeding for now, but rewrite docs and naming to avoid treating it as an admin workflow.

### Phase 8: Move Front-End Guide And OpenAPI Spec

1. Move durable artifacts out of the repo root after approval.

2. Proposed target paths:
   - `docs/integrations/woa-admin-campaign-user-management-front-end-guide.md`
   - `docs/contracts/user-account-management-api.openapi.yaml`

3. Update links in the guide after moving.

4. Keep these artifacts because this repo will build the front-end that calls `woa-admin` APIs.

5. Ensure the guide remains clear that campaign-management UI:
   - calls `woa-admin` APIs.
   - does not write directly to D1.
   - does not expose global user search.
   - does not expose password/session/provider/deprovisioning controls.

### Phase 9: Documentation Cleanup

1. Update `docs/handoff/woa-admin-user-account-management-handoff.md`.
   - Correct the baseline to say public-site self-service password reset/change remains here.
   - Clarify forced/admin-required reset belongs to `woa-admin`.
   - Clarify direct operator SQL should be removed or deprecated from this repo.

2. Update `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`.
   - Keep Better Auth runtime setup.
   - Keep Mailjet verification/reset email config.
   - Remove direct operator mutation instructions once scripts are removed.
   - Document Better Auth native reset/change/set/update-user behavior.

3. Mark older password reset plans as superseded by the Better Auth-native plan.
   - Do not delete historical plan docs unless approved.

4. Update `plans/features/campaign-admin-dashboard-hld-2026-06-03.md`.
   - Change it from in-repo API/dashboard ownership to public front-end consuming `woa-admin` APIs, or mark it superseded by the guide/spec.

## Verification Plan

Run with `pnpm` only:

```bash
pnpm test
pnpm build
```

Manual checks:

- `/login` supports Google sign-in.
- `/login` supports email sign-in.
- `/login` supports email sign-up.
- `/login` keeps the forgot-password entry point.
- `/forgot-password` sends Better Auth reset email through Mailjet.
- `/reset-password?token=...` resets using Better Auth native reset.
- Password hash after reset has `woa-pbkdf2-sha256-v1` prefix.
- Password reset revokes sessions if configured.
- `/account` change-password works only for the signed-in user.
- `/account` does not expose admin/global user-management controls.
- Protected campaign content still authorizes through membership reads.
- Campaign management front-end code, when added, calls `woa-admin` APIs rather than D1 mutations.

## Open Decisions Before Implementation

1. Should native Better Auth reset revoke all sessions by default?
   - Proposed: yes, set `revokeSessionsOnPasswordReset = true`.

2. Should `/account` add self-service `updateUser` in this same implementation or as a follow-up?
   - Proposed: follow-up after reset backend is refactored.

3. Should OAuth-only `setPassword` be added now or as a follow-up?
   - Proposed: follow-up, because it needs careful UX copy and server-only handling.

4. Should local membership seeding remain as local-only fixtures?
   - Proposed: yes for now, renamed/re-documented rather than removed immediately.

5. Should the `woa-admin` OpenAPI spec server URL use `admin.worldofaletheia.com`, `woa-admin.worldofaletheia.com`, or both?
   - Proposed: align the spec and guide with the actual deployed hostname before moving them into `docs/`.

## Proposed First Implementation Slice

1. Configure Better Auth native `sendResetPassword` and `revokeSessionsOnPasswordReset`.
2. Refactor forgot/reset pages or wrapper routes to call Better Auth native reset endpoints.
3. Remove custom reset-token modules/tests if native reset works.
4. Keep `/account` change-password unchanged except for copy cleanup.
5. Run `pnpm test` and `pnpm build`.
6. Then remove operator password reset and direct SQL mutation tooling in a separate slice.

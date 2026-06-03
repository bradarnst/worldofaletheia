# Self-Service Forgot Password Implementation Plan

## Status

- Date: 2026-06-02
- Status: Proposed
- Related HLD: `plans/self-service-forgot-password-hld-2026-06-02.md`
- Supersedes the user-facing forgot-password handoff described in `plans/password-recovery-and-account-password-ux-hld-2026-06-02.md`.

## Summary

Replace the current operator-assisted forgot-password page with a real self-service reset flow:

1. user enters email on `/forgot-password`
2. site sends a reset link if an eligible account exists
3. user opens `/reset-password?token=...`
4. user sets a new password
5. site updates the existing Better Auth credential row and revokes sessions

The existing operator reset script remains an emergency/manual repair tool, not the normal user path.

## Phase 0 — Discovery and Decision Check

Read first:

- `AGENTS.md`
- `plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md`
- `plans/adrs/0015-seo-and-crawler-governance-policy.md`
- `plans/adrs/0020-astro-actions-form-handling-for-contact-and-contribute.md`
- `plans/adrs/0021-external-admin-capability-boundary.md`
- `plans/adrs/0023-cloudflare-worker-friendly-versioned-password-hashing.md`
- `plans/self-service-forgot-password-hld-2026-06-02.md`
- `src/lib/auth.ts`
- `src/lib/password-hashing.ts`
- `src/lib/email.ts`
- `src/lib/d1.ts`
- `src/pages/login.astro`
- `src/pages/forgot-password.astro`
- `src/pages/account.astro`
- `migrations/0003_auth_core.sql`

Discovery tasks:

1. Check whether Better Auth exposes a native forgot/reset password flow that can be configured without violating constraints.
2. Verify it uses the configured ADR-0023 password hash hook on reset.
3. Verify it supports custom Mailjet email sending and generic user-facing responses.
4. If native flow is clean, use it and keep route UX in project pages.
5. If native flow is awkward or unclear, implement the small project-owned token flow below.

Decision rule:

- Prefer Better Auth native reset only if it is obviously compatible with custom hash hooks, D1 tables, generic responses, and Mailjet.
- Otherwise use the project-owned D1 verification-token flow. Do not spend excessive time trying to force a black-box reset flow.

## Phase 1 — Email Reset Sender

Update `src/lib/email.ts`.

Add input shape:

```ts
interface SendPasswordResetEmailInput {
  env?: Record<string, unknown>;
  email: string;
  resetUrl: string;
  expiresInMinutes: number;
  requestId: string;
}
```

Add provider method/export:

```ts
sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<void>
```

Mailjet requirements:

1. Require `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, and `EMAIL_FROM`.
2. Use existing sandbox-mode handling.
3. Send to the target email only.
4. Include reset URL in email body.
5. Do not log or expose the reset URL in server logs.
6. Add `X-Aletheia-Request-Id` header.

Suggested copy:

```text
You requested a password reset for World of Aletheia.
Use this link within 30 minutes to set a new password:
<resetUrl>

If you did not request this, you can ignore this email.
```

Tests:

- Sends expected Mailjet payload shape.
- Honors sandbox mode.
- Fails closed when required env is missing.
- Does not include reset token in thrown error text.

## Phase 2 — Reset Token Helpers

Add a focused helper module under `src/lib/`, for example:

```text
src/lib/password-reset-tokens.ts
```

Do not create `src/services`, `src/adapters`, or `src/contracts`.

Constants:

```ts
const PASSWORD_RESET_IDENTIFIER_PREFIX = 'password-reset:';
const PASSWORD_RESET_TOKEN_PURPOSE = 'woa-password-reset-v1';
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;
```

Functions:

```ts
createPasswordResetToken(): string
hashPasswordResetToken(token: string): Promise<string>
buildPasswordResetIdentifier(userId: string): string
getPasswordResetExpiry(now?: Date): string
```

Hash behavior:

```text
sha256-base64url("woa-password-reset-v1\0" + rawToken)
```

Tests:

- Token uses base64url-safe characters.
- Token hash is deterministic for same token.
- Token hash differs from raw token.
- Identifier includes user id and purpose prefix.
- Expiry is around 30 minutes.

## Phase 3 — Reset Request Handler

Implement request submission for `/forgot-password`.

Preferred Astro-native shape:

- Use Astro Actions if compatible with the current auth/D1 runtime setup.
- Otherwise use a small API route such as `src/pages/api/auth/request-password-reset.ts`.

Input:

```ts
{
  email: string;
}
```

Server behavior:

1. Normalize email using canonical policy: `trim(lower(email))`.
2. Look up user by `email_canonical`, falling back to normalized `email` where needed.
3. Always return the same user-facing response whether user is found or not.
4. If no user is found, do not send email and do not reveal this.
5. If multiple users somehow match, log sanitized diagnostic and do not send email.
6. If user exists, check for an existing credential account:
   - `providerId = 'credential'`
   - `userId = user.id`
7. If no credential account exists, do not create one and do not reveal this in UI.
8. Generate raw token and hashed token.
9. Delete previous password-reset verification rows for this user identifier.
10. Insert one new verification row into `verification`.
11. Send Mailjet reset email.
12. On email send failure, delete the inserted token and log sanitized failure.
13. Return generic success.

Suggested SQL:

```sql
SELECT id, email, email_canonical
FROM "user"
WHERE COALESCE(email_canonical, lower(trim(email))) = ?;

SELECT id
FROM account
WHERE providerId = 'credential'
  AND userId = ?
LIMIT 1;

DELETE FROM verification
WHERE identifier = ?;

INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?);
```

Logging:

Allowed:

- request id
- action name
- success/failure category
- sanitized reason code

Forbidden:

- raw token
- reset URL
- password
- full hash
- pepper

Tests:

- Known email creates hashed verification row and sends email.
- Unknown email returns generic success and sends no email.
- Google-only/no-credential account returns generic success and sends no email.
- Existing token is replaced.
- Mailjet failure deletes created token.
- Logs/errors do not include token/reset URL.

## Phase 4 — `/forgot-password` Page

Replace the current handoff page.

UX requirements:

1. Title: `Forgot password?`
2. Email input.
3. Submit button: `Send reset link`.
4. Success copy:

```text
If an account exists for that email, we’ll send password reset instructions.
```

5. No technical/operator explanation.
6. Link back to `/login`.
7. `robots="noindex,nofollow"`.
8. Basic native validation: `type="email"`, `required`, `autocomplete="email"`.

## Phase 5 — Reset Completion Handler

Implement reset completion submission.

Preferred Astro-native shape:

- Use Astro Actions if compatible.
- Otherwise use a small API route such as `src/pages/api/auth/complete-password-reset.ts`.

Input:

```ts
{
  token: string;
  newPassword: string;
  confirmPassword: string;
}
```

Server behavior:

1. Validate token shape is non-empty and plausible base64url.
2. Validate password length and confirmation.
3. Hash presented token with reset-token helper.
4. Query `verification` by hashed token value.
5. Fail closed if no row exists.
6. Fail closed if expired.
7. Extract user id from `identifier = password-reset:<user.id>`.
8. Verify the user still exists.
9. Verify exactly one credential account row exists for that user.
10. Hash new password using `hashPassword(newPassword, env)` from ADR-0023 implementation.
11. Update credential account row password and `updatedAt`.
12. Delete password reset token row.
13. Delete sessions for the user.
14. Return success and direct user to `/login`.

Suggested SQL:

```sql
SELECT id, identifier, value, expiresAt
FROM verification
WHERE value = ?
LIMIT 2;

SELECT id
FROM "user"
WHERE id = ?;

SELECT id
FROM account
WHERE providerId = 'credential'
  AND userId = ?;

UPDATE account
SET password = ?, updatedAt = ?
WHERE id = ?
  AND providerId = 'credential'
  AND userId = ?;

DELETE FROM verification
WHERE id = ?;

DELETE FROM session
WHERE userId = ?;
```

Failure UI copy should be generic:

```text
This reset link is invalid or expired. Request a new password reset link.
```

Tests:

- Valid token updates password using ADR-0023 prefix.
- Valid token deletes verification row.
- Valid token revokes sessions.
- Token cannot be reused.
- Expired token fails closed.
- Missing credential row fails closed.
- Multiple credential rows fail closed.
- Invalid token does not reveal account status.
- No raw token/password/hash appears in logs/errors.

## Phase 6 — `/reset-password` Page

Add:

```text
src/pages/reset-password.astro
```

UX requirements:

1. `robots="noindex,nofollow"`.
2. Reads `token` from URL query.
3. If token missing, show invalid/expired reset-link message.
4. If token exists, render form:
   - hidden token field
   - new password
   - confirm new password
   - submit button
5. No current-password field.
6. No account/email display.
7. Success state links to `/login`.
8. Failure state links back to `/forgot-password`.

Progressive enhancement:

- Small vanilla script may check password confirmation client-side.
- Server-side validation remains authoritative.
- Do not log fields.

## Phase 7 — Login Page

Keep the visible link in `src/pages/login.astro`:

```text
Forgot password?
```

Ensure it points to `/forgot-password`.

Keep Google OAuth unchanged.

## Phase 8 — Operator Script and Runbook

Keep `scripts/operator-reset-password.mjs` as emergency/manual recovery.

Update runbook to distinguish:

1. Normal user path: self-service `/forgot-password` email reset.
2. Emergency operator path: operator reset script.
3. `PASSWORD_HASH_PEPPER` requirement for both runtime and operator reset.
4. Hash prefix verification.
5. Campaign membership verification after reset.

## Phase 9 — Abuse Controls

Application implementation:

1. Replace prior active token per user on request.
2. Short expiry window: 30 minutes.
3. Fail closed on malformed/expired token.

Cloudflare operational configuration:

1. Rate-limit `/forgot-password` POST/action/API route.
2. Rate-limit `/reset-password` POST/action/API route.
3. Keep staging noindex.

Suggested initial edge rules:

- `/forgot-password` request endpoint: 5 requests per IP per 10 minutes.
- `/reset-password` completion endpoint: 10 attempts per IP per 10 minutes.

## Phase 10 — Tests

Run and add focused tests for:

### Token helper tests

- token generation
- token hashing
- identifier/expiry behavior

### Email tests

- Mailjet reset email payload
- sandbox behavior
- required env failure

### Request handler tests

- known email
- unknown email
- Google-only/no credential
- duplicate user/collision fail-safe
- token replacement
- email failure cleanup
- generic response

### Completion handler tests

- valid reset
- expired token
- missing token
- reused token
- missing user
- missing credential
- session revocation
- ADR-0023 hash prefix

### Page/build tests where practical

- `/forgot-password` contains email form, no operator tech copy.
- `/reset-password` exists.
- no sensitive strings in rendered output.

## Phase 11 — Verification Commands

Use `pnpm` only.

```bash
pnpm test
pnpm build
```

Manual D1 verification examples:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT identifier, expiresAt, createdAt FROM verification WHERE identifier LIKE 'password-reset:%' ORDER BY createdAt DESC LIMIT 20;"
```

Do not query or print the `value` column during routine verification because it contains reset-token hashes.

Verify credential hash prefix after reset:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT providerId, substr(password, 1, 24) AS password_prefix, updatedAt FROM account WHERE providerId = 'credential' ORDER BY updatedAt DESC LIMIT 20;"
```

Expected prefix:

```text
woa-pbkdf2-sha256-v1
```

Verify campaign membership preservation:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT campaign_slug, user_id, role, created_at, updated_at FROM campaign_memberships WHERE user_id = '<better-auth-user-id>' ORDER BY campaign_slug ASC;"
```

## Phase 12 — Manual Browser Acceptance

Staging first:

1. Open `/login`; confirm `Forgot password?` link exists.
2. Open `/forgot-password`; confirm no operator-tech handoff copy remains.
3. Submit known credential account email.
4. Confirm generic success message.
5. Receive Mailjet email in sandbox/off mode as appropriate.
6. Open reset link.
7. Set new password.
8. Confirm old password fails.
9. Confirm new password succeeds.
10. Open `/account`; confirm session works and memberships display.
11. Confirm protected campaign routes still authorize the same user.
12. Submit unknown email; confirm same generic success message.
13. Confirm Google OAuth still works.
14. Confirm reused reset link fails.
15. Confirm expired reset link fails if tested with forced expiry.

## Rollback Plan

If reset request email breaks:

1. Disable the forgot-password form submit route/action.
2. Restore temporary copy directing users to contact operator.
3. Keep login and Google OAuth available.
4. Use operator reset script for urgent credential recovery.

If reset completion writes a bad password hash:

1. Re-run self-service reset after fix, or use operator reset script.
2. Verify `PASSWORD_HASH_PEPPER` is correct.
3. Verify hash prefix.
4. Verify campaign memberships remain tied to the same user id.

## Acceptance Checklist

- [ ] `/forgot-password` is a real reset-request form.
- [ ] `/reset-password` exists.
- [ ] Reset request response is generic for known/unknown emails.
- [ ] Reset email sends via Mailjet.
- [ ] Raw tokens are never stored.
- [ ] Stored token hash uses purpose-scoped SHA-256.
- [ ] Token expires after 30 minutes.
- [ ] Token is single-use.
- [ ] New password is hashed with ADR-0023 format.
- [ ] Existing Better Auth `user.id` is preserved.
- [ ] Existing sessions are revoked after reset.
- [ ] Campaign memberships still work after reset.
- [ ] Google OAuth is unchanged.
- [ ] Auth/recovery pages are `noindex,nofollow`.
- [ ] No password/token/hash/pepper material appears in logs.
- [ ] Runbook distinguishes self-service reset from emergency operator reset.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.

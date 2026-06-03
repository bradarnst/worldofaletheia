# Password Recovery and Account Password UX Implementation Plan

## Status

- Date: 2026-06-02
- Status: Superseded by `plans/self-service-forgot-password-implementation-plan-2026-06-02.md`
- Correction: password reset completion is handled by an operator script, not public-site reset UI.
- Related HLD: `plans/password-recovery-and-account-password-ux-hld-2026-06-02.md`
- Related ADRs:
  - `plans/adrs/0021-external-admin-capability-boundary.md`
  - `plans/adrs/0023-cloudflare-worker-friendly-versioned-password-hashing.md`

## Summary

Implement rare password reset as an operator script and keep the public site limited to forgot-password handoff plus signed-in change password. This fits the expected reset frequency and avoids permanent public reset-token UI.

## Phase 0 — Boundary and Rollout

Decisions:

1. Do not add `/reset-password` or equivalent token-completion UI.
2. Do not wire Better Auth `sendResetPassword` for public reset links.
3. Add an operator script for reset/recreation.
4. Add `/login` forgot-password handoff.
5. Add `/account` signed-in change password.
6. Preserve Google OAuth and campaign membership/authz behavior.
7. Use no new dependencies and `pnpm` only.

Rollout order:

1. Ensure `PASSWORD_HASH_PEPPER` is set for target environments.
2. Implement and test the operator script locally/staging.
3. Deploy ADR-0023 hash hooks if not already deployed.
4. Run operator reset for existing credential users.
5. Add forgot-password handoff and account change-password UX.
6. Verify login/account/campaign access.

## Phase 1 — Operator Reset Script

Add:

```text
scripts/operator-reset-password.mjs
```

### Requirements

The script must:

1. Run as standalone Node ESM.
2. Use only Node built-ins and existing project files when practical.
3. Require `PASSWORD_HASH_PEPPER` from `process.env`.
4. Generate hashes in ADR-0023 format:

```text
woa-pbkdf2-sha256-v1:<iterations>:<saltBase64url>:<derivedKeyBase64url>
```

5. Use:
   - PBKDF2-SHA-256
   - 32-byte random salt
   - 256-bit derived key
   - NFKC password normalization
   - base64url encoding
   - same default iterations as `src/lib/password-hashing.ts`
6. Prompt/read new password without requiring it as a CLI argument.
7. Confirm password before writing.
8. Target a user by canonical email or explicit user ID.
9. Preserve `user.id`.
10. Update or create the `credential` account row for that user.
11. Optionally revoke sessions.
12. Support `--dry-run`.
13. Avoid logging passwords, full hashes, salts, derived keys, or pepper values.

### Suggested CLI

```bash
PASSWORD_HASH_PEPPER=... pnpm node scripts/operator-reset-password.mjs --env local --email user@example.com --dry-run
PASSWORD_HASH_PEPPER=... pnpm node scripts/operator-reset-password.mjs --env staging --email user@example.com --revoke-sessions
PASSWORD_HASH_PEPPER=... pnpm node scripts/operator-reset-password.mjs --env prod --user-id <better-auth-user-id> --revoke-sessions
```

### Environment handling

Accepted `--env` values:

- `local`
- `staging`
- `prod`

Map to Wrangler flags:

- local: `wrangler d1 execute DB --local`
- staging: `wrangler d1 execute DB --remote --env staging`
- prod: `wrangler d1 execute DB --remote`

Production should require an explicit confirmation prompt unless `--yes` is passed.

### Lookup behavior

By email:

- normalize to `trim(lower(email))`
- query `user.email_canonical` when available
- fall back to normalized `user.email` only if needed
- fail if no user found
- fail if multiple users found

By user ID:

- query exact `user.id`
- fail if not found

### Write behavior

Better Auth credential account rows use `providerId = 'credential'`.

Preferred update path:

1. If credential account exists for `userId`, update `password` and `updatedAt`.
2. If no credential account exists and operator confirms creation, insert credential account row with:
   - generated `id`
   - `accountId = user.id`
   - `providerId = 'credential'`
   - `userId = user.id`
   - `password = <new hash>`
   - `createdAt`, `updatedAt`

Session revocation:

- if `--revoke-sessions`, delete from `session` where `userId = ?`.

### SQL safety

Use SQL literal escaping for generated statements. Do not print generated SQL by default because it contains the full password hash. In dry-run mode, print a sanitized plan only.

## Phase 2 — Script Tests

Add focused tests, for example:

```text
scripts/operator-reset-password.test.mjs
```

Test coverage:

1. CLI argument parsing accepts env + email/user-id.
2. Password hashing emits ADR-0023 prefix and verifies via `src/lib/password-hashing.ts` where practical.
3. Generated SQL updates existing credential account.
4. Generated SQL can create credential account when requested.
5. Session revocation SQL is included only with `--revoke-sessions`.
6. Dry-run output is sanitized and does not include full hashes.
7. Missing pepper fails closed.
8. Invalid env fails closed.

If importing TS password-hashing code into MJS tests is awkward, test hash format and constants locally and keep `pnpm build` as the TS integration gate.

## Phase 3 — Forgot Password Handoff UX

Update `src/pages/login.astro`:

- Add visible “Forgot password?” link near email sign-in.

Add optional `src/pages/forgot-password.astro`:

- Use `MainSiteLayout`.
- No reset-token form.
- No account lookup.
- Explain operator-assisted recovery.
- Provide the chosen support/contact path.
- Use `noindex,nofollow`.

Do not add Better Auth reset-token callbacks or `sendResetPassword` in this repo.

## Phase 4 — Account Change Password UX

Update `src/pages/account.astro`.

Add signed-in change-password section:

- current password
- new password
- confirm new password
- revoke other sessions checkbox
- submit button
- inline status

Submit to:

```text
POST /api/auth/change-password
```

Body:

```json
{
  "currentPassword": "...",
  "newPassword": "...",
  "revokeOtherSessions": true
}
```

Client behavior:

- validate new password confirmation before submit
- do not log password fields
- show clear credential-account-not-found guidance for Google-only accounts
- show generic current-password failure for invalid password

Important: this does not migrate old unsupported hashes. Use the operator script for that.

## Phase 5 — Runbook Updates

Update `docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md` or create a focused runbook section with:

1. How to set/verify `PASSWORD_HASH_PEPPER`.
2. How to run the operator reset script for local/staging/prod.
3. How to reset an existing credential user while preserving `user.id`.
4. How to revoke sessions.
5. How to verify hash prefix.
6. How to verify campaign membership access after reset.

Read-only verification query:

```sql
SELECT providerId, substr(password, 1, 24) AS password_prefix, updatedAt
FROM account
WHERE providerId = 'credential'
ORDER BY updatedAt DESC
LIMIT 20;
```

Expected prefix:

```text
woa-pbkdf2-sha256-v1
```

## Phase 6 — Verification

Commands:

```bash
pnpm test
pnpm build
```

Manual checks:

1. Run script with `--dry-run` for local/staging.
2. Run script against staging test account.
3. Confirm new password sign-in succeeds.
4. Confirm old password fails.
5. Confirm `/account` renders signed-in state.
6. Confirm campaign member content access remains correct.
7. Confirm Google OAuth remains unchanged.
8. Confirm no full hashes/password material appear in terminal output or logs.

## Rollback Plan

If the script writes a bad credential hash:

1. Re-run the script with the intended pepper and a new password.
2. If pepper was wrong, restore the correct `PASSWORD_HASH_PEPPER`; do not rotate casually.
3. If a credential account was accidentally created for the wrong user, repair through private operator SQL and audit memberships.
4. Keep Google OAuth available as fallback.

## Acceptance Checklist

- [ ] `scripts/operator-reset-password.mjs` exists.
- [ ] Script supports local/staging/prod target modes.
- [ ] Script supports email or user ID target lookup.
- [ ] Script requires `PASSWORD_HASH_PEPPER`.
- [ ] Script writes ADR-0023 hash format.
- [ ] Script can update existing credential rows.
- [ ] Script can create credential rows with explicit operator confirmation.
- [ ] Script can revoke sessions.
- [ ] Script has dry-run mode with sanitized output.
- [ ] `/login` has forgot-password handoff.
- [ ] No public reset-token completion page exists.
- [ ] `/account` has signed-in change password UX.
- [ ] Runbook documents rare reset workflow.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.

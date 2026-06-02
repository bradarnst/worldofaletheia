# Cloudflare WebCrypto Password Hashing Implementation Plan

## Status

- Date: 2026-06-02
- Status: Accepted
- Related HLD: `plans/cloudflare-webcrypto-password-hashing-hld-2026-06-02.md`
- Related ADR: `plans/adrs/0023-cloudflare-worker-friendly-versioned-password-hashing.md`

## Summary

Implement a project-owned, versioned WebCrypto password hashing strategy for Better Auth email/password authentication on Cloudflare Workers. This keeps the current Cloudflare + Better Auth + D1 auth architecture while avoiding the CPU-heavy pure-JavaScript scrypt path that likely caused Worker CPU limit errors.

## Phase 0 — Confirm Operating Decision

Decision already made for this plan:

1. Keep Better Auth on Cloudflare.
2. Keep D1 as the current auth/session/membership database.
3. Preserve email/password signup and sign-in.
4. Use versioned hash strings for flexibility.
5. Treat the current two credential users as resettable; no complex legacy hash migration required.

## Phase 1 — Password Hashing Module

Create a small auth-local module for password hashing, for example:

```text
src/lib/password-hashing.ts
```

Responsibilities:

1. Export `hashPassword(password: string): Promise<string>`.
2. Export `verifyPassword(input: { hash: string; password: string }): Promise<boolean>`.
3. Encode new hashes as:
   ```text
   woa-pbkdf2-sha256-v1:<iterations>:<saltBase64url>:<derivedKeyBase64url>
   ```
4. Use `crypto.getRandomValues` for salt generation.
5. Use `crypto.subtle.importKey` and `crypto.subtle.deriveBits` for PBKDF2-SHA-256.
6. Normalize passwords with NFKC before derivation.
7. Compare derived key bytes with a constant-time comparison helper.
8. Never log password material, hash strings, salt, derived keys, or pepper values.

Recommended initial constants:

```text
saltBytes: 32
keyBits: 256
iterations: calibrate in Cloudflare parity lane; start with a conservative value and increase only while staying below CPU budget
```

Do not hardcode final iteration values without measuring in `pnpm dev:cf:auth` and, ideally, staging.

## Phase 2 — Pepper Secret

Add support for a server-side pepper secret and require it for production/staging operation.

Proposed env key:

```text
PASSWORD_HASH_PEPPER
```

Implementation rules:

1. Read from Cloudflare runtime env through the existing auth/runtime env path.
2. Treat missing pepper as a startup/config error in production after rollout.
3. Do not place the pepper in `wrangler.jsonc` plain vars.
4. Store it as a Cloudflare secret for production and staging.
5. Use a local development value through the existing local secret/dev environment mechanism.

Pepper combination policy:

- Derive from a stable encoded password material such as:
  ```text
  normalizedPassword + "\0" + pepper
  ```
- Keep this behavior part of the `v1` hash contract.

## Phase 3 — Better Auth Integration

Update `src/lib/auth.ts` to pass the custom hash hooks into Better Auth:

```ts
emailAndPassword: {
  enabled: true,
  autoSignIn: true,
  requireEmailVerification: false,
  password: {
    hash: projectHashPassword,
    verify: projectVerifyPassword,
  },
}
```

Remove temporary password timing diagnostics once the new implementation is validated, unless there is a concrete operational reason to keep sanitized timing logs.

## Phase 4 — Existing Account Reset

Because only two users are signed up, avoid compatibility complexity.

Release gate: do not deploy the Better Auth password hook to production until
`PASSWORD_HASH_PEPPER` is present in Cloudflare secrets and the credential reset
window below is scheduled. The new verifier intentionally fails closed for any
hash that is not `woa-pbkdf2-sha256-v1`, so existing credential rows must be
reset as part of the same production rollout to avoid locking out email/password
users.

Recommended path:

1. Announce brief auth maintenance window.
2. Remove or invalidate current credential account password hashes.
3. Have the two users recreate/reset their email/password credentials.
4. Preserve user IDs if practical; otherwise repair memberships through existing operator SQL templates.
5. Verify campaign memberships after reset.

If preserving user IDs is important, update only credential account rows rather than deleting user records.

## Phase 5 — Verification

Local/parity checks:

```bash
pnpm build
pnpm test
pnpm dev:cf:auth
```

Manual checks in Cloudflare parity lane:

1. Email sign-up creates a `woa-pbkdf2-sha256-v1` password hash.
2. Email sign-in succeeds.
3. Incorrect password fails without leaking details.
4. Google sign-in still works.
5. `/api/auth/get-session` still returns session for signed-in user.
6. `/account` renders signed-in state.
7. Campaign member page access still respects memberships.
8. Worker logs no longer show `exceededCpu` for email sign-in.

Read-only D1 sanity query:

```sql
SELECT providerId, substr(password, 1, 24) AS password_prefix, createdAt, updatedAt
FROM account
WHERE providerId = 'credential'
ORDER BY updatedAt DESC
LIMIT 20;
```

Expected prefix:

```text
woa-pbkdf2-sha256-v1
```

## Rollback Plan

Fast rollback options:

1. Revert the Better Auth password hook change and disable email/password temporarily.
2. Keep Google OAuth available during rollback.
3. If new hashes were created, users must reset credentials again after rollback or after a corrected hasher deploy.
4. If the pepper was misconfigured, restore the previous secret value rather than rotating it.

Fail-safe behavior:

- Unknown hash versions should return verification failure, not throw raw details to the user.
- Internal logs may record unsupported hash version names but must not record full hashes.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| PBKDF2 is less memory-hard than scrypt/Argon2 | Use pepper, strong iterations, password-manager guidance, versioned future migration |
| Iteration count still too high for Worker free plan | Calibrate in Cloudflare parity/staging and keep below CPU budget |
| Pepper loss invalidates hashes | Store secret carefully; document recovery as password reset |
| Existing hashes incompatible | Reset the two current credential accounts |
| Future backend moves to Postgres/Argon2 | Versioned hashes allow explicit migration or reset |

## Handoff Checklist

- [ ] Add `src/lib/password-hashing.ts`.
- [ ] Add unit tests for hash format parsing, verify success/failure, unsupported versions, malformed hashes, and constant-time comparison helper behavior.
- [ ] Wire Better Auth password hooks.
- [ ] Add `PASSWORD_HASH_PEPPER` to env documentation/runbook.
- [ ] Configure staging and production Cloudflare secrets.
- [ ] Reset/recreate current credential users.
- [ ] Verify account/session/campaign access flows.
- [ ] Remove temporary timing diagnostics if no longer needed.

# Self-Service Forgot Password HLD

## Status

- Date: 2026-06-02
- Status: Proposed
- Correction: public forgot-password must be a real self-service email reset flow, not an operator handoff.
- Related ADRs:
  - `plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md`
  - `plans/adrs/0015-seo-and-crawler-governance-policy.md`
  - `plans/adrs/0020-astro-actions-form-handling-for-contact-and-contribute.md`
  - `plans/adrs/0021-external-admin-capability-boundary.md`
  - `plans/adrs/0023-cloudflare-worker-friendly-versioned-password-hashing.md`

## Context

The current forgot-password handoff page is not an acceptable user-facing forgot-password experience. Users who forget a password need a normal self-service recovery path: request a reset email, click a time-limited link, and set a new password.

ADR-0023 keeps email/password authentication as a first-class option and moves password hashing to a project-owned PBKDF2-SHA-256 format. A self-service recovery flow must write hashes using the same ADR-0023 hooks/format, preserve Better Auth `user.id`, and avoid exposing password, token, hash, salt, derived-key, or pepper material.

ADR-0021 keeps privileged admin/operator capability out of the public site by default, but self-service account recovery is not an admin dashboard or privileged CRUD workflow. It is a normal public account/auth surface and belongs in this repo. The operator reset script remains useful as an emergency/manual fallback, not the primary user experience.

## Goals

1. Replace the operator-handoff forgot-password UX with a real self-service reset flow.
2. Preserve Better Auth `user.id` so campaign memberships and authorization continue to work.
3. Use Mailjet for low-volume transactional reset email delivery.
4. Store only hashed reset tokens, never raw tokens.
5. Use ADR-0023 password hashing for the new password.
6. Keep Google OAuth unchanged.
7. Keep campaign membership/authz behavior unchanged.
8. Keep auth/recovery pages `noindex,nofollow`.
9. Add no dependencies and avoid `src/services`, `src/adapters`, and `src/contracts`.

## Non-goals

1. Do not build an admin dashboard.
2. Do not remove or change Google OAuth.
3. Do not recreate Better Auth users for password recovery.
4. Do not disclose whether an email address has an account.
5. Do not support legacy scrypt password hashes in the verifier.
6. Do not log raw reset tokens, passwords, full hashes, salts, derived keys, or pepper values.
7. Do not move auth/session/campaign memberships to a new backend in this tranche.

## Proposed User Flow

```mermaid
sequenceDiagram
  actor User
  participant Forgot as /forgot-password
  participant Request as Reset request action/API
  participant D1 as D1 verification table
  participant Mailjet
  participant Reset as /reset-password
  participant Complete as Reset completion action/API
  participant Account as Better Auth account table
  participant Session as Better Auth session table

  User->>Forgot: Enter email
  Forgot->>Request: Submit reset request
  Request->>D1: Lookup canonical email
  alt User exists with email/password capable account
    Request->>D1: Store hashed one-time reset token
    Request->>Mailjet: Send reset link
  else User unknown or no local credential
    Request-->>Request: Do not disclose account status
  end
  Request-->>User: Generic "if an account exists" response

  User->>Reset: Open email link with raw token
  User->>Complete: Submit new password + confirmation
  Complete->>D1: Hash presented token and validate unexpired token
  Complete->>Account: Update credential password hash for existing user.id
  Complete->>D1: Delete reset token
  Complete->>Session: Revoke existing sessions for user
  Complete-->>User: Password reset complete; return to login
```

## Routing and Surfaces

### `/forgot-password`

Public account recovery request page.

- Rendered with `noindex,nofollow`.
- Contains email field only.
- Posts to reset request handler.
- Always displays generic success copy:

```text
If an account exists for that email, we’ll send password reset instructions.
```

### `/reset-password`

Public account recovery completion page.

- Rendered with `noindex,nofollow`.
- Requires token from query string or form hidden field.
- Contains new password and confirm password fields.
- Does not ask for current password.
- Does not reveal the target email/account.
- Invalid/expired token shows generic reset-link-expired copy and a link back to `/forgot-password`.

### `/account`

Signed-in password change remains separate.

- Uses current password + new password.
- Posts to Better Auth change-password.
- Not a substitute for forgot-password because forgotten-password users cannot provide the current password.

## Data Model

### Preferred storage: existing Better Auth `verification` table

Use the existing D1 `verification` table to avoid a new schema migration for a small, standard auth verification workflow.

Suggested row shape:

```text
id: random UUID
identifier: password-reset:<user.id>
value: sha256-base64url("woa-password-reset-v1\0" + rawToken)
expiresAt: ISO timestamp
createdAt: ISO timestamp
updatedAt: ISO timestamp
```

Policy:

1. Store only hashed token values.
2. Delete previous password-reset verification rows for the same `identifier` before inserting a new row.
3. Delete the token row immediately after successful reset.
4. Delete expired matching token rows during request/complete handling.
5. Treat missing, malformed, expired, or duplicate state as invalid and fail closed.

### Token format

- Raw token: 32 random bytes, base64url encoded.
- Token in URL: raw token only.
- Stored token: SHA-256 hash of a purpose-scoped string.
- Expiry: 30 minutes by default.

## Password Write Behavior

On successful reset:

1. Resolve the reset token to a single existing Better Auth `user.id`.
2. Generate an ADR-0023 hash via existing password hashing code/path.
3. Update the existing `account` row where `providerId = 'credential'` and `userId = <user.id>`.
4. If no credential account exists, fail with a generic message rather than creating one silently.
5. Delete reset token row.
6. Revoke existing sessions for that `user.id` by default.

Rationale: forgotten-password recovery for email/password users should preserve identity and campaign membership. Creating a new credential row for a Google-only account from a public reset link is account-linking behavior and should not happen implicitly.

## Email Behavior

Use Mailjet via the existing email module pattern from ADR-0006.

Reset email requirements:

- Subject: clear and non-alarming, e.g. `Reset your Aletheia password`.
- Text body includes the reset URL and expiry window.
- No password, no account status disclosure beyond delivery to the mailbox.
- Logs may include a request ID and email-send status, but never the raw token or full reset URL.

## Security and Abuse Controls

Required:

1. Generic request response for known and unknown emails.
2. Canonical email lookup using `email_canonical` / `trim(lower(email))` semantics.
3. Time-limited one-time token.
4. Hashed token storage only.
5. Session revocation after successful reset.
6. No sensitive material in logs.
7. `noindex,nofollow` on auth/recovery pages.
8. Cloudflare WAF/rate-limit rule for reset request and completion endpoints.

Recommended first-pass rate limits:

- Per IP: low burst, e.g. 5 reset requests per 10 minutes.
- Per canonical email: at most one active token; later requests replace the prior token.
- Completion attempts: low burst per IP/token to limit guessing.

## Implementation Boundary

This is an in-repo public account flow, not an external admin capability. It does not require populating `src/services`, `src/adapters`, or `src/contracts`.

Preferred implementation shape:

- `.astro` pages for `/forgot-password` and `/reset-password`.
- Astro Actions or small API routes for request/complete handlers.
- Existing `src/lib/email.ts` extended with a reset email sender.
- Existing `src/lib/password-hashing.ts` used for new password hashing.
- Existing D1 binding access pattern used directly in handler code.

## Considered Options

### Option 1: Keep operator-assisted forgot-password handoff

Rejected.

- Not a real forgot-password flow.
- Poor UX for normal account users.
- Makes a routine user account operation unnecessarily manual.

### Option 2: Use Better Auth native forgot/reset password flow

Potentially acceptable if it can be configured cleanly with:

- Mailjet sender
- custom ADR-0023 hash hooks
- generic responses
- no sensitive logging
- preserved `user.id`
- no unwanted route shape or token leakage

This should be checked during implementation discovery.

### Option 3: Implement a small project-owned reset token flow using D1 verification table (Preferred fallback / likely implementation)

Chosen if Better Auth native flow is awkward or conflicts with project constraints.

- Keeps the implementation understandable and Worker-friendly.
- Uses existing D1 and Mailjet infrastructure.
- Avoids new dependencies and new storage migrations.
- Avoids service/adapter/contract layers.

## Acceptance Criteria

1. `/forgot-password` is a real email reset request page.
2. `/reset-password` exists and lets users set a new password with a valid token.
3. Unknown emails receive the same response as known emails.
4. Tokens are time-limited, single-use, and stored only as hashes.
5. Successful reset updates the existing credential row for the same Better Auth `user.id`.
6. Campaign memberships remain valid after reset.
7. Existing sessions are revoked after reset.
8. Google OAuth behavior is unchanged.
9. Auth/recovery pages are `noindex,nofollow`.
10. No sensitive password/token/hash/pepper material appears in logs.
11. `pnpm test` and `pnpm build` pass.

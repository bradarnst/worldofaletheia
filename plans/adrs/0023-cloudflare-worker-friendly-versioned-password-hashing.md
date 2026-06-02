# Cloudflare Worker-Friendly Versioned Password Hashing

## Status

Accepted

## Context and Problem Statement

World of Aletheia runs Better Auth inside the Astro Cloudflare Worker with D1-backed auth tables. Production logs showed `Worker exceeded CPU time limit` on `POST /api/auth/sign-in/email`. The failure path is isolated to Better Auth email/password sign-in, and Better Auth's default password hashing path resolves to pure-JavaScript scrypt in the Cloudflare Workers runtime.

The project wants to preserve email/password signup and sign-in rather than forcing Google OAuth, while also avoiding a near-term Cloudflare paid-plan upgrade or a premature Railway/Postgres auth migration. Only two users currently have meaningful credential state, so password reset/recreation is acceptable if the hash format changes.

This decision concerns near-term authentication runtime behavior only. It does not decide the future paid Campaigns backend architecture. A future hybrid model may still move campaign-specific authn/authz, memberships, indexes, or runtime state to Railway/Postgres or another backend while public content remains Cloudflare-hosted.

## Decision Drivers

- Preserve email/password authentication as a first-class option.
- Reduce risk of Worker free-plan CPU exhaustion during sign-in/sign-up.
- Keep current Better Auth + D1 + Cloudflare architecture for now.
- Avoid forcing Google-only login for users.
- Avoid premature external auth service complexity before Campaigns monetization/backend needs are proven.
- Use versioned password hash strings so future hashing/backend changes are explicit and manageable.
- Keep secrets and password material out of logs and tracked files.
- Preserve future optionality for a hybrid Campaigns backend.

## Considered Options

### Option 1: Keep Better Auth default password hashing

Continue using Better Auth's default scrypt behavior.

**Pros**

- No code change.
- Keeps strong memory-hard password hashing semantics.

**Cons**

- Pure-JavaScript scrypt in Workers is very likely the cause of CPU exhaustion.
- Leaves email/password sign-in unreliable on the Cloudflare free plan.
- May force either Google-only auth or a paid Cloudflare upgrade.

### Option 2: Disable email/password and use Google OAuth only

Remove email/password signup and sign-in, keeping Google as the only login method.

**Pros**

- Lowest implementation complexity.
- Avoids the expensive password hashing path.
- Keeps auth entirely on Cloudflare.

**Cons**

- Heavy-handed user experience.
- Forces users to have/use Google accounts.
- Weak fit for a public-facing campaign platform where account choice matters.

### Option 3: Move Better Auth to Railway/Postgres now

Host auth on Railway with PostgreSQL and call it from the Cloudflare site.

**Pros**

- Removes password hashing from Cloudflare Workers.
- Allows Node/Postgres-oriented auth operation.
- Could align with a future Campaigns backend if monetization arrives quickly.

**Cons**

- Introduces a real external API/session boundary now.
- Requires cross-service cookie/session/CORS/proxy design.
- Splits or migrates campaign memberships earlier than needed.
- Adds operational complexity before the business signal is confirmed.

### Option 4: Use project-owned WebCrypto PBKDF2 password hashing with versioned hashes (Chosen)

Override Better Auth's password hash/verify hooks with a Cloudflare Worker-friendly WebCrypto implementation. Store hashes in a project-owned versioned format such as `woa-pbkdf2-sha256-v1:<iterations>:<salt>:<derivedKey>`, protected in production by a server-side pepper secret.

**Pros**

- Keeps email/password available.
- Avoids pure-JavaScript scrypt in the Worker.
- Keeps current auth/session/membership architecture intact.
- Requires no new dependency or external service.
- Versioned hash strings preserve future migration flexibility.
- Existing two-user credential state can be reset instead of migrated.

**Cons**

- PBKDF2 is not memory-hard and is generally weaker against offline cracking than scrypt/Argon2.
- The project owns password hashing parameters and version policy.
- Pepper management adds secret-handling responsibility.
- Future migration may still be needed if paid Campaigns requires a separate backend.

### Option 5: Upgrade Cloudflare plan

Keep the existing implementation and pay for higher Worker CPU limits.

**Pros**

- Minimal code change.
- Keeps stronger default scrypt behavior.

**Cons**

- Adds recurring cost primarily to work around one runtime hotspot.
- Does not remove inefficient pure-JavaScript CPU use.
- May still be unnecessary if a Worker-friendly hasher solves the issue.

## Decision Outcome

Chosen option: Option 4 — use project-owned WebCrypto PBKDF2 password hashing with versioned hash strings.

### Policy

1. Better Auth remains the auth/session framework in the Cloudflare Astro app for the near term.
2. D1 remains the current storage layer for Better Auth tables and campaign memberships.
3. Email/password authentication remains enabled.
4. Better Auth's password `hash` and `verify` hooks will be overridden by a project-owned implementation using `crypto.subtle` PBKDF2-SHA-256.
5. New password hashes must use a self-describing versioned format:
   ```text
   woa-pbkdf2-sha256-v1:<iterations>:<saltBase64url>:<derivedKeyBase64url>
   ```
6. A server-side pepper secret is required for production/staging rollout; it must be stored as a Cloudflare secret, not a tracked config value.
7. Existing credential users may be reset/recreated rather than migrated through a legacy scrypt verifier.
8. Unsupported or malformed hash formats fail closed.
9. Passwords, full hashes, salts, derived keys, and pepper values must never be logged.
10. Future Campaigns backend extraction remains open; this decision is a near-term Cloudflare auth runtime decision, not a permanent database/backend commitment.

### Consequences

#### Positive

- Email/password login can remain available without forcing Google-only auth.
- Worker CPU risk from pure-JavaScript scrypt should be materially reduced.
- Current Cloudflare + Better Auth + D1 architecture stays intact.
- The implementation avoids near-term Railway/Postgres migration complexity.
- Versioned hashes make future password-policy or backend migration explicit.

#### Negative

- PBKDF2-SHA-256 is less resistant to offline cracking than memory-hard KDFs such as scrypt or Argon2id.
- The project assumes responsibility for selecting and revisiting PBKDF2 iteration parameters.
- Pepper loss or rotation can require password resets unless multi-pepper rotation is later designed.
- Existing credential accounts require reset/recreation or a deliberate compatibility path.

#### Neutral

- Google OAuth remains available as an alternate sign-in method.
- Campaign authorization semantics do not change.
- Campaign memberships remain in D1 for now.
- Future paid Campaigns architecture may still move campaign-specific authn/authz and memberships to a separate backend/database.
- This decision does not introduce new service, adapter, or contract layers in the public site.

## Links

- HLD: `plans/cloudflare-webcrypto-password-hashing-hld-2026-06-02.md`
- Implementation Plan: `plans/cloudflare-webcrypto-password-hashing-implementation-plan-2026-06-02.md`
- Related ADR: `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- Related ADR: `plans/adrs/0019-campaign-membership-role-unification.md`
- Related ADR: `plans/adrs/0021-external-admin-capability-boundary.md`

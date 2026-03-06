# Production Account Ingestion and Management Options (Fresh MVP Design)

## Scope Reset

This document is intentionally a fresh production design request.

- It **does not** rely on `src/content/campaigns/access.config.json`.
- It **does not** rely on any prior example names or dev fixtures.
- Goal: practical ways to ingest/manage real production accounts in Cloudflare Workers + Better Auth + D1 while keeping sensitive identity and assignment data private from GitHub viewers.

---

## Constraints and Goals

### Constraints

1. Cloudflare Workers runtime with D1.
2. Better Auth for auth/session handling.
3. Small team, low ops bandwidth.
4. Need launch-ready process soon.

### Goals

1. Keep personally identifying data and assignment details out of repository content/config files.
2. Keep authorization decisions reliable and auditable.
3. Avoid overengineering before usage justifies it.

---

## Option A — Manual Ops Runbook + Direct D1 SQL (No New UI)

### Description

Use manual, authenticated operator commands (Wrangler + D1 SQL) to:

- ingest production users when needed,
- assign campaign memberships,
- assign GM/owner privileges,
- revoke access.

Store assignment data only in D1 tables. Keep runbook in repo, but no real user data in repo.

### Pros

- Fastest to launch.
- No new app surface to secure.
- No extra service dependencies.
- Strong privacy posture (data stays in D1, not in Git history).

### Cons

- Human error risk in manual SQL.
- Requires careful runbook discipline.
- Less ergonomic for frequent changes.

### Security/Privacy

- Good if operators use least-privilege Cloudflare access and avoid storing exports.
- Must avoid copying query outputs containing emails into tickets/docs.

### Operational Effort

- Low ongoing (if membership changes are infrequent).
- Medium procedural rigor needed.

### Implementation Speed

- Very fast (same day to 1–2 days).

---

## Option B — Minimal Internal Admin API (Protected) + D1

### Description

Add admin-only Workers endpoints for user/membership assignment operations.

- Protect with strict admin gate (allowlisted admin user IDs and/or signed admin token).
- Keep D1 as source of truth.
- Use CLI/curl calls against admin endpoints.

### Pros

- Reduces direct SQL mistakes.
- Operations become standardized and repeatable.
- Easier audit logging per action.

### Cons

- New privileged API surface must be secured.
- Slightly more engineering than manual-only.

### Security/Privacy

- Good if strong authN/authZ and audit logs are in place.
- Risk increases if admin endpoint protection is weak.

### Operational Effort

- Medium initial, low ongoing.

### Implementation Speed

- Medium (2–5 days).

---

## Option C — Tiny Internal Admin UI (Protected) + D1

### Description

Build a simple server-rendered admin page for account assignment and access control.

### Pros

- Easiest day-to-day operation for non-CLI admin tasks.
- Lower operator error than raw SQL.

### Cons

- Highest implementation and security burden among MVP options.
- Adds UI maintenance and privileged UX hardening work.

### Security/Privacy

- Can be safe, but creates the largest attack surface.

### Operational Effort

- High initial, medium ongoing.

### Implementation Speed

- Slowest (several days to weeks depending on hardening expectations).

---

## Option D — External Identity/Admin System (e.g., dedicated IdP or admin backend)

### Description

Use external managed tooling for user lifecycle and role assignment.

### Pros

- Rich admin features, audit trails, and policy controls.

### Cons

- Vendor and integration overhead.
- Highest complexity for current scale.

### Security/Privacy

- Depends on vendor and integration quality.
- More systems handling sensitive account metadata.

### Operational Effort

- High initial integration, medium ongoing.

### Implementation Speed

- Slow for MVP.

---

## Comparison Summary

| Option | Privacy from GitHub | Security Risk | Ops Effort | Dev Effort | Speed |
|---|---|---|---|---|---|
| A: Manual runbook + D1 SQL | High | Low–Medium (human error) | Low–Medium | Low | Fastest |
| B: Admin API + D1 | High | Medium (endpoint hardening) | Low | Medium | Fast |
| C: Admin UI + D1 | High | Medium–High (UI attack surface) | Low | High | Moderate/Slow |
| D: External system | High | Medium (integration risk) | Medium | High | Slowest |

---

## Recommended MVP Path

### Recommendation: **Option A now**, with a planned migration to **Option B**

Why this is best for current stage:

1. Delivers production readiness fastest.
2. Keeps identity and assignment data out of repo history.
3. Avoids building privileged admin surfaces before needed.
4. Fits static-first / YAGNI architecture direction.
5. Leaves a clean path to standardized admin operations later.

### MVP Source-of-Truth Policy

1. Auth identities: Better Auth tables in D1.
2. Access assignments: D1 tables only.
3. Repository docs: process only, no real user data.
4. Runtime authorization: read from D1, deny-by-default on read errors.

---

## Concrete First-Step Execution Plan (Start Immediately)

## Step 0 — Verify operator access and database state

Run:

```bash
pnpm wrangler whoami
pnpm wrangler d1 list
pnpm wrangler d1 info world-of-aletheia
pnpm wrangler d1 info world-of-aletheia-staging
```

Success criteria:

- Correct Cloudflare account is active.
- Target D1 databases are visible.

## Step 1 — Establish/verify production schema in D1

1. Ensure Better Auth core tables exist (user/session/account/verification).
2. Ensure campaign authorization tables exist (at least memberships; plus GM assignment table if adopted now).

Verify with:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Step 2 — Define canonical assignment tables (D1)

Minimum table set for authorization decisions:

1. `campaign_memberships(user_id, campaign_slug, role, created_at, updated_at)`
2. `campaign_gm_assignments(campaign_slug, user_id, created_at, updated_at)` (recommended now or immediate next)

## Step 3 — Create a private operator runbook

Create/maintain a runbook that includes:

1. Add account flow.
2. Grant membership flow.
3. Grant/revoke GM flow.
4. Revoke account flow.
5. Verification queries.

Important: runbook contains commands/templates only; no real identities committed.

## Step 4 — Ingest first real accounts privately

Ingest initial production accounts using one of:

1. normal sign-up/login flows (preferred if available), or
2. controlled manual DB insert process when required.

Then assign memberships/GM in D1 via operator commands.

## Step 5 — Validate end-to-end authorization behavior

Validate in staging first, then production:

1. unauthenticated access denied for protected routes,
2. authenticated without membership denied,
3. authenticated with membership allowed,
4. authenticated non-GM denied GM-only content,
5. authenticated GM allowed GM-only content.

## Step 6 — Record launch-baseline snapshot (private)

Store private operational snapshot outside repo (secure notes/vault):

- migration version,
- table counts,
- assignment counts,
- date/operator.

---

## Immediate “Do This First” Checklist

1. Run Step 0 commands.
2. Run Step 1 table verification query.
3. If tables missing, apply schema migrations before any account ingestion.
4. Create private operator runbook entries for add/grant/revoke.
5. Ingest initial real accounts and assignments in staging, validate, then repeat in production.

---

## MVP Done Definition (Minimal)

MVP is done when:

1. Production auth and assignment tables exist in D1.
2. Real production accounts are present only in D1 (not repo files).
3. Real assignment details are managed only via private ops process.
4. Protected route checks read D1-backed assignments and enforce deny-by-default.
5. Staging and production validation scenarios pass.
6. No identity or assignment details are committed to GitHub.

---

## Post-MVP Upgrade Path (Low-Risk)

1. Add minimal protected Admin API (Option B) for assignment operations.
2. Keep D1 as single source of truth.
3. Add action-level audit logs.
4. Keep UI admin tooling deferred until frequency/complexity justifies it.

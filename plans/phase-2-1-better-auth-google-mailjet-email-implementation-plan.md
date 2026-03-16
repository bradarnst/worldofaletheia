# Phase 2.1 Execution Plan — Better Auth 1.5.3 + Cloudflare D1 + Google OAuth + Mailjet Email

## Status

- **Date:** 2026-03-15
- **Status:** Implemented (staging + production)
- **Primary Scope:** Phase 2.1 replacement of local/dev membership gate internals with production auth/session/membership
- **Source-of-truth docs:**
  - [`plans/campaign-permissions-phased-enhancement-plan.md`](plans/campaign-permissions-phased-enhancement-plan.md)
  - [`plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md`](plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md)

---

## 0) Executive implementation intent

This phase delivers **production-safe auth** and **campaign membership enforcement** while preserving existing authorization semantics and request-time gating structure.

### Hard guarantees that must remain true

1. [`src/pages/campaigns/[...slug].astro`](src/pages/campaigns/[...slug].astro) stays SSR and request-time gated.
2. No `prerender = true` added to protected campaign routes.
3. No `getStaticPaths()` reintroduced on [`src/pages/campaigns/[...slug].astro`](src/pages/campaigns/[...slug].astro).
4. Visibility remains **file-level only** (`public` | `campaignMembers`).
5. Campaign-level visibility defaults are not allowed.
6. Membership lookup failure is **deny-by-default** for `campaignMembers`.

### Launch scope choices

- **Enabled now:** Google OAuth only
- **Deferred:** Discord OAuth (additive later)
- **Email path:** Mailjet HTTP API (per ADR-0006)

---

## 1) Architecture and authorization boundary (final shape)

### 1.1 Request flow for protected campaign content

1. Request hits campaign route (SSR).
2. Route obtains request context from `Astro.request`.
3. Route invokes existing policy seam:
   - [`createCampaignAccessResolver()`](src/utils/campaign-access.ts:151)
   - [`canViewCampaignContent()`](src/utils/campaign-access.ts:141)
4. Resolver uses Better Auth session + D1 membership repository.
5. Policy evaluates only `visibility` + membership check.
6. Protected content either renders or returns restricted-state UI.

### 1.2 Boundary ownership

- **Authentication/session validity:** Better Auth
- **Membership entitlement:** D1 `campaign_memberships`
- **Authorization rule:** [`canViewCampaignContent()`](src/utils/campaign-access.ts:141)
- **Visibility source:** markdown frontmatter via content schema, not campaign folder/config defaults

---

## 2) File-by-file delivery plan

> Notes:
> - “Add” means new file.
> - “Edit” means modify existing file.
> - Paths listed are exact target repo paths.

### 2.1 Auth core and request plumbing

1. **Add** [`src/lib/auth.ts`](src/lib/auth.ts)
   - Better Auth singleton initialization.
   - Google provider configuration.
   - D1 adapter binding usage.
   - trusted origins + cookie policy.
   - Provider map shape designed for later Discord addition.

2. **Add** [`src/lib/auth-session.ts`](src/lib/auth-session.ts)
   - `getRequestSession(request)` helper.
   - Returns `{ user, session } | null`.
   - Wraps session read errors; never throws to route layer.

3. **Add** [`src/pages/api/auth/[...all].ts`](src/pages/api/auth/[...all].ts)
   - Catch-all auth endpoint forwarding to Better Auth handler.
   - Centralized structured error logging + generic 500 response.

### 2.2 Membership persistence and resolver seam

4. **Add** [`src/lib/campaign-membership-repo.ts`](src/lib/campaign-membership-repo.ts)
   - `isUserMemberOfCampaign(userId, campaignSlug)`
   - optional `listCampaignMemberships(userId)`
   - optional bootstrap seeding helper (non-prod only)
   - no authorization logic in this module

5. **Add** [`src/lib/d1.ts`](src/lib/d1.ts)
   - narrow utility for acquiring typed D1 binding from runtime context.
   - explicit error when binding unavailable.

6. **Edit** [`src/utils/campaign-access.ts`](src/utils/campaign-access.ts)
   - keep exported policy signatures unchanged.
   - update resolver internals to:
     - resolve Better Auth session identity from request context,
     - query D1 membership repo,
     - retain transitional fallback for local env map if explicitly enabled.
   - preserve deny-by-default behavior.

7. **Edit** [`src/utils/campaign-membership-config.ts`](src/utils/campaign-membership-config.ts)
   - validate membership-seed JSON shape only.
   - no visibility logic.

8. **Edit** [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json)
   - maintain membership mapping seed format.
   - remain optional bootstrap input.

### 2.3 Route wiring (must preserve call sites)

9. **Edit** [`src/pages/campaigns/[...slug].astro`](src/pages/campaigns/[...slug].astro)
   - no static conversion changes.
   - continue route-time resolver + policy invocation.
   - update resolver creation input to pass request context compatible with auth session lookup.

10. **Edit** [`src/pages/campaigns/[campaign]/sessions/index.astro`](src/pages/campaigns/[campaign]/sessions/index.astro)
    - preserve behavior: filter session listing by `canViewCampaignContent`.
    - use updated resolver initialization.

11. **Edit** [`src/pages/campaigns/[campaign]/sessions/[...slug].astro`](src/pages/campaigns/[campaign]/sessions/[...slug].astro)
    - preserve behavior: protect detail content render by policy result.
    - use updated resolver initialization.

### 2.4 Login/logout/account UX

12. **Add** [`src/pages/login.astro`](src/pages/login.astro)
    - Google sign-in button only.
    - optional `next` param (validated internal path only).
    - explicit restricted-state guidance for campaign readers.

13. **Add** [`src/pages/logout.astro`](src/pages/logout.astro)
    - call sign-out endpoint.
    - clear local client state/cookies as needed.
    - redirect to `/campaigns`.

14. **Add** [`src/pages/account.astro`](src/pages/account.astro)
    - show auth/session status.
    - list campaign memberships (optional early debug view).

15. **Edit** restricted-state copy in campaign protected routes
    - replace local cookie-map instructions with login URL flow.

### 2.5 Email and contact relay

16. **Add** [`src/lib/email.ts`](src/lib/email.ts)
    - provider-agnostic adapter interface.
    - concrete Mailjet API implementation.
    - methods:
      - `sendVerificationEmail(...)`
      - `sendContactEmail(...)`

17. **Add** [`src/pages/api/contact.ts`](src/pages/api/contact.ts)
    - low-volume contact relay endpoint.
    - validation + rate-limit guardrails.
    - calls `sendContactEmail`.

18. **Edit** auth callbacks in [`src/lib/auth.ts`](src/lib/auth.ts)
    - wire verification emails through `sendVerificationEmail`.

### 2.6 Config, docs, and operations

19. **Edit** [`wrangler.jsonc`](wrangler.jsonc)
    - add D1 binding section.
    - add env-specific vars placeholders for auth + email routes.
    - keep existing compatibility flags.

20. **Add** [`docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`](docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md)
    - setup steps by env.
    - migration + rollback commands.
    - operational checks and troubleshooting.

21. **Edit** [`docs/runbook/campaign-access-local-dev.md`](docs/runbook/campaign-access-local-dev.md)
    - mark local cookie map as legacy fallback.
    - point to new auth runbook.

22. **Edit** [`plans/campaign-permissions-phased-enhancement-plan.md`](plans/campaign-permissions-phased-enhancement-plan.md)
    - when implementation completes, update Phase 2.1 status and delivered artifacts.

---

## 3) Data model and migration sequence (D1)

## 3.1 Schema (minimum)

### Better Auth core tables

Use Better Auth migration generation for required auth tables (users/accounts/sessions/verifications and required indexes).

### App-managed membership table

`campaign_memberships`:

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `campaign_slug TEXT NOT NULL`
- `role TEXT NOT NULL DEFAULT 'member'`
- `created_at TEXT NOT NULL` (ISO timestamp)
- `updated_at TEXT` (optional)
- `UNIQUE(user_id, campaign_slug)`
- `INDEX idx_campaign_memberships_campaign_slug(campaign_slug)`
- `INDEX idx_campaign_memberships_user_id(user_id)`

## 3.2 Migration order

1. Create auth tables migration.
2. Create `campaign_memberships` migration.
3. Run migrations in local D1.
4. Seed local/test membership from [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json).
5. Promote to staging D1.
6. Validate auth + membership reads.
7. Promote to production D1.

## 3.3 Seed policy

- Seeding is bootstrapping only.
- Seed script must be idempotent.
- Seed must not overwrite existing rows.
- Seed is disabled for production by default unless explicitly requested.

---

## 4) Environment contract and deployment config

## 4.1 Required env vars

### Auth

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Transitional fallback (optional)

- `CAMPAIGN_MEMBERSHIPS` (legacy local map)

### Deferred (not enabled in this phase)

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

### Email (Mailjet path)

- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (optional)
- `CONTACT_TO_EMAIL`
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `MAILJET_SANDBOX_MODE` (`on` or `off`)

## 4.2 Cloudflare bindings

- `DB` (D1)
- No additional email runtime bindings required beyond outbound HTTPS; Mailjet credentials are env-based

## 4.3 Env profiles

### Local

- local D1 DB
- localhost Better Auth URL
- Google OAuth local redirect URL
- email path uses test route / dry-run mode

### Staging

- dedicated staging D1
- staging auth URL + Google redirect
- real email route to controlled inbox

### Production

- production D1
- production auth URL + Google redirect
- production email route

---

## 5) Auth/session flow specification

## 5.1 Sign-in flow (Google only)

1. User opens [`/login`](src/pages/login.astro).
2. User selects “Continue with Google”.
3. OAuth redirects through [`/api/auth/[...all]`](src/pages/api/auth/[...all].ts).
4. Session persisted through Better Auth tables in D1.
5. User redirected to safe `next` or default campaigns page.

## 5.2 Protected campaign read flow

1. Route receives request.
2. Resolver gets session from request.
3. If route content visibility is `public` -> allow.
4. If `campaignMembers`:
   - if no valid session -> deny
   - if session but no membership row -> deny
   - if membership exists for campaign slug -> allow

## 5.3 Sign-out flow

1. User opens [`/logout`](src/pages/logout.astro).
2. Route calls Better Auth sign-out endpoint.
3. Session invalidated.
4. Redirect to public page.

---

## 6) Email verification and contact relay implementation

## 6.1 Verification email path

- Triggered by Better Auth verification callback.
- Delivered through Mailjet adapter in [`src/lib/email.ts`](src/lib/email.ts).
- Template includes:
  - action URL
  - expiry information
  - support contact

## 6.2 Contact relay path

- POST to [`/api/contact`](src/pages/api/contact.ts).
- Validate payload (name/email/message/honeypot).
- Rate-limit by IP/fingerprint (simple low-volume guard).
- Relay to `CONTACT_TO_EMAIL` via Mailjet API path.

## 6.3 Failure handling

- Verification send failure:
  - fail action and return generic retry guidance
  - do not expose token or provider internals
- Contact send failure:
  - return generic “try later” response
  - log request correlation id

---

## 7) Security controls and abuse protection

1. **Deny-by-default authz:** Any auth/db ambiguity denies `campaignMembers`.
2. **Safe redirects:** `next` accepts internal paths only.
3. **Secret handling:** no secrets in logs, no token echo in errors.
4. **Cookie posture:** secure/httponly/samesite defaults for production.
5. **CSRF posture:** rely on Better Auth route protections + same-site cookies.
6. **Contact endpoint controls:** minimal per-IP rate limiting + honeypot + input validation.
7. **No role-based authz shortcuts:** `permissions`/GM labels remain non-authoritative.

---

## 8) Observability and logging expectations

## 8.1 Structured log events

Emit structured events for:

- auth sign-in success/failure
- session resolution failure
- membership query failure
- access denied reason category (`unauthenticated`, `not-member`, `system-error`)
- verification send success/failure
- contact relay success/failure

## 8.2 Log hygiene

- never log OAuth tokens, auth secrets, verification tokens, raw cookie values
- include correlation/request ids where possible
- include campaign slug + route path for access decisions

## 8.3 Monitoring checkpoints

- 5xx rate on auth route
- membership DB query error count
- access-denied rate trend by campaign route
- email send failure count

---

## 9) Test strategy

## 9.1 Unit tests

Update/add:

- [`src/utils/campaign-access.test.ts`](src/utils/campaign-access.test.ts)
  - keep core policy semantics
  - add session+membership resolution unit cases via mocks
- [`src/utils/campaign-membership-config.test.ts`](src/utils/campaign-membership-config.test.ts)
  - membership seed config shape and sanitization
- add tests for [`src/lib/campaign-membership-repo.ts`](src/lib/campaign-membership-repo.ts)
  - membership found/not found
  - DB failure behavior
- add tests for [`src/lib/email.ts`](src/lib/email.ts)
  - adapter call shape and failure paths

## 9.2 Integration tests

- auth API route responses for key paths (`/api/auth/*` basic route health)
- campaign route rendering with simulated auth states
- D1-backed membership enforcement integration

## 9.3 E2E smoke scripts (manual or scripted)

1. unauthenticated user opens protected campaign page -> restricted state
2. authenticated non-member opens protected page -> restricted state
3. authenticated member opens protected page -> content visible
4. public campaign/session pages visible without auth
5. login and logout redirects behave as expected
6. contact form relay path returns success and sends message

## 9.4 Required command set

1. `pnpm test -- src/utils/campaign-access.test.ts src/content-policy-scope.test.mjs`
2. `pnpm test -- src/utils/campaign-membership-config.test.ts`
3. `pnpm build`

---

## 10) QA scripts and sign-off checklist

## 10.1 Functional QA script

1. Start app with local auth env.
2. Validate `/login` Google button flow.
3. Validate `/account` session display.
4. Validate protected campaign routes with/without membership.
5. Validate `/logout` invalidates access.
6. Validate contact endpoint and inbox delivery.

## 10.2 Security QA script

1. Force invalid session cookie -> ensure deny.
2. Simulate DB error -> ensure deny.
3. Test external `next` redirect payload -> ensure blocked.
4. Confirm logs omit secrets/tokens.

## 10.3 Release sign-off criteria

All must be true:

1. SSR/request-time gating intact in campaign routes.
2. `visibility` semantics unchanged.
3. Google OAuth login/logout fully operational.
4. D1 membership governs `campaignMembers` access.
5. Mailjet verification email path operational.
6. Contact relay operational.
7. Automated test set and build pass.
8. Runbook complete and verified in staging.

---

## 11) Execution sequencing with dependencies

## Phase A — Foundation (blocking)

1. Add auth core and auth API route.
2. Add D1 repo + membership table migration.
3. Wire resolver internals to session + D1.

**Dependency:** D1 schema must exist before resolver integration testing.

## Phase B — Route integration and UX

4. Update campaign routes to consume updated resolver context.
5. Add login/logout/account pages.
6. Update restricted-state copy.

**Dependency:** auth core route must be reachable before UX validation.

## Phase C — Email and contact

7. Add email adapter and verification callbacks.
8. Add contact relay endpoint.
9. Configure Mailjet credentials and sandbox behavior in staging.

**Dependency:** email routing must be configured before end-to-end verification.

## Phase D — Hardening and release

10. Add/adjust tests.
11. Run QA scripts in staging.
12. Production deploy with rollback plan prepared.

---

## 12) Failure modes and rollback strategy

## 12.1 Expected failure classes

1. OAuth misconfiguration (redirect mismatch, invalid client secret)
2. D1 binding/migration mismatch
3. Membership table query failures
4. Email route misconfiguration

## 12.2 Immediate mitigations

- Keep local legacy map fallback behind explicit env switch in non-prod only.
- Keep campaign policy deny-by-default for protected content.
- Keep public content unaffected.

## 12.3 Rollback plan

1. Revert auth route + resolver changes to previous release tag.
2. Keep schema migrations (non-destructive) in place.
3. Re-enable local/dev membership gate fallback for emergency ops.
4. Re-deploy stable artifact.

## 12.4 Roll-forward criteria after rollback

- root cause identified
- staging reproducibility proven
- fixed build passes full sign-off checklist

---

## 13) Assumptions and open decisions

## 13.1 Assumptions (plan proceeds with these)

1. Better Auth 1.5.3 remains selected and acceptable.
2. Cloudflare D1 binding is available as `DB` in all deploy environments.
3. Google OAuth app credentials can be provisioned for local/staging/prod redirect URLs.
4. Mailjet account access and API credentials are available for local/staging/production.
5. Low traffic profile remains true in near term.

## 13.2 Open decisions to confirm before coding starts

1. Exact local/staging/production auth URLs (`BETTER_AUTH_URL` values).
2. Final contact relay destination mailbox (`CONTACT_TO_EMAIL`).
3. Whether to enable bootstrap seeding from [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json) in staging automatically or manual-only.
4. Whether `/account` is public-with-redirect or hard-protected route.
5. Minimum logging retention/observability destination policy.

---

## 14) Explicit out-of-scope for this phase

1. Discord OAuth implementation.
2. Multi-provider account linking UI.
3. Item-level ACL beyond campaign membership.
4. Campaign domain extraction/service split.

---

## 15) Definition of done (Phase 2.1)

Phase 2.1 is complete only when:

1. All sign-off criteria in section 10.3 pass.
2. Campaign route request-time gating remains intact and verified.
3. Local/staging/prod runbook steps are validated and documented.
4. [`plans/campaign-permissions-phased-enhancement-plan.md`](plans/campaign-permissions-phased-enhancement-plan.md) status is updated from “pending” to “implemented” for Phase 2.1 deliverables.

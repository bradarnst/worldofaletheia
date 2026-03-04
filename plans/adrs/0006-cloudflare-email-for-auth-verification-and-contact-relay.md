# Use Cloudflare Email Routing + Email Workers for Auth Verification and Contact Relay

## Status

- Date: 2026-03-04
- Status: Accepted
- Deciders: Brad

## Context

Phase 2.1 introduces production authentication with Better Auth + Cloudflare D1. The project also needs a minimal, production-safe email path for:

1. auth verification email delivery, and
2. low-volume contact-form message relay to inbox.

World of Aletheia is already primarily deployed on Cloudflare (`astro` server output with Cloudflare adapter and Workers/Pages deployment config). Expected email traffic is low.

Candidate options considered in planning:

- Cloudflare Email Routing + Email Workers
- Mailgun (external transactional provider)

## Decision Drivers

- Fastest low-risk launch for Phase 2.1
- Keep operational footprint small (single-platform bias)
- Minimize secrets and cross-vendor failure surfaces
- Sufficient reliability for low expected email volume
- Reuse same path for verification and contact relay
- Preserve future optionality for external provider fallback

## Considered Options

### Option 1 — Mailgun as primary email provider

Use Mailgun HTTP API for verification and contact relay.

**Pros**

- Strong dedicated transactional-email tooling
- Rich delivery analytics and suppression controls
- Mature provider ecosystem

**Cons**

- Adds external vendor + account + DNS/credential management overhead
- Cross-platform operational complexity
- Over-scoped for current low-volume needs

### Option 2 — Cloudflare Email Routing + Email Workers (Chosen)

Use Cloudflare-native email routing and worker handling for verification and contact relay flows.

**Pros**

- Aligned with existing Cloudflare-first deployment model
- Lower implementation and operational friction for MVP
- Reduced vendor sprawl and simpler secret management
- Adequate for low-volume verification + contact use case

**Cons**

- Less dedicated ESP analytics depth than Mailgun
- May require future augmentation if volume/analytics needs expand

## Decision Outcome

**Chosen option:** Option 2 — Cloudflare Email Routing + Email Workers.

Implementation policy:

1. Introduce a single project email adapter module (e.g., `src/lib/email.ts`).
2. Implement verification and contact relay through Cloudflare email path now.
3. Keep adapter seam provider-agnostic to allow future Mailgun fallback/addition without auth-route rewrites.

## Consequences

### Positive

- Lowest launch friction for Phase 2.1
- Architectural consistency with Cloudflare-centric stack
- Minimal added ops burden for low traffic

### Negative

- Less out-of-the-box transactional analytics than dedicated ESP
- Potential migration work if scale or compliance needs increase

### Neutral

- Does not change campaign authorization semantics
- Does not affect SSR request-time gating architecture

## Guardrails

1. Email send failures must never expose token contents or secrets in logs.
2. Verification send failures should fail closed for protected verification flows.
3. Campaign access checks remain request-time and independent from email infrastructure.

## Links

- Implementation Plan: `plans/phase-2-1-better-auth-google-cloudflare-email-implementation-plan.md`
- Related Plan: `plans/campaign-permissions-phased-enhancement-plan.md`
- Existing Access Policy ADR: `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`

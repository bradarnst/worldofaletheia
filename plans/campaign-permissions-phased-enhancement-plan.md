# Campaign Visibility & Access Control — Phased Enhancement Plan

## Status

- **Date:** 2026-03-02
- **Status:**
  - Phase 1 implemented (policy, schema, UI metadata, tests)
  - Phase 2 implemented as local/dev MVP gate (config+cookie membership resolver)
  - Phase 2.1 pending (Better Auth + D1 + real login UX replacement)
- **Scope:** Planning / policy alignment before implementation

## Context

World of Aletheia is currently effectively public, with build filtering implemented in [`shouldIncludeContent()`](src/utils/content-filter.ts:8) and content metadata defined in [`baseSchema`](src/content.config.ts:5).

Current intent has been refined:

1. **Canon** and **Using Aletheia** are public-by-default domains.
2. **Campaigns** need real access control for protected materials.
3. Build-time source separation is helpful for workflow but not a hard secrecy boundary.
4. Implementation should stay incremental and aligned with Astro-native/YAGNI decisions.
5. `secret` is **fully deprecated immediately** and must be ignored as an access mechanism.
6. Access control must use **one mechanism only**.

This plan translates that intent into a pragmatic, low-complexity sequence.

## Target Access Model

### Domain-level policy

- **Canon + Using Aletheia:** public by default (no hard secrecy requirement).
- **Campaigns root index / blurbs:** public.
- **Per-campaign content:** can be either public or campaign-member-gated.

### Single access mechanism: `visibility`

Use one field for access control across campaign content:

- `visibility: 'public' | 'campaignMembers'`

This replaces access semantics previously spread across overlapping concepts. `visibility` is the sole enforcement input for authz decisions.

### Campaign visibility levels (MVP)

- `public`
- `campaignMembers`

Optional future level (deferred):

- additional scoped values (for example `campaignLeads` or `inviteOnly`) only when concrete product need appears

### Non-security discoverability metadata

GM-oriented labeling is **metadata only** and not authorization:

- Suggested metadata tags: `gm`, `gm-data`, `gm-info`
- Use for filtering/discovery UX only
- Never used by auth checks

## Phase Plan

### Phase 1 — Policy Shift (documentation + conventions)

Goal: align current policy without overhauling architecture.

- Document that campaign auth is the first enforced protection boundary.
- Clarify that non-campaign domains are public-by-default.
- Deprecate `secret` completely and ignore it for access decisions.
- Define `visibility` as the single access-control input.
- Clarify GM labels are discoverability metadata, not a protection layer.

Implementation note (2026-03-04): completed in code/docs.

### Phase 2 — Campaign Auth MVP (authentication + membership gate)

Goal: deployed-but-gated campaign experience.

- Add Better Auth-based login/session.
- Add campaign membership store (`user ↔ campaign ↔ role`).
- Enforce membership checks on protected campaign routes.
- Keep campaign root pages public.

MVP authorization rule:

- `public` campaign entries: visible to all
- `campaignMembers` entries: authenticated campaign members only

Implementation note (2026-03-04): local/dev MVP gate completed with config+cookie resolver and campaign-route enforcement.

Delivered in Phase 2:

- campaign-only resolver module and policy gate in [`canViewCampaignContent()`](src/utils/campaign-access.ts:71)
- membership resolver seam in [`createCampaignAccessResolver()`](src/utils/campaign-access.ts:83)
- route enforcement on:
  - [`src/pages/campaigns/[...slug].astro`](src/pages/campaigns/[...slug].astro)
  - [`src/pages/campaigns/[campaign]/sessions/index.astro`](src/pages/campaigns/[campaign]/sessions/index.astro)
  - [`src/pages/campaigns/[campaign]/sessions/[...slug].astro`](src/pages/campaigns/[campaign]/sessions/[...slug].astro)
- local/dev operational doc in [`docs/runbook/campaign-access-local-dev.md`](docs/runbook/campaign-access-local-dev.md)

### Phase 2.1 — Better Auth + D1 Replacement (next)

Goal: replace temporary local/dev gate internals with production-grade auth/session/membership while preserving current route authorization call sites.

Planned replacement scope:

- integrate Better Auth session handling
- persist campaign membership in Cloudflare D1
- implement login/logout/session UX and flow
- replace env/cookie-map resolver internals behind [`createCampaignAccessResolver()`](src/utils/campaign-access.ts:83)
- keep `visibility` authorization semantics unchanged (`public` vs `campaignMembers`)

Deferred from Phase 2 to 2.1:

- Better Auth wiring
- D1 persistence
- real login UI/UX
- OAuth/provider flows

### Phase 3 — Discoverability metadata UX (optional near-term)

Goal: improve browsing/discovery without changing security behavior.

- Introduce UI affordances for metadata tags (`gm`, `gm-data`, `gm-info`).
- Add optional filters/chips for readers who want GM-oriented content.
- Keep all GM-oriented content viewable according to `visibility`, not tag value.

### Phase 4 — Item-level ACL (optional, deferred)

Goal: selective sharing per entry/user.

- Introduce per-user allow/deny behavior only when operational tooling exists.
- Build/admin UX becomes prerequisite (GM dashboard or equivalent).

### Phase 5 — Commercialization-ready boundary (future, not required now)

Goal: keep migration path open without building platform complexity today.

- Keep campaign slug and membership model as proto-tenant boundary.
- If needed later, extract Campaigns access logic behind API/service boundary.
- Preserve Obsidian-first authoring and current content contracts to avoid migration churn.

## Implementation Guardrails

1. Keep Astro-native content access for reads (consistent with ADR-0004).
2. Avoid introducing repositories/services/contracts until concrete triggers are met.
3. Do not require deploy-time multi-build orchestration for MVP campaign gating.
4. Treat source-vault separation as workflow organization, not cryptographic secrecy.
5. Do not use role labels (GM/player) as authorization controls.

## MVP Definition of Done

1. Public campaign index pages remain public.
2. Protected campaign entries are deployed but inaccessible without auth + membership.
3. Non-campaign domains remain public-by-default.
4. `secret` is documented as deprecated/ignored.
5. `visibility` is documented as the single access-control mechanism.
6. Policy docs and TODOs reflect this as the active direction.

## Deferred Work (explicit)

- GM metadata filters in Canon/Using are discoverability-only and deferred.
- Per-user item-level ACL is deferred.
- Full campaign-domain extraction is deferred.

## Related References

- [`AGENTS.md`](AGENTS.md)
- [`plans/adrs/0001-obsidian-first-content-architecture.md`](plans/adrs/0001-obsidian-first-content-architecture.md)
- [`plans/adrs/0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)
- [`plans/content-publishing-system.md`](plans/content-publishing-system.md)
- [`plans/draft-visibility-follow-up-todo.md`](plans/draft-visibility-follow-up-todo.md)

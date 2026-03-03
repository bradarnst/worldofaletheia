# Campaign Permissions & Access Control — Phased Enhancement Plan

## Status

- **Date:** 2026-03-02
- **Status:** Proposed
- **Scope:** Planning / policy alignment before implementation

## Context

World of Aletheia is currently effectively public, with metadata fields already present for access intent:

- `secret` and `permissions` in [`src/content.config.ts`](src/content.config.ts)
- environment/status filtering behavior in [`src/utils/content-filter.ts`](src/utils/content-filter.ts)

Current intent has been refined:

1. **Canon** and **Using Aletheia** are public-by-default domains.
2. **Campaigns** need real access control for protected materials.
3. Build-time source separation is helpful for workflow but not a hard secrecy boundary.
4. Implementation should stay incremental and aligned with Astro-native/YAGNI decisions.

This plan translates that intent into a pragmatic, low-complexity sequence.

## Target Access Model

### Domain-level policy

- **Canon + Using Aletheia:** public by default (no hard secrecy requirement).
- **Campaigns root index / blurbs:** public.
- **Per-campaign content:** can be either public or campaign-member-gated.

### Campaign visibility levels (MVP)

- `public`
- `campaignMembers`

Optional future level (deferred):

- per-user item-level overrides (requires dashboard/admin tooling)

## Phase Plan

### Phase 1 — Policy Shift (documentation + conventions)

Goal: align current policy without overhauling architecture.

- Document that campaign auth is the first enforced protection boundary.
- Clarify that non-campaign domains are public-by-default.
- De-emphasize `secret` as a primary mechanism for main-site protection.
- Keep current schema stable while policy is updated.

### Phase 2 — Campaign Auth MVP (authentication + membership gate)

Goal: deployed-but-gated campaign experience.

- Add Better Auth-based login/session.
- Add campaign membership store (`user ↔ campaign ↔ role`).
- Enforce membership checks on protected campaign routes.
- Keep campaign root pages public.

MVP authorization rule:

- `public` campaign entries: visible to all
- `campaignMembers` entries: authenticated campaign members only

### Phase 3 — Role-aware permissions (optional near-term)

Goal: support GM vs player in campaigns where needed.

- Enforce role thresholds (`player`, `gm`, `author`) within campaign scope.
- Reuse existing `permissions` metadata before adding new schema complexity.

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

## MVP Definition of Done

1. Public campaign index pages remain public.
2. Protected campaign entries are deployed but inaccessible without auth + membership.
3. Non-campaign domains remain public-by-default.
4. Policy docs and TODOs reflect this as the active direction.

## Deferred Work (explicit)

- GM-only filtering in Canon/Using (honor-system metadata only) is deferred.
- Per-user item-level ACL is deferred.
- Full campaign-domain extraction is deferred.

## Related References

- [`AGENTS.md`](AGENTS.md)
- [`plans/adrs/0001-obsidian-first-content-architecture.md`](plans/adrs/0001-obsidian-first-content-architecture.md)
- [`plans/adrs/0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)
- [`plans/content-publishing-system.md`](plans/content-publishing-system.md)
- [`plans/draft-visibility-follow-up-todo.md`](plans/draft-visibility-follow-up-todo.md)


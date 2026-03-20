# Discovery and Search Strategy: D1 Metadata Index First, FTS Next

## Status

- **Date:** 2026-03-20
- **Status:** Accepted
- **Deciders:** Brad

## Context

Collection volume is growing and current listing patterns are nearing practical limits for usability and discovery.
Pagination by itself will slightly improve the UX, but will not solve content findability. The project requires:

1. display-by-type, subtype and tag,
2. scalable list retrieval,
3. near-term search capability,
4. authorization-safe behavior for campaign-protected content.

Existing relevant direction:

- `plans/adrs/0008-systems-taxonomy-type-subtype-model.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/campaign-permissions-phased-enhancement-plan.md`
- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`

## Decision Drivers

- Improve content discoverability without waiting for full-text implementation.
- Keep access control semantics intact for protected content.
- Avoid over-engineering while article volume continues to increase.
- Support phased rollout with visible product value in each phase.

## Considered Options

### Option 1: Pagination only on collection pages

**Pros**

- Fastest UI-only change.

**Cons**

- Does not address logical grouping and discovery intent.
- Does not provide search.

### Option 2: Client-only search/index artifacts

**Pros**

- Potentially low backend query cost.

**Cons**

- Harder to enforce protected-content filtering with confidence.
- Adds bundle/index distribution complexity.

### Option 3: D1 metadata index first, then D1 FTS (Chosen)

**Pros**

- Delivers immediate display-by-type/subtype and scalable listing.
- Keeps auth-aware filtering in one query layer.
- Enables phased search rollout with lower risk.

**Cons**

- Requires index ingestion path and schema/version maintenance.

## Decision Outcome

**Chosen option:** Option 3 - D1 metadata index now, FTS next phase.

### Policy

1. Introduce and maintain a canonical D1 metadata index for content discovery.
2. Use metadata index as the retrieval surface for list pages, filters, grouping, and pagination.
3. Add full-text search as a second phase after metadata index stability and parity checks.
4. Apply authorization and visibility constraints in query layer before response shaping.
5. Keep markdown body/content rendering source unchanged (R2/local source mode reader path).

### Phase Boundaries

- **Phase A (must):** metadata index + type/subtype listing + pagination.
- **Phase B (should):** query API for site search over metadata and titles.
- **Phase C (soon after):** FTS for deeper body-text search.

## Consequences

### Positive

- Immediate usability improvement for high-volume collections.
- Clear foundation for search without blocking on full-text complexity.
- Better consistency between taxonomy model and retrieval model.

### Negative

- Additional ingestion responsibilities and index drift risk.
- Requires operational checks for index freshness.

### Neutral

- Does not force campaign service extraction now.
- Does not require framework change beyond current Astro-first policy.

## Acceptance Criteria

1. Collection discovery pages can group/filter by `type` and optional `subtype` from D1 index.
2. Pagination works on indexed list retrieval paths.
3. Protected campaign content never leaks through index-backed retrieval.
4. Search phase work can start without redesigning Phase A contracts.

## Links

- `plans/adrs/0008-systems-taxonomy-type-subtype-model.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`

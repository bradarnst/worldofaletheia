# Content Producer Extraction: Dedicated Repository with Staged Cutover

## Status

- **Date:** 2026-03-20
- **Status:** Accepted
- **Deciders:** Brad

## Context

The content producer workflow (Obsidian/Git sync, manifest generation, cloud publishing) already has different cadence and ownership pressure than website feature delivery.

Observed operational reality:

- Site work is paused to maintain sync/managed data correctness.
- Producer and consumer concerns already diverge in priorities and release rhythm.
- Cloud-backed runtime direction is active.

The project needs a clear extraction strategy that avoids accidental split complexity while preserving current feature momentum.

## Decision Drivers

- Separate release cadence and ownership are already present.
- Producer logic has broader reuse potential beyond one site.
- Keep current user-facing priorities (calendar + discovery/search) unblocked.
- Avoid transitional churn by not half-migrating producer runtime inside the site app.

## Considered Options

### Option 1: Keep producer in current repo indefinitely

**Pros**

- No immediate migration work.

**Cons**

- Continued cadence conflict and priority collision.
- Reuse across other projects remains awkward.

### Option 2: Immediate full extraction now

**Pros**

- Fastest separation of responsibilities.

**Cons**

- Competes directly with near-term product priorities.
- Higher transition risk while discovery/search work is in-flight.

### Option 3: Commit to extraction now, execute staged cutover (Chosen)

**Pros**

- Resolves architecture direction immediately.
- Preserves focus on current user-facing roadmap.
- Reduces migration risk with contract-first approach.

**Cons**

- Temporary period of known in-repo producer operation remains.

## Decision Outcome

**Chosen option:** Option 3 - extraction is committed now, implemented in staged cutover.

### Policy

1. The content producer becomes a dedicated repository.
2. First execution target is GitHub Actions in producer repo.
3. Worker-first ingestion runtime is optional follow-on, not required for initial extraction.
4. Site app remains content consumer (R2 + manifests + index) and does not own producer orchestration long-term.
5. Schema authority stays in current repo during transition; promote to shared contracts package only when at least two active consumers require it.

### Split Trigger Interpretation

Extraction is approved because the following triggers are treated as met:

- independent cadence,
- ownership divergence,
- broad reuse potential,
- operationally distinct producer concern set.

## Consequences

### Positive

- Cleaner producer/consumer boundary.
- Better focus for site feature delivery.
- Reusable producer workflow for additional projects.

### Negative

- Requires migration planning and dual-repo coordination.
- Temporary schema-governance discipline needed during transition.

### Neutral

- Does not force campaign app/service extraction in this phase.
- Does not change existing route IA and domain model.

## Acceptance Criteria

1. Producer extraction decision is explicit and no longer open-ended.
2. Near-term feature roadmap remains prioritized before cutover implementation.
3. Cutover plan includes contract ownership, CI gates, and rollback path.
4. Post-cutover site app no longer executes producer orchestration as primary flow.

## Links

- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`
- `plans/content-sync-workflow-plan.md`
- `plans/adrs/0010-global-content-source-mode-cloud-default.md`
- `plans/adrs/0011-discovery-navigation-and-search-index-strategy.md`

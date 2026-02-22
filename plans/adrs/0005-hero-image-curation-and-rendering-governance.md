# Hero Image Strategy: Manual Curation and Shared Rendering Governance

## Status

- **Date:** 2026-02-22
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

Hero images are a high-impact UX surface across homepage and collection pages. Recent issues showed inconsistent behavior caused by:

- shared-header mismatch across domains,
- stale/hot-reload nondeterminism masking visual changes,
- route-conditional behavior checks,
- potential metadata and slug-to-image mapping drift,
- CSS suppression/layering risks.

The project currently uses Astro image optimization with `RandomHeroImage -> HeroImage -> <Picture>`. The active hero pool is intentionally small and manually curated, with low update frequency.

We need a strategy that prioritizes readability, visual quality, and low maintenance while preserving deterministic behavior across World and Using layouts.

## Decision Drivers

- **Low maintenance cost** for infrequent hero updates
- **Deterministic behavior** across routes and domains
- **Readability and accessibility** without heavy global darkening
- **Visual fidelity** for premium hero artwork
- **Operational simplicity** over speculative automation
- **Consistency with existing Astro component architecture**

## Considered Options

### Option 1: Fully Random Hero Selection

Large or loosely controlled random pool with no strict curation governance.

**Pros**
- Minimal editorial effort per change
- High visual variety

**Cons**
- Readability variance increases
- Unpredictable quality outcomes
- Higher regression risk from outlier assets

### Option 2: Hybrid Curated-Plus-Random

Curated pool with randomized rotation within approved assets and optional per-section subsets.

**Pros**
- Balance of variety and control
- Maintains current component shape
- Low implementation overhead

**Cons**
- Requires governance discipline to keep pool clean
- Still sensitive to cache/test protocol quality

### Option 3: Fully Curated Static Mapping (Chosen)

Manual curated pool with deterministic assignment policy per scope (site hero + optional section subsets), minimal/no runtime randomness for critical pages.

**Pros**
- Highest predictability and readability control
- Lowest long-term maintenance for current scale
- Easier validation and rollback

**Cons**
- Reduced variability
- Requires occasional editorial refresh to avoid repetition

## Decision Outcome

**Chosen option:** Option 3 — Fully curated strategy with deterministic governance, while retaining compatibility with existing `RandomHeroImage` component path.

### Policy

1. Keep hero rendering centralized through:
   - `src/components/RandomHeroImage.astro`
   - `src/components/HeroImage.astro`
   - Astro `<Picture>` rendering in hero component
2. Treat hero image set as a curated, approved asset list.
3. Prefer deterministic assignment for primary surfaces; section-specific subsets are allowed.
4. Do not introduce separate in-house chooser tooling unless maintenance ROI is proven.
5. Keep overlay behavior neutral by default; preserve readability via curated assets + controlled text treatment.

## Operational Curation Workflow

### Ownership

- Primary owner: Brad
- Secondary reviewer (optional): Barry

### Workflow Steps

1. Propose candidate image(s) into approved pool.
2. Validate readability on route + theme matrix (`/`, `/flora`, `/factions`, `/meta`, `/systems` minimum).
3. Validate with hard refresh + cache disabled to avoid stale-state false signals.
4. Remove/replace outlier images that require heavy corrective treatment.
5. Record curation change in commit message and release notes.

### Governance Rules

- Hero pool remains intentionally small.
- New image acceptance requires successful readability checks in text zone at mobile + desktop.
- Avoid strong theme tinting unless explicit UX gain is demonstrated.

## Migration from Current RandomHeroImage Usage

Migration is incremental and non-breaking:

1. Keep `RandomHeroImage` as rendering entry point.
2. Restrict pool to approved curated assets.
3. Move toward deterministic assignment by route/section as needed.
4. Preserve shared header invocation in both World and Using headers.

No immediate component replacement is required.

## Caching Expectations

- UI validation must include cache-bypass checks (`Ctrl+Shift+R` + DevTools Disable Cache).
- Hot-reload output cannot be the sole source of truth for visual regression decisions.

## Validation Requirements

### Required Checks per Change

1. `pnpm build` passes.
2. Shared header parity remains intact in:
   - `src/components/WorldAletheiaHeader.astro`
   - `src/components/UsingAletheiaHeader.astro`
3. Hero renders through `RandomHeroImage -> HeroImage -> <Picture>` path.
4. Readability and visual quality pass route + theme matrix checks.

### Acceptance Criteria

- 100% of target routes show hero via shared pipeline.
- No route requires heavy global dark overlay to maintain readability.
- No approved outlier image causes recurring readability regressions.

## Consequences

### Positive

- Lower maintenance burden aligned with project cadence
- Predictable hero UX and easier QA
- Strong architectural consistency with shared layouts/headers

### Negative

- Less visual variability than broad random strategies
- Requires occasional manual curation updates

### Neutral

- Existing component architecture remains intact
- Future tooling can still be added if proven necessary

## Links

- Related ADR: `plans/adrs/0003-astro-image-component-policy.md`
- Related ADR: `plans/adrs/0002-homepage-story-first-pattern-a.md`
- Related Plan: `plans/frontend-ui-ux-stabilization-plan-2026-02.md`
- Related Plan: `plans/frontend-ui-ux-hardening-phase-plan-2026-q1.md`


# Campaign Domain Collection Taxonomy Refactor

## Status

- **Date:** 2026-03-24
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

Campaigns are already established as a separate domain from Canon and Using Aletheia, but the current content model primarily uses `campaigns` and `sessions` collections, with additional campaign content semantics pushed into folder conventions and `type` values.

This creates a taxonomy mismatch:

- Canon uses collection-level families (`lore`, `places`, `factions`, etc.) where `type` and `subtype` express domain-specific classification.
- Campaign content is trending toward additional families (`lore`, `scenes`, `adventures`, `characters`, `hooks`), but these are not first-class collection boundaries yet.
- As campaign content volume increases, overloading `type` to represent content family risks drift and inconsistent discovery semantics.

Timing context:

- Campaign content is active now (exploratory) and expected to accelerate in the next 6-8 weeks.
- Current near-term priorities remain Discovery Gate G1/G2 closure and campaign media variant pipeline completion.
- Delaying taxonomy correction until after expansion likely multiplies migration cost across schemas, routes, sync/index logic, and content authoring patterns.

This ADR defines the target taxonomy direction now, while sequencing implementation after current top-priority stabilization work.

## Decision Drivers

- Keep campaign taxonomy consistent with existing collection/type/subtype model used elsewhere.
- Preserve Astro-native architecture and avoid speculative service/repository abstractions (ADR-0004).
- Reduce migration churn before campaign content families expand materially.
- Improve long-term extraction readiness for Campaigns domain.
- Keep authorization and visibility semantics stable during taxonomy change.
- Avoid unnecessary database churn unless concrete schema pressure appears.

## Considered Options

### Option 1: Keep current `campaigns` + `sessions` model and encode new families in `type`

Add new campaign content kinds (scenes/adventures/characters/hooks) under existing collection structure and rely on `type`/path conventions.

**Pros**

- Lowest immediate implementation effort.
- No near-term route/schema restructuring.

**Cons**

- Continues taxonomy mismatch vs Canon/Using model.
- Increases semantic overload of `type`.
- Raises future migration cost as campaign content scales.

### Option 2: Campaign-domain collections by content family, keyed by campaign slug (Chosen)

Introduce explicit campaign content-family collections for the canon and using layers (`campaignLore`, `campaignPlaces`, `campaignSentients`, `campaignBestiary`, `campaignFlora`, `campaignFactions`, `campaignSystems`, `campaignMeta`) plus campaign-specific families (`campaignCharacters`, `campaignScenes`, `campaignAdventures`, `campaignHooks`), while preserving `campaign` slug linkage and Campaigns-domain route gating.

**Pros**

- Restores clean collection-level meaning for campaign content families.
- Keeps `type`/`subtype` semantics aligned across domains.
- Supports phased schema divergence later without forcing immediate divergence.
- Improves extraction readiness by clarifying campaign domain contracts.

**Cons**

- Requires one-time migration across schema, routes, sync/index logic, and content docs.
- Needs careful transition plan to avoid temporary content/index drift.

### Option 3: Define separate collections per campaign instance

Create per-campaign collection sets (for example `barryLore`, `bradLore`, etc.) and expand as campaigns are added.

**Pros**

- Strong isolation between campaign instances.
- Direct mapping to campaign ownership boundaries.

**Cons**

- High schema/config churn as campaigns are added.
- Poor scalability for long-running campaign growth.
- Adds avoidable complexity without clear product benefit.

### Option 4: Full Campaigns app/service extraction now

Defer taxonomy changes in current repo and perform immediate campaign domain extraction into a separate app/service.

**Pros**

- Strongest long-term isolation boundary.

**Cons**

- Competes with current priority stabilization work.
- Higher immediate delivery risk than required for present scope.

## Decision Outcome

**Chosen option:** Option 2 - campaign-domain collections by content family, keyed by campaign slug.

### Policy

1. Campaign content families become explicit collections instead of being inferred primarily from `type` and folder structure.
2. Campaign slug remains the foreign-key identity axis across campaign-domain collections.
3. Initial schema parity with canonical equivalents is allowed (for example `campaignLore` mirrors `lore` initially), with explicit room for future divergence.
4. Campaign routes remain under `/campaigns/**` and continue SSR/fail-closed access behavior where required.
5. No new service/adapter/contract abstraction layers are introduced by this decision unless ADR-0004 triggers are concretely met.
6. D1 table changes are not required by default; database schema change is only introduced if a concrete query/index requirement emerges.
7. Campaign identity consistency is deferred follow-on work: current implementation mixes campaign overview path identity (`<campaign-slug>/index.md`) with explicit `campaign` slug foreign keys on nested campaign-family/session entries; avoid adding duplicated `campaignName` metadata during transition.

### Sequencing and Adoption Gate

1. ADR was recorded as **Proposed** on 2026-03-24.
2. Implementation kicked off on 2026-03-25 with collection schema, routing, and sync/index changes in this repository.
3. Follow-on migration work remains bounded to content movement and authoring/runbook updates as campaign families are populated.

### Expected Implementation Surface (non-exhaustive)

- `src/content.config.ts` collection/schema updates.
- `src/pages/campaigns/**` route updates for new campaign-family collections.
- `scripts/content-sync/manifests.mjs` and related sync/index writer updates.
- Discovery/index contract updates for campaign-family collections.
- Runbook and content-authoring documentation updates.

### Consequences

#### Positive

- Campaign taxonomy aligns with project-wide collection semantics.
- Discovery/filter/group behavior becomes more consistent across domains.
- Lower long-term churn before campaign content expansion.
- Clearer extraction seam for Campaigns domain evolution.

#### Negative

- One-time migration effort and temporary coordination overhead.
- Requires careful rollout controls to avoid index/content mismatch during transition.

#### Neutral

- Does not change Obsidian-first source-of-truth model (ADR-0001).
- Does not alter homepage/story-first IA policy (ADR-0002).
- Does not change image rendering policy (ADR-0003).
- Does not require immediate DB schema migration.

## Links

- `docs/status-report-2026-03-24.md`
- `docs/status-report-addendum-campaign-model-2026-03-24.md`
- `plans/adrs/0001-obsidian-first-content-architecture.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/adrs/0011-discovery-navigation-and-search-index-strategy.md`
- `plans/adrs/0012-content-producer-extraction-strategy.md`

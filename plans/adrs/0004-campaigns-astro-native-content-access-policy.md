# Campaigns Data Access Policy: Astro-Native Content Collections First

## Status

- **Date:** 2026-02-12
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

Campaign and session content is authored as markdown in nested folders under `src/content/campaigns/**` and rendered through Astro routes.

An earlier Phase 2.1 direction proposed additional abstraction layers such as repository interfaces, query services, adapters, and standalone DTO contracts for Campaigns reads.

For this project, those layers increased conceptual and maintenance overhead without solving an active problem.

We need a clear policy that preserves Astro simplicity while keeping room for future evolution if real complexity appears.

## Decision Drivers

- **Simplicity first**: keep code close to Astro primitives and file structure
- **Low maintenance cost**: avoid speculative abstractions
- **Clarity for contributors**: straightforward content and route mapping
- **Build-time reliability**: static-first route generation from content collections
- **YAGNI discipline**: add complexity only when concrete pain appears

## Considered Options

### Option 1: Repository and query-service layering by default

Use `CampaignRepository`, `SessionRepository`, and `CampaignQueryService` as mandatory access boundaries.

**Pros**
- Centralized read logic
- Future seam for alternative backends

**Cons**
- Over-engineering for current static markdown use case
- Extra files and concepts for no immediate runtime benefit
- More indirection for contributors

### Option 2: Astro-native direct access in routes (Chosen)

Use Astro content APIs directly in Campaign routes.

**Pros**
- Minimal, explicit, and easy to reason about
- Leverages Astro schema validation in `src/content.config.ts`
- Fewer moving parts and lower cognitive load

**Cons**
- Some query logic may duplicate across routes over time
- If complexity grows later, refactor may be needed

### Option 3: Thin hybrid seam

Keep a single query facade but no full repository stack.

**Pros**
- Moderate centralization with less overhead than full layering

**Cons**
- Still introduces indirection before it is needed

## Decision Outcome

**Chosen option:** Option 2 - Astro-native direct content access.

### Policy

1. Campaign routes use Astro APIs directly: `getCollection`, `getEntry`, and `render`.
2. Campaign and session shape validation is handled by Astro collection schemas in `src/content.config.ts`.
3. Do not introduce repositories, query services, adapters, or standalone contracts for Campaign reads by default.
4. Keep `src/services/`, `src/adapters/`, and `src/contracts/` minimal or empty unless a concrete trigger occurs.

### Triggers for Reintroducing Abstractions

Introduce a shared service or contract layer only when at least one of the following is true:

- Same query/business logic is duplicated in 3+ places
- Runtime authorization rules become materially complex and repeated
- A real external API boundary is introduced with versioned wire contracts
- A second active data source is introduced in the same app

## Consequences

### Positive

- Faster iteration and simpler code paths
- Better alignment with Astro conventions
- Lower architectural overhead for the current problem size

### Negative

- Future refactor may be required if complexity grows significantly
- Local route files may carry small amounts of repeated query logic

### Neutral

- Future API endpoints remain possible using Astro content collections directly
- Auth can still be added without repository abstractions

## Implementation Notes

- Campaign pages now read directly from Astro content collections.
- Placeholder layer roots remain intentionally minimal:
  - `src/services/index.ts`
  - `src/adapters/index.ts`
  - `src/contracts/index.ts`
- The Campaign checklist has been updated to reflect this policy.

## Links

- Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
- Related checklist: [campaigns-architecture-implementation-checklist.md](plans/campaigns-architecture-implementation-checklist.md)
- Related ADR: [0001-obsidian-first-content-architecture.md](plans/adrs/0001-obsidian-first-content-architecture.md)

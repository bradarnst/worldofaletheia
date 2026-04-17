---
title: Campaign ID Parsing Hardening
dateAdded: 2026-04-10
status: complete
priority: medium
relatedFiles:
  - src/utils/campaign-collections.ts
  - src/pages/campaigns/index.astro
  - src/pages/campaigns/[...slug].astro
  - src/pages/campaigns/[campaign]/sessions/index.astro
  - src/pages/campaigns/[campaign]/sessions/[...slug].astro
  - src/pages/campaigns/[campaign]/[family]/index.astro
  - src/pages/campaigns/[campaign]/[family]/[...slug].astro
  - src/pages/index.astro
  - scripts/content-sync/cloud-content-metadata.mjs
  - scripts/content-sync/cloud-content-metadata.test.mjs
---

# Campaign ID Parsing Hardening

> Completion note (2026-04-17): Shared helper-based parsing is now in place across the campaign session routes and sitemap, and regression coverage was expanded for current and legacy ID shapes. This todo remains as historical traceability for the original production follow-up.

## Historical context

A production issue on 2026-04-10 showed that campaign pages were assuming an older campaign entry id shape than the one produced by the cloud content pipeline.

- Cloud-backed campaign ids currently look like `barry/index` and `barry/lore/omens`.
- Older route logic often assumed ids were prefixed like `campaigns/barry/...` or directly pulled `parts[1]` after `id.split('/')`.
- That mismatch caused campaign discovery and campaign record surfaces to resolve the wrong slug even though R2 objects and D1 index rows were present.

The immediate production fix centralized slug extraction in `extractCampaignSlugFromEntryId()` and updated the affected session/list routes. That fixed the outage, but the broader parsing contract is still implicit and scattered.

## Original problem statement

Campaign-domain ids, slugs, and hrefs should be treated as a shared contract instead of ad hoc string parsing in individual pages.

Today, the codebase still mixes:

- direct `id.split('/')` parsing
- legacy assumptions about `campaigns/{slug}/...`
- newer cloud-backed ids like `{slug}/index`
- route-specific leaf slug extraction

This is manageable now, but it is fragile and easy to break during future sync-pipeline or routing changes.

## Original desired outcome

Create one small, well-tested parsing layer for campaign-domain content ids and make campaign routes consume that layer consistently.

## Original suggested scope

1. Audit campaign-domain files for direct `id.split('/')` usage and classify each call site as:
   - campaign slug extraction
   - family slug extraction
   - session slug extraction
   - href generation
2. Extend `src/utils/campaign-collections.ts` with explicit helpers for each supported case instead of route-local parsing.
3. Update campaign pages and campaign-related discovery surfaces to use those helpers consistently.
4. Add tests covering both current cloud ids and legacy-prefixed ids where backward compatibility is still expected.
5. Verify sitemap and homepage campaign discovery URLs still resolve correctly.

## Original good starting points

- Shared parser: `src/utils/campaign-collections.ts`
- Production fix regression: `src/utils/campaign-collections.test.ts`
- Cloud id producer: `scripts/content-sync/cloud-content-metadata.mjs`
- Cloud id expectations: `scripts/content-sync/cloud-content-metadata.test.mjs`
- Campaign route surfaces:
  - `src/pages/campaigns/index.astro`
  - `src/pages/campaigns/[...slug].astro`
  - `src/pages/campaigns/[campaign]/sessions/index.astro`
  - `src/pages/campaigns/[campaign]/sessions/[...slug].astro`
  - `src/pages/campaigns/[campaign]/[family]/index.astro`
  - `src/pages/campaigns/[campaign]/[family]/[...slug].astro`
- Secondary consumer to re-check: `src/pages/index.astro`

## Original acceptance criteria

- No campaign-domain route relies on a route-local assumption about which path segment holds the campaign slug.
- Shared helpers clearly document supported id shapes.
- Tests cover at least:
  - `campaigns/{slug}/...`
  - `{slug}/index`
  - `{slug}/sessions/{sessionSlug}`
  - `{slug}/{family}/{entrySlug}`
- Homepage and sitemap campaign links still point to valid campaign URLs.

## Original non-goals

- Do not redesign the content sync pipeline.
- Do not change collection schemas unless the parsing audit proves it is necessary.
- Do not expand into a larger campaign architecture refactor.

## Priority guidance at time of creation

Do this the next time campaign routing, cloud content ids, sitemap generation, or campaign discovery code is touched. It is not an immediate blocker now that the production fix is in place.

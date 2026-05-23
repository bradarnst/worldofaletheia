---
title: Future Related Resource Enrichment and Spell Discovery
dateAdded: 2026-04-27
status: Open
priority: Low
relatedFiles:
  - plans/adrs/0011-discovery-navigation-and-search-index-strategy.md
  - plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md
  - plans/features/site-wide-search-architecture-and-fts5-delivery-plan-2026-04-17.md
  - src/pages/systems/gurps/index.astro
  - src/pages/systems/gurps/resources/index.astro
  - src/pages/systems/gurps/resources/sorcerer-spells/index.astro
  - src/data/spells/spells-raw.json
  - src/lib/content-index-repo.ts
  - scripts/generate-spell-data.mjs
---

# Future Related Resource Enrichment and Spell Discovery

## Why

High-utility resources such as the Sorcerer Spells browser are valuable once users find them, but they currently rely mostly on direct navigation into `/systems/gurps/resources/**`, manual bookmarking, or prior familiarity with the site structure.

That is acceptable in the current smaller site, but it will become harder to maintain and harder to discover as the number of articles grows.

At the same time, the long-term direction should avoid two failure modes:

- manually maintaining per-article related-resource links forever
- re-analyzing the entire site body on every build once content volume becomes large

The project already has a D1-first discovery/search direction under ADR-0011, and the current Sorcerer Spells dataset is already large enough to justify thinking ahead about a more reusable discovery layer.

## Deferred requirement

Introduce a future **related-resource enrichment** capability that can infer and surface high-utility links for relevant articles without requiring manual per-article maintenance.

The eventual target shape should support all of the following:

- a curated registry of promotable resources (for example Sorcerer Spells)
- article-to-resource matching based on subject matter and/or curated keyword/topic rules
- changed-only or incremental re-analysis rather than whole-site re-analysis every time
- a generated lookup artifact that pages can read cheaply at build/render time
- future convergence with D1-backed search/discovery infrastructure

## Preferred end state

The preferred long-term model is:

1. **Curated resource registry**
   - one canonical place defines resource ids, labels, routes, and optional matching hints
   - route changes are updated once in the registry instead of many content files

2. **Incremental enrichment/indexing phase**
   - runs before build, or between build and deploy if the deployment pipeline later evolves that way
   - re-analyzes only changed/new articles using content hash, source etag, or equivalent freshness metadata
   - writes a derived article-to-resource mapping artifact

3. **Build consumes the artifact**
   - Astro pages render promoted/related resources by reading the derived mapping
   - page rendering stays cheap and deterministic

4. **Later search/discovery integration for highest-value resources**
   - for maximum flexibility, Sorcerer Spells may eventually participate in richer search/discovery infrastructure through an approved API or data artifact boundary
   - richer spell FTS, spell CRUD, and spell-admin ownership are expected to live outside this repo per ADR-0021, while this site remains responsible for consuming and rendering the resulting public discovery surfaces

## Why not solve this with manual frontmatter alone

Manual frontmatter can be useful for early UX testing, but it is not the preferred long-term operating model for a large site because:

- it creates distributed maintenance burden
- resource route/name changes require broad content edits
- editorial consistency becomes harder as article count grows
- it does not address incremental re-analysis concerns

## Acceptable rollout path

This does **not** need to ship as one large feature. A phased rollout is acceptable and probably preferable.

### Phase 0 — Manual UX probe

Use a small amount of manual linking/frontmatter only to test UI/UX patterns such as:

- promoted resource blocks on `src/pages/systems/gurps/index.astro`
- promoted resource blocks on `src/pages/systems/gurps/resources/index.astro`
- simple related-resource callouts on a few selected GURPS pages

Goal:

- validate whether users actually benefit from the surface pattern before investing in automation

### Phase 1 — Resource registry + generated mapping artifact

Add a curated registry of promotable resources and a generated article-resource mapping artifact.

Initial matching may be deterministic and lightweight:

- collection/type/subtype-based rules
- curated keyword/topic rules
- selected title/summary/body heuristics

Important:

- do not require full semantic/AI analysis in the first version
- do not require whole-site re-analysis on every build if a changed-only path is feasible

### Phase 2 — Incremental enrichment workflow

Add a distinct enrichment/indexing step to the pipeline so the build consumes prepared data rather than doing broad article analysis inline.

Possible trigger models:

- content hash cache
- source etag / last-modified tracking
- sync-time changed-file list

### Phase 3 — External spell search/discovery integration

For best long-term value and flexibility, include spells in richer discovery/search infrastructure through an external spell authority and a public consumption boundary.

That should enable:

- title/metadata search over spell rows or API-backed equivalents
- later FTS participation for spell descriptions/statistics through an external search-capable source
- tighter integration with promoted-resource logic and future analytics
- stronger parity with ADR-0011's discovery/search direction without moving spell admin authority into this repo

## Constraints

- Do not redesign the overall site information architecture for this alone.
- Keep homepage story-first constraints from ADR-0002 intact.
- Prefer static/build-friendly rendering even if enrichment happens in a new pre-build or between-build-and-deploy phase.
- Avoid speculative service/adapter abstractions unless concrete duplication or external-boundary triggers emerge.
- Keep related-resource enrichment owned in this repo even if spell CRUD/search authority lives elsewhere.
- Treat spell admin, CRUD, and richer spell FTS as external-project concerns unless a later ADR changes that boundary.

## Success criteria

- High-utility resources can be surfaced without manually editing large numbers of articles.
- The system can avoid whole-site re-analysis on every routine build.
- Resource route changes are centralized in a registry or equivalent single source of truth.
- The Sorcerer Spells resource can eventually participate in richer search/discovery with a clean public-site consumption path.
- Early UI/UX can still be tested cheaply with manual linking before the larger enrichment pipeline is built.

## Links

- `plans/adrs/0021-external-admin-capability-boundary.md`

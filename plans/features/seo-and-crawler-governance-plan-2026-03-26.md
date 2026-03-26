# SEO and Crawler Governance Plan (2026-03-26)

## Why this plan exists

World of Aletheia needs two outcomes at the same time:

1. Be discoverable for the right queries (worldbuilding, tabletop RPG, GURPS, campaign tools, Obsidian workflow).
2. Reduce low-value or abusive crawling/scraping pressure without harming legitimate search indexing.

This plan defines a practical, Astro-native rollout path aligned with existing architecture and ADR constraints.

## Architectural constraints and alignment

- **ADR-0001 (Obsidian-first):** content remains markdown-driven, one-way publishing.
- **ADR-0004 (Astro-native):** no speculative service layer for SEO/crawler behavior.
- **ADR-0010 (cloud-default content):** canonical verification uses cloud-parity lane.
- **ADR-0011 (discovery index):** search/discovery remains D1-index backed where implemented.
- **ADR-0014 (calendar/timeline):** `/calendar` and `/timeline` are canon utility surfaces and should be indexable.

## Current baseline (as observed)

- Global meta tags are present via `src/components/BaseHead.astro` and `astro-seo`.
- No explicit robots policy file exists yet (`public/robots.txt` missing).
- No sitemap route/file is present.
- Auth/account pages currently appear indexable unless changed (`/login`, `/account`, `/logout`).
- No documented edge crawler-control policy exists yet (WAF/rate-limit/bot challenge posture).

## Target policy model

### 1) Indexing policy by surface

- **Index + follow**
  - Canon routes (`/`, `/lore/**`, `/places/**`, `/sentients/**`, `/bestiary/**`, `/flora/**`, `/factions/**`)
  - Using Aletheia routes (`/about`, `/systems/**`, `/meta/**`)
  - Canon utilities (`/calendar`, `/timeline`)
  - Public campaign overview/discovery content only where visibility is truly public

- **Noindex + nofollow**
  - Authentication and account surfaces (`/login`, `/account`, `/logout`)
  - Error/status/utility pages not intended for search landing
  - Any route whose primary function is session/account state

- **Never index (and fail closed by access policy)**
  - Protected campaign member and GM content
  - Protected media/API surfaces

### 2) Crawler governance model (layered)

- **Layer A: robots directives (advisory)**
  - Allow mainstream search engine crawling.
  - Provide sitemap location.
  - Disallow obvious non-content/system paths.
  - Optionally disallow known AI training crawlers by UA token (best-effort only).

- **Layer B: page-level robots/canonical signals**
  - Canonical URL on indexable pages.
  - `noindex,nofollow` on auth/account/session pages.
  - Consistent title/description strategy per collection + detail page.

- **Layer C: edge enforcement (authoritative)**
  - Cloudflare WAF managed rules + bot challenge for suspicious bot patterns.
  - Rate limits by path class:
    - strictest on `/api/**` (especially auth/search/media),
    - moderate on high-cost discovery paths,
    - lighter on static/public content.
  - Block malformed/empty UA and repetitive abusive signatures.
  - Keep campaign-protected surfaces fail-closed independent of robots behavior.

## SEO content strategy (subject-matter focused)

### Primary intent clusters

- Worldbuilding setting reference
- Tabletop RPG campaign world
- GURPS campaign setting/resources
- Fantasy timeline and custom calendar tooling
- Obsidian + markdown powered worldbuilding workflow

### On-page optimization direction

- Keep story-first homepage IA (ADR-0002), but tighten semantic copy in hero and section intros around above intent clusters.
- Ensure each collection index has distinct description text (not boilerplate).
- Strengthen internal linking among:
  - lore <-> places <-> sentients <-> factions
  - systems/GURPS pages <-> campaign play documentation
  - calendar/timeline <-> dated lore events
- Preserve readability and canonical subject matter voice (no keyword stuffing).

## Implementation phases

### Phase 1: Technical baseline (high priority)

- Add robots policy (`public/robots.txt` or Astro route variant) with sitemap declaration.
- Add sitemap generation (single sitemap or sitemap index if needed).
- Add canonical URL support in head component.
- Add `noindex,nofollow` for `/login`, `/account`, `/logout`.
- Add staging noindex guard policy to avoid duplicate indexing from staging domain.

### Phase 2: Crawler controls at edge (high priority)

- Define Cloudflare WAF + rate-limit rules for bot/scrape pressure.
- Configure API-specific protections for auth/search/media endpoints.
- Document rule ownership and rollback process in runbook.

### Phase 3: Search quality and metadata uplift (medium priority)

- Expand structured metadata where useful (Organization/WebSite/Breadcrumb/Article equivalents as applicable).
- Standardize social cards/open graph defaults with override points for key pages.
- Normalize title and description templates across layouts.

### Phase 4: Measurement and iteration (ongoing)

- Register/verify Google Search Console and Bing Webmaster Tools.
- Track index coverage, crawl stats, top queries, and click-through patterns.
- Monitor edge logs for bot pressure and false positives.
- Revisit disallow/challenge rules quarterly.

## Success criteria

- Public canonical and utility content is indexed and query-reachable.
- Auth/account/session routes do not appear in search results.
- Protected campaign/member content remains non-indexed and inaccessible.
- Bot/scraper traffic pressure is measurably reduced without harming legitimate crawl.
- Search query impressions improve for target intent clusters (worldbuilding, tabletop RPG, GURPS, custom campaign tools, Obsidian workflow).

## Open decision gates

1. **AI crawler policy strictness:** block known AI-training bots by default vs selective allow-list.
2. **Campaign public indexing scope:** campaign overview only vs selected public family pages.
3. **Sitemap split strategy:** single sitemap now vs staged sitemap index by domain.
4. **Staging discoverability:** full noindex hard policy (recommended) vs partial indexing exceptions.

## Recommended governance step

Create an ADR to lock this as durable policy once the above gates are confirmed.

- Proposed ADR: `plans/adrs/0015-seo-and-crawler-governance-policy.md`

# Discovery, Type Views, Pagination, and Search Index - LLD Handoff (2026-03-20)

## Status

- Date: 2026-03-20
- Audience: Code implementation handoff
- Scope: Near-term discovery and search foundation

## Intent

Implement scalable content discovery in phased order:

1. metadata index and display-by-type,
2. indexed pagination,
3. search endpoint foundation,
4. FTS expansion.

This handoff is intentionally incremental to deliver value without blocking on full-text complexity.

## In Scope

- D1 metadata index schema and ingestion.
- Type/subtype filter and grouped list retrieval.
- Pagination strategy on indexed queries.
- Search API foundation with auth-aware filtering.
- FTS migration plan and phased enablement.

## Out of Scope

- Campaign service extraction.
- New framework adoption for search UI.
- Graph/relationship traversal beyond current taxonomy needs.

## Inputs

- `plans/adrs/0011-discovery-navigation-and-search-index-strategy.md`
- `plans/adrs/0010-global-content-source-mode-cloud-default.md`
- `plans/adrs/0008-systems-taxonomy-type-subtype-model.md`
- `plans/campaign-permissions-phased-enhancement-plan.md`
- `plans/content-source-mode-all-local-or-cloud-lld-handoff-2026-03-19.md`

## Design Overview

```mermaid
flowchart LR
  O[Obsidian Source] --> S[Sync Producer]
  S --> R[(R2 Entries + Manifests)]
  S --> M[(D1 Metadata Index)]

  U[Collection Request] --> Q[Index Query Layer]
  Q --> F{Filters type/subtype/tag/visibility}
  F --> P[Paginated Result Set]
  P --> V[Route Rendering]

  T[Search Request] --> X[Search Query Layer]
  X -->|Phase A/B| M
  X -->|Phase C| FTS[(D1 FTS)]
```

## Data Model (D1)

## Phase A minimum tables

1. `content_index`
   - `id TEXT PRIMARY KEY`
   - `collection TEXT NOT NULL`
   - `slug TEXT NOT NULL`
   - `title TEXT NOT NULL`
   - `type TEXT`
   - `subtype TEXT`
   - `tags_json TEXT` (JSON string)
   - `visibility TEXT`
   - `campaign_slug TEXT`
   - `summary TEXT`
   - `source_etag TEXT NOT NULL`
   - `source_last_modified TEXT NOT NULL`
   - `indexed_at TEXT NOT NULL`

2. recommended indexes
   - `idx_content_index_collection_type_subtype`
   - `idx_content_index_collection_slug`
   - `idx_content_index_visibility_campaign`
   - `idx_content_index_source_etag`

## Phase C table

3. `content_search_fts` (virtual table)
   - `title`, `body_text`, `slug`, `collection`, `type`, `subtype`

## Identity Rules

- `id` is immutable identity from manifest contract.
- `slug` is route identity and may change over time.
- upserts are keyed by `id`.
- stale rows are removed by manifest reconciliation.

## Query Policy

### 1) Discovery/List

Inputs:

- `collection` (required)
- `type` (optional)
- `subtype` (optional)
- `tags` (optional)
- pagination cursor/page

Rules:

- apply visibility/authz constraints first,
- then apply taxonomy filters,
- then order (default: recency).

### 2) Search

Phase A/B:

- metadata/title/summary search only.

Phase C:

- add body-text FTS.

Security:

- protected campaign content excluded unless session qualifies.
- deny-by-default on ambiguous auth context for protected-scope queries.

## File-Level Handoff

### Must change now

1. Add migration file(s) under `migrations/` for metadata index tables and indexes.
2. Add index writer module in sync path (`scripts/content-sync/`) to upsert index rows from manifests/frontmatter.
3. Add index reconciliation step (remove stale IDs absent from current manifests).
4. Add query utility for list retrieval and filter grouping.
5. Update collection list routes to consume index queries for high-volume collections.
6. Add pagination contract and route query param handling.

### Should change soon

1. Add `/api/search` endpoint returning normalized JSON results.
2. Add basic search UI input/results on selected high-volume pages.
3. Add metrics/logging for query latency and index freshness drift.

### Consider soon after

1. Add FTS table and ingestion for body text.
2. Add ranking/snippets and typo tolerance tuning.

## Pagination Contract

Preferred initial mode:

- page-based (`?page=2`) for operator simplicity.
- include total count only when low-cost; otherwise return `hasNext` + cursor option for later migration.

Sort order default:

- `updated_at desc`, tie-break by `slug asc`.

## Failure Handling

1. Index read failure on public pages: render safe fallback state with clear user message.
2. Index read failure on protected routes: deny-by-default for protected content subset.
3. Index writer failure during sync: fail sync publish phase and report exact support code.

## Test Plan

Unit:

1. Upsert-by-id behavior.
2. Stale reconciliation behavior.
3. Type/subtype filter correctness.
4. Visibility/auth filtering behavior.

Integration:

1. Sync run updates D1 index and serves latest filters.
2. Collection page renders paginated type views from index.
3. Unauthorized user cannot retrieve protected search/list rows.

Verification commands:

1. `pnpm content:sync:dry-run`
2. `pnpm content:sync`
3. `pnpm test`
4. `pnpm build`

## Acceptance Criteria

1. Display-by-type works on index-backed list pages.
2. Pagination works for high-volume collections without local file scans.
3. Search foundation endpoint exists and respects auth-aware visibility filtering.
4. Phase C FTS can be added without rewriting Phase A contracts.

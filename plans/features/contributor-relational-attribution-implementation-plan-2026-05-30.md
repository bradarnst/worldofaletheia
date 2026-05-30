# Contributor Relational Attribution Implementation Plan

## Status

- Date: 2026-05-30
- Status: Draft implementation plan for review
- Related HLD: `plans/features/contributor-relational-attribution-hld-2026-05-30.md`
- Related prior HLD: `plans/features/contributors-and-attribution-hld-2026-05-29.md`
- Related prior plan: `plans/features/contributors-and-attribution-implementation-plan-2026-05-29.md`
- Related ADR: `plans/adrs/0022-relational-contributor-attribution-index.md`

## Scope

Implement the relational D1 contributor attribution model needed for exact contributor discovery and search.

This plan assumes the first contributors MVP has already introduced:

- source `authors[]`
- source article `contributors[].roles[]`
- the `contributors` Astro content collection
- `/contributors` and `/contributors/[slug]` routes
- broad contributor profile search links

This plan upgrades that MVP to a proper relational D1 model.

## Delivery Principles

1. Use SQL relational tables for one-to-many attribution facts.
2. Do not store contributor arrays or role objects as JSON inside D1 fields.
3. Keep Obsidian markdown as the source of truth.
4. Keep Astro content collections as the rendering data model.
5. Keep D1 as the cloud lookup/search/discovery index.
6. Preserve public-route visibility constraints.
7. Apply D1 migration before running staging/production content sync.

## Phase 1 — Migration: D1 Contributor Registry and Attributions

### Files

- Add `migrations/0012_contributors_and_attributions.sql`
- Update `scripts/db-migrate-auth-plan.mjs` migration list

### Migration SQL Shape

```sql
CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL,
  profile_mode TEXT NOT NULL DEFAULT 'standard',
  bio_excerpt TEXT,
  avatar TEXT,
  source_id TEXT,
  r2_key TEXT,
  indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attributions (
  contributor_id TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'content',
  target_collection TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role TEXT NOT NULL,
  indexed_at TEXT NOT NULL,

  PRIMARY KEY (
    contributor_id,
    target_type,
    target_collection,
    target_id,
    role
  ),

  FOREIGN KEY (contributor_id)
    REFERENCES contributors(id)
    ON DELETE CASCADE,

  FOREIGN KEY (target_collection, target_id)
    REFERENCES content_index(collection, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attributions_target
  ON attributions(target_type, target_collection, target_id);

CREATE INDEX IF NOT EXISTS idx_attributions_role
  ON attributions(role, contributor_id);
```

### Acceptance Criteria

- Local migration dry-run includes `0012_contributors_and_attributions.sql`.
- Local migration applies cleanly.
- `PRAGMA table_info(contributors);` shows registry columns.
- `PRAGMA table_info(attributions);` shows attribution columns.
- No existing D1 table is rebuilt or destructively changed.

## Phase 2 — Sync Metadata Derivation

### Files Likely Affected

- `scripts/content-sync/cloud-content-metadata.mjs`
- `scripts/content-sync/content-discovery-writer.mjs`
- new or updated writer module for `contributors`/`attributions`
- tests under `scripts/content-sync/*.test.mjs`

### Required Behavior

During metadata derivation:

1. Contributor collection entries produce contributor registry rows:
   - `id`: contributor entry id
   - `display_name`: `displayName ?? title ?? id`
   - `title`
   - `status`
   - `profile_mode`
   - `bio_excerpt`
   - `avatar`
   - `source_id`
   - `r2_key`
   - `indexed_at`
2. Content entries produce attribution rows:
   - every `authors[]` item becomes `role = 'author'`
   - every `contributors[].roles[]` item becomes one row for that contributor id and role
3. Empty or missing source contributors do not produce non-author rows.
4. Duplicate rows are deduped before SQL generation.
5. Sync reconciles stale rows for managed collections.

### Reconciliation Rules

For contributor registry rows:

- Reconcile rows whose `source_id` comes from the managed `contributors` collection.
- Avoid deleting future manually managed or externally sourced contributor rows unless `source_id` identifies them as content-sync owned.

For attribution rows:

- Delete rows where:
  - `target_type = 'content'`
  - `target_collection` is one of the currently managed collections
- Reinsert derived rows for the current sync.

### Acceptance Criteria

- Sync emits contributor registry rows from contributor profile markdown.
- Sync emits `author` attribution rows from `authors[]`.
- Sync emits non-author role rows from `contributors[].roles[]`.
- Sync does not require JSON D1 columns.
- Tests prove multi-author and multi-role entries produce correct rows.

## Phase 3 — Validation Updates

### Files Likely Affected

- `scripts/content-sync/validate.mjs`
- `scripts/content-sync/validate.test.mjs`

### Required Behavior

1. Validate `authors` exists and is non-empty on base content collections.
2. Validate contributor profile entries use valid `status` and `profileMode`.
3. Validate `contributors[].roles[]` values against allowed role enum.
4. Check that `authors[]` ids resolve to contributor profile entries.
5. Check that `contributors[].id` ids resolve to contributor profile entries.
6. Start unresolved references as warnings if the contributor profile set is still being populated; promote to failures once staging content is ready.

### Acceptance Criteria

- Missing `authors` fails for authored content collections.
- Contributor profile entries do not require `authors` or `type`.
- Unknown contributor references are reported clearly with file paths and contributor ids.
- Validation does not auto-rewrite source files.

## Phase 4 — D1 Query Support

### Files Likely Affected

- `src/lib/content-index-repo.ts`
- `src/lib/content-index-repo.test.ts`
- `src/pages/api/search.ts`
- `src/pages/search.astro`
- `src/lib/content-index-page.ts` only if collection discovery pages gain contributor filters

### Required Behavior

Add exact contributor filtering to content index queries.

API contract:

```txt
/search?contributor=brad
/api/search?contributor=brad
```

Semantics:

- `contributor=brad` means any attribution role, including `author`.
- Optional future `role=author` means authored entries only.
- Optional future `role=artist` means artist-attributed entries only.

Query pattern:

```sql
SELECT content_index.*
FROM content_index
JOIN attributions
  ON attributions.target_type = 'content'
 AND attributions.target_collection = content_index.collection
 AND attributions.target_id = content_index.id
WHERE attributions.contributor_id = ?
```

Must also apply existing visibility/status/search constraints.

### Acceptance Criteria

- `/api/search?contributor=brad` returns entries where Brad is an author or credited contributor.
- Existing `q`, collection, type, subtype, tags, pagination, and visibility behavior keep working.
- Protected campaign content does not leak through contributor filtering.
- Search UI preserves and displays the contributor filter state.

## Phase 5 — Contributor Profile UX Refactor

### Files Likely Affected

- `src/pages/contributors/[...slug].astro`
- `src/pages/contributors/index.astro`
- `src/components/ContributorCard.astro`
- possibly a small contributor search/filter helper under `src/utils/`

### Required Behavior

1. Replace broad search links:

```txt
/search?q=Brad
```

with exact links:

```txt
/search?contributor=brad
```

2. Standard profile pages may still render contribution cards at build time from Astro collections, but matching logic must mirror the D1 attribution semantics:
   - `authors[]` -> role `author`
   - `contributors[].roles[]` -> role rows
3. Featured profiles continue to display curated `featuredContributions`.
4. If exact D1-backed profile listings are added later, they must reuse the same `attributions` semantics.

### Acceptance Criteria

- Profile pages link to exact contributor search.
- Standard profile listings include authored and non-author credited work.
- Featured profile listings remain curated.
- Public profile listings exclude protected campaign content in the MVP.

## Phase 6 — Deployment and Migration Runbook

This phase is mandatory for staging and production.

### Local Verification First

```bash
pnpm test
pnpm db:migrate:plan:local:dry-run
pnpm db:migrate:plan:local
pnpm content:sync:validate
pnpm content:sync:local
pnpm build
```

Optional local D1 verification:

```bash
pnpm wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contributors', 'attributions') ORDER BY name;"
pnpm wrangler d1 execute DB --local --command "SELECT COUNT(*) AS contributors_count FROM contributors;"
pnpm wrangler d1 execute DB --local --command "SELECT role, COUNT(*) AS attribution_count FROM attributions GROUP BY role ORDER BY role;"
```

### Staging Order

Run migration before content sync and build/deploy:

```bash
pnpm db:migrate:plan:staging:dry-run
pnpm db:migrate:plan:staging
pnpm content:sync:staging
CONTENT_SOURCE_MODE=cloud CONTENT_LOADER_D1_MODE=remote CONTENT_LOADER_D1_ENV=staging pnpm build
```

Recommended staging verification:

```bash
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contributors', 'attributions') ORDER BY name;"
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT COUNT(*) AS contributors_count FROM contributors;"
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT role, COUNT(*) AS attribution_count FROM attributions GROUP BY role ORDER BY role;"
pnpm wrangler d1 execute DB --remote --env staging --command "SELECT content_index.collection, content_index.id, attributions.role FROM content_index JOIN attributions ON attributions.target_type = 'content' AND attributions.target_collection = content_index.collection AND attributions.target_id = content_index.id WHERE attributions.contributor_id = 'brad' LIMIT 10;"
```

Deploy staging only after verification passes.

### Production Order

Run staging successfully first. Then:

```bash
pnpm db:migrate:plan:prod:dry-run
pnpm db:migrate:plan:prod
pnpm content:sync:prod
CONTENT_SOURCE_MODE=cloud CONTENT_LOADER_D1_MODE=remote pnpm build
```

Recommended production verification:

```bash
pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contributors', 'attributions') ORDER BY name;"
pnpm wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS contributors_count FROM contributors;"
pnpm wrangler d1 execute DB --remote --command "SELECT role, COUNT(*) AS attribution_count FROM attributions GROUP BY role ORDER BY role;"
pnpm wrangler d1 execute DB --remote --command "SELECT content_index.collection, content_index.id, attributions.role FROM content_index JOIN attributions ON attributions.target_type = 'content' AND attributions.target_collection = content_index.collection AND attributions.target_id = content_index.id WHERE attributions.contributor_id = 'brad' LIMIT 10;"
```

Deploy production only after sync and verification pass.

### Failure Handling

- If migration fails, do not run content sync for that environment.
- If sync fails because tables are missing, apply/verify migration first; do not skip attribution writes silently.
- If attributions are empty after sync, inspect source `authors[]`, contributor profiles, and metadata derivation before deploy.
- If search contributor filtering leaks protected campaign rows, block deploy and fix visibility filtering.

## Phase 7 — Documentation Updates

Update or add:

- contributor authoring docs for `authors` vs `contributors`
- sync runbook notes for the migration-before-sync requirement
- search docs for `contributor` query parameter
- old contributors HLD/plan cross-links to this relational attribution addendum

## Final Acceptance Criteria

- D1 staging and production have `contributors` and `attributions` tables.
- Content sync populates both tables.
- Exact `/search?contributor={id}` works.
- Contributor profile search links use the exact contributor parameter.
- Existing collection pages, search, and content rendering still build in cloud mode.
- No contributor attribution data is stored as JSON inside D1 fields.

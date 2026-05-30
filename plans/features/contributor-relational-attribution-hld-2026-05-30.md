# Contributor Relational Attribution High-Level Design

## Status

- Date: 2026-05-30
- Status: Draft HLD addendum for review
- Owner: Brad
- Related prior HLD: `plans/features/contributors-and-attribution-hld-2026-05-29.md`
- Related implementation plan: `plans/features/contributor-relational-attribution-implementation-plan-2026-05-30.md`
- Related ADR: `plans/adrs/0022-relational-contributor-attribution-index.md`

## Purpose

This HLD amends the earlier contributors and attribution HLD with the relational D1 model needed for exact contributor discovery. The earlier HLD remains valid for public contributor IA, profile pages, source frontmatter semantics, and image attribution direction. This addendum replaces any idea that exact contributor search can be satisfied by a broad text query or by hiding contributor structures inside JSON fields.

## Problem Statement

World of Aletheia needs contributor profiles and exact contribution discovery. A contributor may be an article author, artist, editor, researcher, code contributor, consultant, or any acknowledged person/entity. Some contributors may have no article-level attribution at all.

The current compatibility approach of writing a joined author display string into `content_index.author` is not a real data model. It is confusing, does not represent non-author contributors, and cannot support exact queries like "show all content connected to contributor `brad`" without scanning and interpreting source markdown at build time.

Because the project already uses SQLite/D1 as the canonical cloud content index, contribution discovery should be represented relationally rather than as JSON blobs in text columns.

## Goals

1. Preserve clear source-frontmatter semantics:
   - `authors` is first-class article authorship metadata.
   - `contributors` is non-author contributor metadata with role arrays.
2. Normalize both authors and non-author contributors into relational D1 rows for exact querying.
3. Support contributors who are not article/content contributors.
4. Support exact contributor search links such as `/search?contributor=brad`.
5. Support "all contributions" and "authored only" queries without ambiguity.
6. Keep R2 as markdown/blob storage and D1 as the cloud lookup/index authority.
7. Avoid JSON-in-field modeling for one-to-many contributor data.
8. Keep Astro-native rendering and content collection usage; do not add service/adapter layers.

## Non-Goals

1. No privileged contributor admin UI in this repository.
2. No CMS or bidirectional sync behavior.
3. No NoSQL-style JSON document storage inside D1 fields for contributor attribution.
4. No campaign-private contribution listing in public contributor pages until visibility/auth handling is explicitly implemented.
5. No immediate requirement to model every possible future non-content attribution target.
6. No replacement of Obsidian as source of truth.

## Source Authoring Model

Source content remains Obsidian-authored markdown.

Article/frontmatter example:

```yaml
authors:
  - brad
  - barry
contributors:
  - id: example-artist
    roles:
      - artist
      - cartographer
```

Contributor profile frontmatter remains in the `contributors` collection:

```yaml
title: Example Artist
displayName: Example Artist
status: publish
avatar: /assets/images/contributors/example-artist.jpg
bioExcerpt: Short public summary.
profileMode: standard
socials:
  - label: Website
    url: https://example.com
featuredContributions:
  - collection: lore
    slug: example-entry
```

### Source Semantics

- `authors` identifies the person or people responsible for writing or maintaining the article text.
- `contributors` identifies material non-author contributors.
- Authors are conceptually contributors, but they are not duplicated in source `contributors`.
- Do not put `author` inside source `contributors[].roles`; authoring remains the `authors` contract.
- During sync, `authors` becomes an `attributions.role = 'author'` row.

## D1 Relational Model

### `contributors`

Canonical registry of acknowledged contributors.

Represents the contributor as a profile/identity, not a content relationship.

Expected uses:

- contributor index and profile lookup support
- exact contributor id validation
- code contributors or consultants with no article attributions
- future profile metadata exports or admin handoff

Draft schema:

```sql
CREATE TABLE contributors (
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
```

Notes:

- Markdown body remains in R2 and is loaded through Astro content collections.
- The table is an index/registry, not a profile CMS.
- `source_id` maps to the contributor collection entry id.
- `r2_key` is optional but useful for parity/debugging with cloud content indexing.

### `attributions`

Relational query surface for contributor-to-target role facts.

Initial implementation targets content rows in `content_index`, but the table name intentionally remains generic because the semantic concept is attribution, not just content contribution.

Draft schema:

```sql
CREATE TABLE attributions (
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
```

Indexes:

```sql
CREATE INDEX idx_attributions_target
  ON attributions(target_type, target_collection, target_id);

CREATE INDEX idx_attributions_role
  ON attributions(role, contributor_id);
```

Rows derived from the source example above:

| contributor_id | target_type | target_collection | target_id | role |
|---|---|---|---|---|
| brad | content | lore | example-entry | author |
| barry | content | lore | example-entry | author |
| example-artist | content | lore | example-entry | artist |
| example-artist | content | lore | example-entry | cartographer |

### Why a Table Instead of JSON Fields

D1 is SQLite, and this feature is a relational one-to-many relationship:

- one content entry can have many contributors
- one contributor can be credited on many entries
- one contributor can have multiple roles on the same entry
- authorship is a role in the query index but remains a separate source field

A table keeps one fact per row, supports simple joins, and avoids updating an entire JSON document when only one attribution changes.

## Query Semantics

### All public content connected to a contributor

```sql
SELECT content_index.*
FROM content_index
JOIN attributions
  ON attributions.target_type = 'content'
 AND attributions.target_collection = content_index.collection
 AND attributions.target_id = content_index.id
WHERE attributions.contributor_id = ?;
```

### Authored content only

```sql
WHERE attributions.contributor_id = ?
  AND attributions.role = 'author'
```

### Non-author credited work only

```sql
WHERE attributions.contributor_id = ?
  AND attributions.role != 'author'
```

### Role-specific contributed work

```sql
WHERE attributions.contributor_id = ?
  AND attributions.role = 'artist'
```

Search and profile surfaces should generally treat "contributor" broadly as `any attribution role`, while explicitly-authored lists filter `role = 'author'`.

## Sync Pipeline Impact

The content sync pipeline must become the producer of the relational indexes.

Required derived writes:

1. Contributor profile entries produce rows in `contributors`.
2. Content entries with `authors[]` produce one `attributions` row per author with `role = 'author'`.
3. Content entries with `contributors[].roles[]` produce one `attributions` row per contributor id and role.
4. Reconciliation deletes stale attribution rows for managed collections before inserting the current derived set.
5. Validation should warn or fail when an attribution references a missing contributor profile, depending on rollout phase.

## Astro and Front-End Impact

### Contributor profile pages

- Existing profile pages can continue to render markdown through Astro content collections.
- Standard profile contribution lists may continue using `getCollection()` for build-time rendering, but should align with D1 attribution semantics.
- The broad search link should be replaced with exact `/search?contributor={id}`.

### Search page and API

- Add `contributor` as an exact filter parameter.
- The search UI should make clear that contributor search includes authorship and credited contribution roles.
- Later UI can add role filters such as `role=author` or `role=artist`.

### Content cards and headers

- Article headers should keep displaying `Authors` from source/content collection data.
- Non-author credits can be displayed later through a dedicated credits component if needed.
- `content_index.author` should not be expanded as a data model; it may remain temporarily as a display compatibility field only.

## Deployment and Operational Impact

The migration must be applied before running content sync that writes `contributors` and `attributions` rows in staging or production.

Order matters:

1. Apply D1 migration for `contributors` and `attributions`.
2. Deploy/sync code capable of writing the new rows.
3. Run content sync to populate R2, `content_index`, `contributors`, and `attributions`.
4. Build/deploy with cloud mode.

If the migration is missing, sync should fail clearly rather than silently skipping the relational contributor index.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Missing contributor profile for an author id | Start as validation warning, promote to failure once contributor profiles exist. |
| `attributions` out of sync with `content_index` | Reconcile by managed collection during content sync and verify row counts. |
| Public contributor search leaks protected campaign entries | Reuse existing content index visibility filters; MVP contributor profiles should only list public non-campaign collections. |
| `author`/`authors` confusion persists | Treat `content_index.author` as temporary display compatibility only; document `authors` + `attributions.role = 'author'` as canonical. |
| Future non-content attributions need richer targets | Add a follow-up migration when real non-content attribution targets exist; do not over-model now. |

## Recommendation Summary

Use `contributors` as the canonical contributor registry and `attributions` as the normalized relational query surface. Keep `authors` as a first-class source frontmatter field and normalize it into `attributions.role = 'author'` during sync. Do not put attribution JSON into `content_index`. Replace broad contributor profile search links with exact contributor-filtered search once the D1 migration and sync changes are implemented.

# Relational Contributor Attribution Index

## Status

Proposed

## Context and Problem Statement

The contributors MVP introduced public contributor profile pages and moved source article metadata from singular `author` to `authors`. It also introduced source article `contributors[].roles[]` for non-author credits.

That source model is correct for Obsidian authoring, but exact contributor discovery requires a relational D1 query surface. A joined display string in `content_index.author` is only a temporary compatibility field and cannot represent multi-author, multi-role, non-author contributor relationships. Storing contributor arrays or role objects as JSON inside D1 fields would also conflict with the chosen SQL/D1 model and make targeted querying/updating awkward.

World of Aletheia needs exact contributor search semantics where a contributor query usually includes authored content and non-author attributed work, while still allowing author-only filtering when needed.

## Decision Drivers

- Preserve Obsidian-friendly source metadata (`authors` and `contributors`) without duplicating authors in source contributor lists.
- Use SQL relational modeling for one-to-many contributor/content facts.
- Support contributors who are not currently attributed to any content entry.
- Support exact contributor search and future role filtering.
- Keep D1 as the canonical cloud content lookup/discovery index and R2 as blob storage.
- Avoid service/adapter layers; keep Astro content APIs as the rendering read model.
- Avoid JSON-in-field modeling for attribution facts.

## Considered Options

### Option 1: Keep `content_index.author` as joined display text only

Continue deriving `content_index.author` from `authors[]` and use broad text search links for contributor profile pages.

Pros:

- No D1 migration.
- Minimal code change.

Cons:

- Not a real attribution model.
- Cannot represent non-author contributors.
- Cannot support exact contributor search/filtering.
- Confuses source `authors` with legacy `author` display compatibility.

### Option 2: Add JSON fields to `content_index`

Add `authors_json` and `contributors_json` text columns and query them with SQLite JSON functions.

Pros:

- Fewer tables.
- Directly mirrors source frontmatter.

Cons:

- Hides one-to-many facts inside fields.
- Makes targeted role updates awkward.
- Blurs SQL/no-SQL boundaries.
- Still requires special query logic over JSON payloads.

### Option 3: Add `contributors` and `attributions` relational tables (Chosen)

Add a canonical contributor registry table and a normalized attribution facts table. Source `authors[]` becomes `attributions.role = 'author'`; source `contributors[].roles[]` becomes one row per contributor-role-target fact.

Pros:

- Clean SQL model.
- Supports exact contributor and role filtering.
- Supports contributors with no content attribution.
- Keeps source authoring semantics clear.
- Avoids JSON blobs in D1 fields.

Cons:

- Requires D1 migration and sync writer updates.
- Requires reconciliation logic for derived attribution rows.

## Decision Outcome

Chosen option: Option 3 — add relational `contributors` and `attributions` tables.

### Consequences

Positive:

- Contributor search can become exact and role-aware.
- Authorship remains a first-class source concept and also becomes queryable as attribution role `author`.
- Non-author contributor roles become first-class SQL rows.
- Contributors can exist independently of content attributions.

Negative:

- Staging and production require a migration before content sync can populate the new model.
- Sync pipeline complexity increases because it now writes and reconciles two more derived index surfaces.

Neutral:

- Contributor profile markdown remains in the `contributors` Astro collection and R2.
- `content_index.author` may remain temporarily as a display compatibility field but is not canonical.
- Future non-content attribution targets can be added by migration when a real target type exists.

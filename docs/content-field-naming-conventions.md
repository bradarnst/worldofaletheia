# Content & Data Field-Naming Conventions

This document defines field-naming conventions for World of Aletheia content
and data surfaces: authored Markdown frontmatter, TypeScript / JSON / OpenAPI
payloads, D1 / SQL storage, and route/file-system identifiers. It is the
canonical reference when adding or renaming a field that crosses more than one
layer.

## Scope

These rules apply to:

- **Authoring sources:** Markdown files in the Obsidian vault (frontmatter YAML),
  repo-managed content examples, note templates, note generators, and content
  sync/import/export code.
- **Application surface:** Astro content schemas, TypeScript models, Zod/OpenAPI
  request/response shapes, admin and main-site route handlers, and any API
  producer or consumer that touches authored content fields.
- **Storage and indexes:** D1 tables, D1 columns, content-index rows, and other
  persisted metadata owned by World of Aletheia. Live Campaign Content persistence
  is owned by `woa-admin` and is translated at that external boundary.
- **Routing and identifiers:** Markdown file stems, URL slugs, campaign slugs,
  document IDs, and other stable string identifiers derived from content.

This document covers the static worldbuilding collections in this repo (`lore`,
`places`, `sentients`, `bestiary`, `flora`, `factions`, `systems`, `meta`, and
`contributors`) and the main-site representation of live Campaign Content.
Other product domains (spells, accounts,
public spell read API, etc.) are out of scope, though the layer-native-casing
rule stated below should be adopted broadly.

## Conventions

Apply the casing native to each representation layer, and translate at boundaries.

| Layer                           | Casing           | Rationale                                                                                       |
| ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| Markdown frontmatter (YAML)     | **camelCase**    | Matches the TypeScript/API layer, so authoring and app code share the same identifiers.         |
| TypeScript / JSON / OpenAPI     | **camelCase**    | Idiomatic for JS/TS; avoids translation glue when frontmatter fields flow into API responses.   |
| D1 / SQL columns                | **snake_case**   | Idiomatic for SQL; matches Cloudflare and SQLite ecosystem conventions.                         |
| D1 / SQL table names            | **snake_case**   | Consistency with column names and the broader SQL convention.                                   |
| File names (Markdown stems)     | **kebab-case**   | URL-safe, shell-safe, readable; matches route-slug conventions.                                 |
| Slug-style string identifiers   | **kebab-case**   | e.g. `campaignSlug` and route-safe `documentId` values. Slugs are values stored in camelCase fields. |

Do **not** force one spelling across all layers. The correct invariant is
"case native to each layer, with explicit boundary mapping." Obsidian does not
enforce a frontmatter format, so `createdAt` / `updatedAt` are preferred in
Markdown over traditional `created` / `modified` to keep the authored source
aligned with the TypeScript layer.

## Field-by-field reference (repo-owned authored content)

For repo-owned Astro content collections, `src/content.config.ts` is the schema
source of truth. The table below records common cross-layer fields used by the
main site and content sync/indexing pipeline. Collection-specific fields still
belong in `src/content.config.ts`; add rows here when a field crosses multiple
layers or repos.

| Concept | Frontmatter (YAML) | TypeScript / JSON | D1 / SQL column | Notes |
| ------- | ------------------ | ----------------- | ---------------- | ----- |
| content layer | `layer` | `layer` | `layer` | e.g. `canon`, `using`, `campaigns` where stored. |
| collection | `collection` | `collection` | `collection` | Content collection identifier. |
| title | `title` | `title` | `title` | Human-readable display title. |
| content type | `type` | `type` | `type` | Collection-local enum used for grouping/filtering. |
| content subtype | `subtype` | `subtype` | `subtype` | Optional narrower grouping/filtering value. |
| authors | `authors` | `authors` | `authors_json` or mapping table | Authored content commonly uses display names. |
| campaign slug | `campaign` | `campaign` or `campaignSlug` | `campaign_slug` | Frontmatter keeps the concise authored key; API boundaries may use `campaignSlug`. |
| publication state | `publication` | `publication` | `publication` | Canonical authored state for publish/preview/draft-like behavior. |
| content state | `contentState` | `contentState` | `content_state` | Editorial/content maturity state. |
| visibility | `visibility` | `visibility` | `visibility` | Campaign content access surface. |
| parent chain | `parentChain` | `parentChain` | `parent_chain_json` | Relationship/navigation metadata; keep camelCase in authored content. |
| relationships | `relationships` | `relationships` | `relationships_json` | Cross-reference metadata; keep camelCase in authored content. |
| created timestamp | `createdAt` | `createdAt` | `created_at` | Required RFC 3339 date-time for authored content. |
| modified timestamp | `updatedAt` | `updatedAt` | `updated_at` | Required RFC 3339 date-time for authored content. |

## Field-by-field reference (live Campaign Content)

Live Campaign Content is an externally owned source consumed by this repo through
the `campaignContent` live collection. External contracts under `docs/contracts/`
remain authoritative and must not be edited here. This table records the names
used by the main-site consumer; it does not prescribe the owning service's D1
schema.

| Concept | Campaign Content JSON / TypeScript | Notes |
| ------- | ---------------------------------- | ----- |
| collection key | `collectionKey` | Active V1 values are `pages` and `notes`. |
| campaign slug | `campaignSlug` | Exact identifier used by routes, Campaign Gate, and memberships. |
| document id | `documentId` | One path segment in V1; root is `index` and about is `about`. |
| title | `title` | Human-readable item title. |
| visibility | `visibility` | `public`, `campaignMembers`, or `gm`. |
| content type | `type` | Generic item type; notes remain items in collection key `notes`. |
| content subtype | `subtype` | Optional narrower classification. |
| authors | `authors` | Display-name array returned for rendering. |
| contributors | `contributors` | Contributor identifier array returned by the source. |
| modified timestamp | `updatedAt` | RFC 3339 date-time or `null`. |

Main-site paths map to these identities as follows:

- `/campaigns/<campaign-slug>` -> `pages/index`
- `/campaigns/<campaign-slug>/about` -> `pages/about`
- `/campaigns/<campaign-slug>/notes` -> generic `notes` collection query
- `/campaigns/<campaign-slug>/notes/<document-id>` -> `notes/<document-id>`
- `/campaigns/<campaign-slug>/assets/<path>` -> source asset `assets/<path>`

## Date and time encoding

| Kind              | Format                                | Example                             |
| ----------------- | ------------------------------------- | ----------------------------------- |
| Date-time         | ISO 8601 / RFC 3339, `Z` or offset    | `2026-06-22T18:00:00.000Z`          |
| Date-only         | ISO 8601 date                         | `2026-06-22`                        |
| SQL `TEXT` column | ISO 8601 datetime, `Z` preferred      | `'2026-06-22T18:00:00.000Z'`        |

Never emit or accept bare strings like `2026-02-19 23:52` in frontmatter — they
are not RFC 3339 and will be rejected by Zod's `.datetime()` and by
OpenAPI's `format: date-time`.

## How to apply when adding a new field

1. Pick the layer-native casing in each layer.
2. Decide whether the field is required, optional, or nullable — and mirror
   that decision across layers (a required frontmatter field should be required
   in the API; an optional frontmatter field should be optional in the API, etc.).
3. If the field crosses an externally owned API boundary, request the contract
   change from the owning project/team before implementing consumer changes in
   this repo.
4. Add the Zod schema, TypeScript type, D1 column, and parser/serializer changes
   together, in that order.
5. Update tests to cover the new field in all three layers.
6. If the field name differs between layers (e.g. `type` → `noteType`), add
   the mapping row to the reference table above so it stays discoverable.

## Migration from legacy naming

The cross-system migration plan that introduced this convention is in
`.kilo/plans/1782370003109-content-frontmatter-timestamp-cutover.md`. Key rules:

- Frontmatter `created` / `modified` is a legacy spelling; canonical is
  `createdAt` / `updatedAt`.
- There is no compatibility window. Validators reject documents that supply only
  `created` / `modified`, because unknown keys are stripped and the canonical
  required fields are then missing.
- Obsidian itself does not require `created` / `modified`, so migration is a
  bulk rewrite and re-sync with no tool dependency.

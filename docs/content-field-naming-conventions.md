# Content & Data Field-Naming Conventions

This document defines the binding naming conventions for fields that appear across
the Campaign Notes content system: authored Markdown frontmatter, TypeScript /
JSON / OpenAPI payloads, and D1 / SQL storage. It is the canonical reference when
adding or renaming a field that crosses more than one layer.

## Scope

These rules apply to:

- **Authoring sources:** Markdown files in the Obsidian vault (frontmatter YAML),
  note templates, and note generators.
- **Application surface:** TypeScript models, Zod/OpenAPI request/response shapes,
  admin and main-site route handlers, and any API producer or consumer that
  touches the content schema.
- **Storage:** D1 tables and column names owned by the campaign-notes pipeline.

Other repos and domains (spells, accounts, public spell read API, etc.) are out
of scope for this document, though the layer-native-casing rule stated below
should be adopted broadly.

## Conventions

Apply the casing native to each representation layer, and translate at boundaries.

| Layer                           | Casing           | Rationale                                                                                       |
| ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| Markdown frontmatter (YAML)     | **camelCase**    | Matches the TypeScript/API layer, so authoring and app code share the same identifiers.         |
| TypeScript / JSON / OpenAPI     | **camelCase**    | Idiomatic for JS/TS; avoids translation glue when frontmatter fields flow into API responses.   |
| D1 / SQL columns                | **snake_case**   | Idiomatic for SQL; matches Cloudflare and SQLite ecosystem conventions.                         |
| D1 / SQL table names            | **snake_case**   | Consistency with column names and the broader SQL convention.                                   |
| File names (Markdown stems)     | **kebab-case**   | URL-safe, shell-safe, readable; matches route-slug conventions.                                 |
| Slug-style string identifiers   | **kebab-case**   | e.g. `campaignSlug`, `sessionSlug`, `sessionDate`. Slugs are values stored in camelCase fields. |

Do **not** force one spelling across all layers. The correct invariant is
"case native to each layer, with explicit boundary mapping." Obsidian does not
enforce a frontmatter format, so `createdAt` / `updatedAt` are preferred in
Markdown over traditional `created` / `modified` to keep the authored source
aligned with the TypeScript layer.

## Field-by-field reference (campaign notes)

For externally owned campaign-note APIs, the authoritative source is the
contract under `docs/contracts/`; do not edit that contract from this repo.
For repo-owned content validation, `src/content.config.ts` is the schema source
of truth. The table below shows the expected spelling of each field at each
layer for convenience.

| Concept            | Frontmatter (YAML) | TypeScript / JSON API | D1 / SQL column |
| ------------------ | ------------------- | --------------------- | ---------------- |
| collection         | `collection`        | `collection`          | `collection`     |
| campaign slug      | `campaign`          | `campaignSlug`        | `campaign_slug`  |
| document id        | `documentId`        | `documentId`          | `document_id`    |
| title              | `title`             | `title`               | `title`          |
| visibility         | `visibility`        | `visibility`          | `visibility`     |
| author user ids    | `authorUserIds`     | `authorUserIds`       | `author_user_id` (single, normalized via mapping) |
| note type          | `type`              | `noteType`            | `note_type`      |
| session slug        | `sessionSlug`       | `sessionSlug`         | `session_slug`   |
| session date       | `sessionDate`       | `sessionDate`         | `session_date`   |
| created timestamp  | `createdAt`         | `createdAt`           | `created_at`     |
| modified timestamp | `updatedAt`         | `updatedAt`           | `updated_at`     |
| version / etag     | `version`           | `version`             | (no dedicated column; use `current_content_hash`) |

### Notes

- `campaign` is the frontmatter key; it becomes `campaignSlug` in the API
  because the field is not always literally the campaign itself — it's the slug
  used as the campaign identifier.
- `type` is the frontmatter key (it lives inside the document body's metadata
  block, so `type` is unambiguous there). In API/TS we name it `noteType` to
  avoid collision with `typeof` / structural type concepts.
- `authorUserIds` is an array in frontmatter/JSON (multiple authors), and a
  normalized single `author_user_id` column in D1 when the design stores a
  primary author; multi-author storage is documented in the schema.
- `version` in frontmatter is an optimistic-concurrency marker (r2 etag or
  content hash). The durable storage representation is `current_content_hash`
  and related revision columns in D1 — do not invent a dedicated `version` column.

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
- There is no compatibility window. Validators reject notes that supply only
  `created` / `modified`, because unknown keys are stripped and the canonical
  required fields are then missing.
- Obsidian itself does not require `created` / `modified`, so migration is a
  bulk rewrite and re-sync with no tool dependency.

# Repo-Wide Frontmatter Timestamp Cutover Plan

## Goal
Cut all Obsidian-authored content in `worldofaletheia` over from legacy frontmatter timestamp fields to required camelCase timestamps:

- `createdAt`
- `updatedAt`

This applies repo-wide, including contributors.

## Source Of Truth
- `docs/content-field-naming-conventions.md`
- Markdown/frontmatter: camelCase
- TypeScript/JSON/OpenAPI: camelCase
- No compatibility window for legacy `created` / `modified`

## Final Decisions
1. Apply the cutover repo-wide to all Obsidian-authored content collections.
2. Include contributors in the same cutover.
3. Remove legacy keys entirely:
   - `created`
   - `modified`
   - `created-date`
   - `modified-date`
4. Make `createdAt` and `updatedAt` required, not optional.
5. Enforce strict RFC 3339 date-time strings in frontmatter.
6. Accept either UTC `Z` timestamps or explicit numeric offsets.
7. Fail hard when timestamps are missing or invalid; do not fall back to legacy fields or file metadata.
8. External authoring/template/plugin updates are required and must be called out explicitly.

## Affected Boundaries
### Repo-side
- `src/content.config.ts`
- direct frontmatter readers in `src/pages/**`, `src/components/**`, `src/layouts/**`, and shared helpers
- sync/indexing code in `scripts/content-sync/**`
- any repo-side frontmatter emitters, serializers, or generators
- tests covering frontmatter parsing/indexing/display

### External to this repo
- Obsidian vault Markdown bulk rewrite
- Obsidian Templater templates
- Obsidian "Update modified date" plugin configuration

## Required Repo Changes
1. Update content schemas.
   - Replace legacy timestamp fields in `baseSchema` with required `createdAt` and `updatedAt`.
   - Apply the same requirement to contributors.
   - Stop accepting `created`, `modified`, `created-date`, and `modified-date`.
   - Replace loose `z.coerce.date()` acceptance with strict RFC 3339 validation at the frontmatter boundary, then parse to runtime `Date` values.

2. Remove legacy read paths.
   - Delete all repo-side fallback logic that reads legacy timestamp names.
   - Update helpers and page/component/layout code that currently reads:
     - `data.created`
     - `data.modified`
     - `data['created-date']`
     - `data['modified-date']`
   - Read only `createdAt` and `updatedAt` after the cutover.

3. Clean up repo-internal TS shapes that mirror frontmatter.
   - Rename frontmatter-mirroring properties/interfaces from legacy timestamp names to `createdAt` / `updatedAt` where appropriate.
   - Keep visible UI labels like `Created` / `Updated` unchanged.

4. Update sync/indexing logic.
   - In `scripts/content-sync/cloud-content-metadata.mjs`, remove all legacy fallback reads.
   - Require frontmatter `createdAt` and `updatedAt` when deriving index rows.
   - Do not fall back to `sourceStats.mtime` or `sourceLastModified` to compensate for missing authored timestamps.

5. Update sitemap and discovery/index helpers.
   - Replace legacy timestamp access in `src/lib/content-index-page.ts`, `src/pages/sitemap.xml.ts`, and similar helpers.
   - Preserve existing behavior semantics where possible, but source dates only from canonical fields.

6. Update repo-side templates/emitters if any tracked files still emit legacy keys.
   - Any repo-managed frontmatter examples, generators, or emitted YAML should use `createdAt` / `updatedAt` only.

7. Update tests.
   - Replace fixtures using legacy timestamp keys.
   - Add validation coverage for:
     - valid RFC 3339 with `Z`
     - valid RFC 3339 with offset
     - rejection of date-only strings
     - rejection of bare local datetime strings like `2026-06-25 22:14`
     - failure on missing `createdAt` or `updatedAt`

## Required External Steps
1. Bulk rewrite Markdown frontmatter in the Obsidian vault.
   - Rename:
     - `created` -> `createdAt`
     - `modified` -> `updatedAt`
   - Remove any `created-date` / `modified-date` remnants.
   - Normalize values to RFC 3339 date-time strings.

2. Update Obsidian Templater templates.
   - Emit `createdAt` and `updatedAt` only.
   - Stop emitting legacy timestamp keys.
   - Ensure new-note templates use RFC 3339-compatible output.

3. Update Obsidian "Update modified date" plugin config.
   - Configure it to emit strict RFC 3339-compatible timestamps.
   - Offset timestamps are acceptable.

## Failure Modes To Guard Against
- Builds passing because of hidden fallback to file metadata instead of authored timestamps.
- Content pages still reading old keys after schema cutover.
- Contributors being left on legacy names while other collections migrate.
- Obsidian continuing to emit legacy or non-RFC-3339 values after repo validation becomes strict.
- Search/sitemap/index dates diverging from displayed content dates.

## Validation Plan
1. Grep confirms no remaining repo reads of:
   - `created`
   - `modified`
   - `created-date`
   - `modified-date`
   in frontmatter-reading paths.
2. `pnpm test`
3. `pnpm build`
4. `pnpm dev:cf:build`
5. Spot-check representative routes that display timestamps.
6. Spot-check sitemap generation and any discovery/index pages that sort by dates.
7. Run content validation against migrated Markdown before deploy.

## Out Of Scope
- D1/schema changes unrelated to authored content timestamps.
- Changes to unrelated account/auth timestamp fields already using established conventions.
- UI copy changes; display labels can remain `Created` / `Updated`.

## Recommended Execution Order
1. Update external Obsidian/plugin/template configuration first or in lockstep.
2. Bulk rewrite Markdown frontmatter.
3. Land repo schema/read-path/index/test changes in one commit set.
4. Validate with tests/build/cloud build.
5. Deploy only after both repo and authoring flows emit canonical timestamps consistently.

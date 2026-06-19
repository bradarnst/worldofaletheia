# Next Implementation After Publication Template Update

Date: 2026-06-19
Status: Ready for implementation
Context: Plan-mode answer to “what exactly is next to implement?” after Obsidian templates were already updated.

## Short Answer

The next implementation is not the full Phase 2 plan anymore. Most of Phase 2 appears already implemented in repository code. The next slice should be a publication-metadata closeout pass:

1. Update the planning tracker to mark Obsidian template work complete.
2. Add or verify detail-page UI for `contentState` and `audienceWarnings`.
3. Run the publication metadata validation/dry-run/build checks.
4. Fix only failures found by those checks.
5. If checks pass, mark Phase 2 complete or nearly complete and move next to breadcrumb verification or Campaign Notes/Tenancy HLD.

## Current Repository Findings

### Already Implemented In Source

These files indicate repository-side Phase 2 work is already largely done:

- `src/content.config.ts`
  - Defines `publication`, `contentState`, and `audienceWarnings` schemas.
  - Keeps legacy `status` as migration-only input.
  - Uses canonical `authors` arrays.
  - Keeps `secret` deprecated/backward-compatible only.

- `src/utils/content-filter.ts`
  - Defines publication-aware production/preview/development filtering.
  - Derives temporary migration publication from legacy `status`.
  - Excludes `publication: preview` from production.

- `src/lib/content-index-loader.mjs`
  - Filters D1 lookup rows by publication lane.
  - Production remote lookup includes only `publish`; staging/local includes `preview` and `publish`.

- `src/lib/content-index-repo.ts`
  - Reads `publication`, `content_state`, and `audience_warnings_json`.
  - Applies publication filters to indexed/search content queries.

- `src/pages/api/search.ts`
  - Passes environment-aware filtering into the repo search.
  - Returns `contentState` and `audienceWarnings` in search results.

- `scripts/content-sync/publication-policy.mjs`
  - Centralizes sync-lane publication decisions.

- `scripts/content-sync/validate.mjs`
  - Validates publication metadata.
  - Warns on legacy `status` and deprecated `secret`.
  - Accepts canonical `authors` arrays.

- `scripts/content-sync/fs-diff.mjs`
  - Filters production cloud sync source files by publication.
  - Treats excluded production files as absent from the source set, allowing stale production objects to be removed.

- `scripts/content-sync/cloud-content-metadata.mjs`
  - Maps publication metadata into index rows.
  - Derives `author` display from `authors` for D1 compatibility.

- `scripts/content-sync/content-index-writer.mjs`
  - Writes `publication`, `content_state`, and `audience_warnings_json` into `content_index`.

- `migrations/0014_content_publication_metadata.sql`
  - Adds publication metadata columns and index to `content_index`.

- `scripts/content-sync/publication-frontmatter-migration.mjs`
  - Provides a dry-run/write migration for publication metadata.

- `scripts/content-sync/legacy-frontmatter-removal.mjs`
  - Provides follow-up cleanup for legacy `status` and `secret`.

- `src/components/ContentCard.astro`
  - Shows card-level preview, content-state, and audience-warning badges.

- `package.json`
  - Has scripts for publication migration planning and legacy cleanup planning.

### User-Confirmed Completed Outside Repo

- Active Obsidian templates have already been updated to emit the new metadata for future content creation.
- The tracker should be updated to say this is complete rather than still active work.

## Main Remaining Gap

Detail-page UI coverage looks incomplete.

Evidence:

- `src/components/ContentCard.astro` renders compact metadata badges on cards.
- `src/layouts/WorldAletheiaContentLayout.astro`, `src/layouts/UsingAletheiaContentLayout.astro`, and `src/layouts/CampaignsContentLayout.astro` do not pass `publication`, `contentState`, or `audienceWarnings` into their headers.
- `src/components/WorldAletheiaContentHeader.astro`, `src/components/UsingAletheiaContentHeader.astro`, and `src/components/CampaignsContentHeader.astro` do not accept or render those fields.
- `src/components/site/ArticleContextHeader.astro` has no generic metadata/warning slot or prop.
- `src/layouts/CampaignLayout.astro` has some direct publication/warning rendering, but it appears separate from the main shared content layout chain and uses hardcoded colors rather than the current shared header pattern.

Therefore the most concrete next implementation should be detail-page metadata rendering, plus verification.

## Recommended Next Slice

### 1. Update Tracker Status

Edit `plans/post-roadmap-grill-task-tracker-2026-06-19.md`:

- Add “Obsidian Template Update” to Completed.
- In the Phase 2 active item, change the template bullet from active work to completed prerequisite.
- Keep the remaining Phase 2 work focused on closeout/verification and detail-page UI.

Do not modify `plans/todos/index.md` unless a separate todo-index cleanup is requested.

### 2. Add Shared Publication Metadata Display

Implement a small generic Astro component or prop pattern for reader-facing metadata.

Preferred minimal approach:

- Add a component such as `src/components/PublicationMetadataNotice.astro` or extend `ArticleContextHeader.astro` with a small `publicationMetadata` prop.
- Render:
  - `contentState: mayChange` as “May change”.
  - `contentState: unfinished` as “Unfinished”.
  - no public badge for `contentState: stable` unless the design needs it.
  - `audienceWarnings: [gmSpoilers]` as clear label-only warning copy, e.g. “May contain GM or campaign spoilers.”
- Avoid implying authorization, privacy, or restricted access.
- Use DaisyUI/Tailwind semantic classes that work across light/dark themes.
- Do not add client-side JavaScript.

Wire it through:

- `WorldAletheiaContentLayout.astro` -> `WorldAletheiaContentHeader.astro` -> shared header/notice.
- `UsingAletheiaContentLayout.astro` -> `UsingAletheiaContentHeader.astro` -> shared header/notice.
- `CampaignsContentLayout.astro` -> `CampaignsContentHeader.astro` -> shared header/notice.

Acceptance checks:

- Detail pages show `mayChange` and `unfinished` state when present.
- Detail pages show the GM spoiler warning when `audienceWarnings` contains `gmSpoilers`.
- Stable content remains visually quiet unless intentionally changed.
- Warning copy is label-only and does not imply access control.

### 3. Verify Existing Publication Filtering

Run the existing checks before broad code changes beyond the UI gap:

```bash
pnpm test -- src/utils/content-filter.test.ts
pnpm test -- scripts/content-sync/validate.test.mjs scripts/content-sync/fs-diff.test.mjs scripts/content-sync/cloud-content-metadata.test.mjs scripts/content-sync/content-index-writer.test.mjs scripts/content-sync/content-search-writer.test.mjs scripts/content-sync/content-discovery-writer.test.mjs
pnpm content:sync:validate
pnpm content:publication:migration:plan
pnpm content:sync:staging:dry-run
pnpm content:sync:prod:dry-run
pnpm build
```

Notes:

- If a command name differs or remote credentials are unavailable, record the exact failure and avoid guessing.
- `pnpm content:sync:prod:dry-run` should show production excludes preview-only content.
- `pnpm content:sync:staging:dry-run` should allow preview and publish content.

### 4. Fix Only Verification Failures

Expected possible fixes:

- Add missing UI tests or update snapshots if present.
- Fix detail-page metadata prop plumbing.
- Fix dry-run output if production exclusions are happening but not visible enough.
- Fix any migration-script mismatch with the accepted publish-most policy.

Avoid new broad abstractions unless a concrete failure proves they are needed.

### 5. Close Or Reclassify Phase 2

If verification passes:

- Mark Phase 2 repository implementation as complete or “complete pending remote migration application,” depending on whether D1 migration/sync was actually applied remotely.
- Keep legacy cleanup as a follow-up if `status` and `secret` still exist in old content for migration compatibility.

If verification fails:

- Keep Phase 2 active with a concrete failure list, not the broad original scope.

## What Comes After This Slice

If the publication closeout passes, the next ordered candidates are:

1. Breadcrumb restoration/verification.
   - This is the smallest in-repo UI task from the todo pipeline.
   - Source: `plans/todos/breadcrumb-restoration-navigation-ux-2026-05-08.md`.

2. Contributors/Authorship MVP completion check.
   - This may already be mostly done given current `authors`, contributor collection, attribution, and routes support.
   - Run as a verification pass if contributor pages or author display feel uncertain.

3. Campaign Notes/Tenancy HLD.
   - This is the next larger architecture slice from the post-grill roadmap.
   - Do only after publication metadata closeout so source-of-truth questions do not overlap.

## Implementation Boundaries

Do not implement in this slice:

- taxonomy management,
- campaign member mutation endpoints,
- spell CRUD/types/count/search backend/API authority,
- Campaign live-note storage/editor behavior,
- Cloudflare Access checks,
- new service/adapter/contract layers,
- edits under `docs/contracts/`.

## Final Recommended Answer

The exact next implementation is:

1. Update `plans/post-roadmap-grill-task-tracker-2026-06-19.md` to mark Obsidian templates complete.
2. Add detail-page `contentState` and `audienceWarnings` UI to the shared content header/layout chain.
3. Run the publication metadata test/dry-run/build closeout.
4. Fix only failures found by those checks.

This should either close Phase 2 or reduce it to a specific remote migration/sync application checklist.

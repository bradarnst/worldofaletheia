# Publication Schema, Sync, Index, Template, and UI Implementation Plan

Date: 2026-06-19
Status: Ready for implementation sequencing
Roadmap phase: Phase 2 from `.kilo/plans/feature-roadmap-grill-2026-06-17.md`
Related tracker: `plans/post-roadmap-grill-task-tracker-2026-06-19.md`

## Purpose

This is the consolidated Phase 2 plan for implementing the accepted publication metadata model across repository schema, content sync, D1/R2 index behavior, Obsidian templates, frontmatter migration, and reader-facing UI.

It exists before code/template changes so the implementation does not split template work from validation, storage/index filtering, or public UI behavior.

## Source Decisions

Authoritative decisions:

- `plans/adrs/0024-content-publication-metadata-model.md`
- `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md`
- `.kilo/plans/feature-roadmap-grill-2026-06-17.md`
- `.kilo/plans/post-roadmap-grill-task-tracker-plan-2026-06-19.md`

Accepted model:

```yaml
publication: preview | publish | archive
contentState: stable | mayChange | unfinished
audienceWarnings:
  - gmSpoilers
```

Policy constraints:

- `publication` controls publication lane and archive behavior.
- `publication: preview` content is included in local/staging/editorial preview lanes and excluded from production publishing, production search, and normal production discovery.
- `publication: publish` content is production-publishable.
- `publication: archive` is excluded from normal public listing unless an explicit archive surface is later designed.
- `contentState` is reader-facing editorial maturity only.
- `audienceWarnings` is reader-facing warning metadata only.
- `gmSpoilers` is label-only and never authorization.
- Campaign access remains controlled by Better Auth identity, D1 `campaign_memberships`, and campaign `visibility: public | campaignMembers | gm`.
- Deprecated `secret` remains ignored for access control and must not reappear in templates as a privacy or warning mechanism.
- Legacy `status` remains temporary migration input only.
- New templates default to `publication: preview`, `contentState: unfinished`, and `audienceWarnings: []`.
- Existing non-archive content generally migrates to `publication: publish` to preserve current public-site behavior.
- Existing `status: archive | archived` maps to `publication: archive`.

## Scope

### In Scope

1. Repository content schema updates.
2. Shared publication metadata constants/helpers if they reduce duplication without creating service/adapter layers.
3. Local collection filtering and production/list/search exclusion behavior.
4. Content-sync validation, migration messaging, and lane-aware inclusion logic.
5. D1 content-index metadata additions or compatibility mapping needed for `publication`, `contentState`, and `audienceWarnings`.
6. R2/D1 staging vs production publication filters.
7. Frontmatter migration script or checklist for existing markdown.
8. Obsidian Templater updates in the active vault templates.
9. UI badges and warning banners for visible content.
10. Tests and dry-run validation for staging and production lanes.

### Out of Scope

- Editing `docs/contracts/`.
- Adding Cloudflare Access checks.
- Moving privileged admin/operator workflows into this repo.
- Implementing taxonomy management in this repo.
- Implementing campaign member mutation endpoints in this repo.
- Implementing spell CRUD, spell type authority, spell counts, or spell search backend/API behavior in this repo.
- Introducing a new `src/services/`, `src/adapters/`, or `src/contracts/` layer unless ADR-0004 triggers are met during implementation.
- Introducing client-side state or framework islands for Canon or Using Aletheia publication labels.
- Implementing Campaign live-note storage, sync-back, tenancy, or editor behavior; that is Phase 3.

## Pre-Implementation Inventory

Before editing source or templates, inspect the current implementation state and record any deviations from this plan:

1. Read `src/content.config.ts` for current `status`, `author/authors`, `secret`, and campaign `visibility` schema behavior.
2. Search source, content-sync scripts, tests, and plans for active `status`, `secret`, `publication`, `contentState`, and `audienceWarnings` usage.
3. Inspect `src/utils/content-filter.ts` and index/detail page filtering patterns.
4. Inspect search/listing code paths and D1-backed public discovery surfaces.
5. Inspect `scripts/content-sync/` for validation, metadata extraction, D1 writer, R2 upload, stale-object cleanup, and staging/prod command configuration.
6. Inspect migrations and current D1 content-index shape before deciding whether new columns are needed.
7. Inspect active Obsidian templates in `/home/brad/gaming/aletheia-vault/z_Templates` before editing them.
8. Confirm whether repository authorship work already made `authors` canonical. The vault migration from `author:` to `authors:` is complete and should not be treated as still pending.

## Implementation Sequence

### Step 1 — Define Shared Metadata Shape

Goal: make the new values explicit in one obvious place for schema, validation, tests, and UI.

Tasks:

- Add or identify constants for:
  - `publication`: `preview`, `publish`, `archive`
  - `contentState`: `stable`, `mayChange`, `unfinished`
  - `audienceWarnings`: `gmSpoilers`
- Keep constants close to existing content type/schema constants unless a more local helper is clearly better.
- Avoid a new service/adapter layer.
- Define display labels and descriptions only where UI needs them; do not turn display copy into authorization logic.

Acceptance checks:

- The allowed values match ADR-0024 exactly.
- `gmSpoilers` is described as label-only wherever user-facing or developer-facing copy is added.

### Step 2 — Update Repository Content Schema

Goal: Astro content collections accept the new fields and keep legacy `status` only for migration compatibility.

Tasks:

- Update `src/content.config.ts` so applicable content collections support:
  - required or defaulted `publication`,
  - required or defaulted `contentState`,
  - optional/defaulted `audienceWarnings: []`.
- Keep legacy `status` as optional temporary input if needed during migration.
- Preserve campaign `visibility` semantics separately from publication metadata.
- Preserve `secret` only as deprecated legacy metadata if existing content still requires compatibility; do not make it author-facing or security-relevant.
- Ensure campaign collection schema behavior still matches the current visibility-based campaign access model.
- Ensure `authors` remains canonical where authorship migration has already landed or is implemented during the same slice.

Migration posture:

- Existing non-archive legacy `status` values derive `publication: publish` during the migration window.
- Existing `status: archive | archived` derives `publication: archive`.
- Missing `contentState` should default or migrate to a safe visible value, with `stable` as the least disruptive default for existing mature content and `unfinished` for new templates.
- Missing `audienceWarnings` should default to `[]`.

Acceptance checks:

- Schema validates new-style frontmatter.
- Schema still allows planned migration of legacy content long enough to complete content updates.
- Schema does not imply `audienceWarnings` or `secret` is authorization.

### Step 3 — Centralize Publication Filtering

Goal: prevent more inline `status === 'publish'` filtering and make production-vs-preview rules consistent.

Tasks:

- Prefer enhancing `src/utils/content-filter.ts` rather than adding more page-local filtering.
- Define environment/lane-aware inclusion behavior:
  - local/staging/preview lanes include `publication: preview` and `publication: publish`, subject to route-specific archive choices,
  - production normal routes/search/listing include `publication: publish` only,
  - `publication: archive` remains excluded from normal listing unless a dedicated archive surface exists.
- Add compatibility derivation from legacy `status` only inside a clearly named temporary helper if needed.
- Use the helper in touched collection index/detail/search/list surfaces where practical without expanding the slice into a full site refactor.

Acceptance checks:

- Public production listing/search cannot return `publication: preview` content.
- Any remaining inline legacy `status` checks are intentionally deferred and documented.
- Existing campaign authorization checks remain separate from publication filtering.

### Step 4 — Update Content-Sync Validation

Goal: authors get actionable validation messages and migration guidance before content reaches cloud targets.

Tasks:

- Update `scripts/content-sync/validate.mjs` and related tests to recognize `publication`, `contentState`, and `audienceWarnings`.
- Validate allowed enum values.
- Validate `audienceWarnings` as an array and currently allow only `gmSpoilers`.
- Warn or fail on deprecated `secret` according to the current migration posture, while making clear it is ignored for access control.
- Warn on legacy `status` and point authors to the new fields.
- Ensure `authors` arrays are accepted and singular `author` is not treated as the long-term canonical field.
- Add validation copy that tells authors the exact template/frontmatter fix.

Acceptance checks:

- `pnpm content:sync:validate` accepts migrated/new-style content.
- Validation errors for bad publication metadata are direct and actionable.
- Legacy `status` behavior is temporary and called out as migration-only.

### Step 5 — Implement Lane-Aware Sync Filters for R2/D1

Goal: production cloud outputs physically exclude preview-only content; staging includes preview and publish content.

Tasks:

- Identify where sync commands distinguish staging vs production.
- Apply inclusion rules before R2 uploads and before D1 index writes:
  - staging dry-run/sync includes `publication: preview` and `publication: publish`,
  - production dry-run/sync includes `publication: publish` only,
  - archived content remains excluded from normal production indexes unless archive handling is explicitly added.
- Ensure stale-object handling does not accidentally preserve preview-only blobs or rows in production after an entry moves from publish to preview.
- Make dry-run output explicit enough to show excluded preview entries in the production lane.
- Keep runtime filtering as defense-in-depth, not as the primary protection for preview-only content.

Acceptance checks:

- `pnpm content:sync:staging:dry-run` shows preview and publish content in the staging lane.
- `pnpm content:sync:prod:dry-run` excludes preview content.
- Production R2/D1 targets do not retain preview-only content after sync/stale cleanup.

### Step 6 — Update D1/Index Metadata

Goal: search and discovery can reason about publication metadata without relying on legacy `status`.

Decision to make during implementation:

- If `content_index` already has a flexible metadata JSON field suitable for these values, use it consistently.
- If public search/discovery needs direct query predicates, add explicit columns through a migration.

Tasks:

- Map `publication`, `contentState`, and `audienceWarnings` from frontmatter into cloud metadata/index rows.
- Ensure public search/listing filters use `publication` rather than legacy `status` once fields exist.
- Preserve compatibility for existing consumers only as long as migration requires it.
- Add or update migration/tests if direct columns are introduced.

Acceptance checks:

- Public production search cannot return preview content.
- Search/listing display can show content-state and warning metadata when needed.
- Legacy `status` is not the source of truth for new index rows.

### Step 7 — Frontmatter Migration Script or Checklist

Goal: migrate existing content predictably and preserve current public-site visibility.

Tasks:

- Create either a script or an operator checklist, depending on what is safest for the current content location and vault workflow.
- Default mapping:
  - `status: archive | archived` -> `publication: archive`
  - other existing non-archive statuses -> `publication: publish`
  - missing `contentState` -> choose a safe default, normally `stable` for existing content unless reviewed otherwise
  - missing `audienceWarnings` -> `[]`
- Remove or stop emitting legacy `status` after migration where safe.
- Ensure singular `author` is not reintroduced; the Obsidian vault cleanup to `authors` is already complete.
- Include a review point for entries that should be `publication: preview` despite the default publish-most migration policy.

Acceptance checks:

- Existing non-archive public content remains broadly visible after migration.
- Archive content does not return to normal public listing by accident.
- The migration path does not create long-term `author` or `status` fallback as normal behavior.

### Step 8 — Update Obsidian Templates

Goal: new content starts in the safe preview lane and emits valid canonical frontmatter.

Detailed handoff:

- `.kilo/plans/obsidian-templater-frontmatter-templates-handoff-2026-06-19.md`

Active template location:

- `/home/brad/gaming/aletheia-vault/z_Templates`

Tasks:

- Update active templates such as:
  - `default-template.md`
  - `canon-template.md`
  - `using-template.md`
  - `campaign-template.md` or current campaign-family equivalent
  - `contributor-template.md`
- Emit:
  ```yaml
  publication: preview
  contentState: unfinished
  audienceWarnings: []
  ```
- Stop emitting:
  ```yaml
  status: draft
  secret: ...
  ```
- Emit `authors` as a YAML list.
- Emit `tags`, `parentChain`, and `relationships` as valid arrays where appropriate.
- Prompt from current collection/type/subtype enums rather than hardcoded stale values.
- Keep campaign `visibility` separate from `audienceWarnings`.

Acceptance checks:

- New sample notes from active templates parse as valid YAML.
- Generated notes contain no `status` or `secret`.
- Generated notes pass content-sync validation when placed in expected mapped folders.
- Campaign templates emit required `campaign` and `visibility` fields for campaign-family content.

### Step 9 — Add Reader-Facing UI Badges and Warnings

Goal: visible content communicates editorial maturity and warning labels without implying access control.

Tasks:

- Add UI for `contentState` where visible content is rendered:
  - `stable`: likely no badge or a low-emphasis badge only where useful,
  - `mayChange`: visible “May change” style badge,
  - `unfinished`: visible “Unfinished” style badge.
- Add UI for `audienceWarnings`:
  - `gmSpoilers`: reader warning copy such as “May contain GM or campaign spoilers.”
- Decide which surfaces show which metadata:
  - detail pages should show both content-state and warning information,
  - cards/listing/search results may show compact badges if space allows,
  - preview-only status should not become a public production badge because preview content should not be present in production.
- Use Astro components and DaisyUI/Tailwind semantic classes; do not add client-side JS.
- Prefer generic components reusable across Canon, Using Aletheia, and Campaigns rather than duplicating domain-specific badge markup.

Acceptance checks:

- `contentState` and `audienceWarnings` are visible where expected.
- `gmSpoilers` copy does not imply privacy, security, or authorization.
- UI works in the site's light and dark themes through semantic classes.

### Step 10 — Tests, Dry Runs, and Build Verification

Goal: prove the behavior in schema, sync, cloud-target filtering, and public UI.

Required commands, adjusted to current package scripts if names differ:

```bash
pnpm content:sync:validate
pnpm content:sync:staging:dry-run
pnpm content:sync:prod:dry-run
pnpm test -- scripts/content-sync/validate.test.mjs
pnpm build
```

Additional targeted checks:

- Run any content-filter, search, index-writer, discovery-writer, and UI tests that exist or are added in the slice.
- Verify preview dry-run includes preview and publish entries.
- Verify production dry-run excludes preview entries and reports the exclusion clearly.
- Verify production public routes/search/listing cannot return preview content.
- Verify Cloudflare preview deploy runtime is configured to read staging content targets according to ADR-0010.

## File Areas Likely to Change

Expected repository areas:

- `src/content.config.ts`
- `src/lib/content-types.ts` or another existing content constants location
- `src/utils/content-filter.ts`
- collection index/detail pages touched to use centralized filtering
- search/discovery utilities and pages/APIs that read D1-backed public content
- `src/components/` content metadata/header/card components
- `src/layouts/` content layout/header integration points
- `scripts/content-sync/` validation, metadata, writer, dry-run, and filtering modules
- `scripts/content-sync/*.test.mjs`
- `migrations/` if D1 schema changes are needed
- active Obsidian templates under `/home/brad/gaming/aletheia-vault/z_Templates`

Areas that should not change for this phase:

- `docs/contracts/`
- `src/services/`, `src/adapters/`, `src/contracts/` unless ADR-0004 triggers are concretely met
- Campaign live-note/editor/storage code
- Admin/operator taxonomy or user-management backend code

## Open Implementation Decisions

Resolve these during the initial inventory before broad edits:

1. Should `publication`, `contentState`, and `audienceWarnings` constants live in `src/lib/content-types.ts` or remain local to schema/filter helpers?
2. Should `content_index` get explicit columns for publication metadata, or can existing metadata JSON support production filters and UI needs safely?
3. What is the exact environment signal for local, Cloudflare preview/staging, and production in both Astro runtime and content-sync commands?
4. Should legacy `status` compatibility be warning-only, schema-accepted, or fully derived during the first migration slice?
5. Is a script safe for vault frontmatter migration, or should the first pass be a dry-run/checklist with manual approval?
6. Which existing content should intentionally become `publication: preview` rather than following the publish-most migration default?
7. Should `stable` be visually silent in UI, or should it show a badge in preview/editorial surfaces only?

## Definition of Done

Phase 2 is done when:

1. Schema, validation, sync, index, templates, migration, and UI all use `publication`, `contentState`, and `audienceWarnings` as the canonical publication metadata model.
2. Legacy `status` is migration-only and no longer author-facing in templates or new validation guidance.
3. New Obsidian-generated content defaults to `publication: preview`, `contentState: unfinished`, and `audienceWarnings: []`.
4. Production sync/dry-run excludes preview content from R2 and D1.
5. Staging sync/dry-run includes preview and publish content.
6. Public production search/listing cannot return preview content.
7. Visible content can show `contentState` and `audienceWarnings` without implying authorization.
8. Campaign `visibility` remains the only content-frontmatter access-control field.
9. The completed Obsidian vault `author:` -> `authors:` cleanup remains respected; no new long-term singular `author` dependency is introduced.

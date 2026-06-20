# Post-Roadmap-Grill Task Tracker

Date: 2026-06-19
Status: Living tracker
Primary source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`
Created from: `.kilo/plans/post-roadmap-grill-task-tracker-plan-2026-06-19.md`

## Purpose

This tracker records the ordered post-roadmap-grill execution queue after the publication-policy, source-contract, campaign-notes, admin-boundary, and todo-pipeline planning passes.

It is separate from `plans/todos/index.md` by decision: this file is the ordered post-grill roadmap, while `plans/todos/index.md` remains the narrower index for deferred implementation todos that already have standalone files under `plans/todos/`.

## Existing Documented Order

The canonical phase order comes from `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, especially its `Implementation-Ready Plan` section:

1. Phase 1: Publication Policy ADR — complete.
2. Phase 2: Publication Schema/Sync Plan — next.
3. Phase 3: Campaign Notes/Tenancy HLD.
4. Phase 4: Main-Site UX/Test Plan.

Additional cleanup state comes from `.kilo/plans/todo-pipeline-audit-2026-06-17.md`:

- Search S2 is done or good enough for now.
- Sorcerer spell-list UX is no longer active next-slice work.
- Campaign member mutation endpoints are external API behavior.
- Taxonomy management is external admin/operator work.
- Spell CRUD, spell type authority, spell counts, and spell search backend/API behavior are external.
- Breadcrumb verification remains the main in-repo deferred UI task from the older todo pipeline.

## Completed

### Publication Policy ADR Set

Status: Complete
Completed: 2026-06-18
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`

Completed artifacts:

- `plans/adrs/0024-content-publication-metadata-model.md`
- `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md`
- Related ADR updates for preview/staging behavior, SEO/search exclusion, D1/R2 publication filtering, campaign membership authorization boundaries, and ADR-0001 clarification.

Result:

- `publication`, `contentState`, and `audienceWarnings` are accepted as the replacement model for overloaded legacy `status` semantics.
- `gmSpoilers` is label-only and never authorization.
- `secret` remains deprecated and ignored for access control.
- Cloudflare preview deploys are tied to staging content targets by policy.
- Production D1/R2 must exclude `publication: preview` content by policy.

### Obsidian Vault Author Cleanup

Status: Complete
Completed: before 2026-06-19 follow-up planning
Related plan: `.kilo/plans/1780050988617-happy-panda.md`

Completed work:

- The Obsidian vault was migrated from singular `author:` to list-based `authors:` frontmatter.
- This was originally missed in the task tracker and is now explicitly recorded here.

Follow-up implication:

- Repository schemas, sync validation, index mapping, and UI consumers should treat `authors` as canonical and avoid preserving long-term `author` fallback unless a concrete migration need remains.

### Obsidian Publication Template Update

Status: Complete
Completed: before 2026-06-19 implementation follow-up
Related plan: `.kilo/plans/obsidian-templater-frontmatter-templates-handoff-2026-06-19.md`

Completed work:

- Active Obsidian templates were updated to support future content creation with the accepted publication metadata model.
- New content templates now emit `publication: preview`, `contentState: unfinished`, and `audienceWarnings: []`.
- Templates no longer need to be tracked as active Phase 2 implementation work.

Follow-up implication:

- The remaining Phase 2 work should focus on repository closeout: detail-page UI, validation/dry-run verification, and any fixes discovered by those checks.

### Todo Pipeline Cleanup

Status: Complete
Completed: 2026-06-17
Source: `.kilo/plans/todo-pipeline-audit-2026-06-17.md`

Completed work:

- Search S2 marked done or good enough for now.
- Sorcerer spell-list UX removed from active next-slice status.
- Campaign member endpoint ownership clarified as external API behavior.
- Taxonomy management clarified as external admin/operator work.
- Related-resource enrichment kept as future work, not next work.
- `plans/todos/index.md` updated for taxonomy and related-resource statuses.

## Active Next Queue

### 1. Publication Schema, Sync, Index, Template, and UI Implementation

Status: Complete
Priority: P0
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, Phase 2
Detailed plan: `plans/publication-schema-sync-index-template-ui-implementation-plan-2026-06-19.md`

Scope:

- Update `src/content.config.ts` for `publication`, `contentState`, and `audienceWarnings`.
- Keep legacy `status` only as temporary migration input.
- Update content-sync validation and migration messaging.
- Update D1/index metadata if needed for publication, content-state, and warning fields.
- Enforce staging vs production R2/D1 publication filters.
- Obsidian template updates are complete; verify generated content continues to validate against repository schema/sync rules.
- Public UI badges/warnings for `contentState` and `audienceWarnings` are wired into cards and shared detail-page headers.

Acceptance criteria from the grill:

- `pnpm content:sync:staging:dry-run` shows preview and publish content in the staging lane.
- `pnpm content:sync:prod:dry-run` excludes preview content.
- Public production search/listing cannot return preview content.
- Preview deploys read staging target content.

Closeout checks run on 2026-06-19:

- `pnpm test -- src/utils/content-filter.test.ts scripts/content-sync/validate.test.mjs scripts/content-sync/fs-diff.test.mjs scripts/content-sync/cloud-content-metadata.test.mjs scripts/content-sync/content-index-writer.test.mjs scripts/content-sync/content-search-writer.test.mjs scripts/content-sync/content-discovery-writer.test.mjs` passed.
- `pnpm content:sync:validate` passed for 105 files.
- `pnpm content:publication:migration:plan` reported 0 of 105 markdown files need publication metadata updates.
- `pnpm content:sync:staging:dry-run` completed and included the new preview character content in the staging lane.
- `pnpm content:sync:prod:dry-run` completed and excluded the preview character content from the production lane.
- `pnpm build` passed, with existing content-loader and dynamic-route warnings unrelated to publication metadata.

Remote closeout checks run on 2026-06-19:

- Remote staging and production D1 both have `publication`, `content_state`, and `audience_warnings_json` columns from migration `0014_content_publication_metadata.sql`.
- Remote staging D1 contains `104` publish rows and `1` preview row; all rows point at the staging R2 target prefix.
- Remote production D1 contains `104` publish rows and `0` preview rows; all rows point at the production R2 target prefix.
- `pnpm content:sync:staging` and `pnpm content:sync:prod` were applied after adding lane-specific R2 prefixes.
- Final `pnpm content:sync:staging:dry-run` reported `0 new, 0 updated, 0 stale, 216 unchanged`.
- Final `pnpm content:sync:prod:dry-run` reported `0 new, 0 updated, 0 stale, 215 unchanged, 1 publication-excluded` and listed the preview-only Benoit Laclisse file as excluded.

Operational note:

- The closeout found and fixed a staging/production R2 target collision: staging now writes under `content/staging/...`, while production writes under `content/...`. D1 `r2_key` values are the authoritative active lookup path; older no-prefix R2 objects are orphaned compatibility residue and are no longer part of active lookup.

Detailed handoffs currently available:

- `.kilo/plans/obsidian-templater-frontmatter-templates-handoff-2026-06-19.md` covers the completed Obsidian template slice.
- `.kilo/plans/next-implementation-after-publication-template-update-2026-06-19.md` covers the immediate closeout slice after the template update.

### 2. Contributors/Authorship MVP Completion Check

Status: Complete
Priority: P1
Sources: `.kilo/plans/1780050988617-happy-panda.md`, `plans/features/contributors-and-attribution-implementation-plan-2026-05-29.md`

Scope to verify or finish:

- Repository schema supports canonical `authors`.
- Structured `contributors` metadata is supported where intended.
- Contributor collection, routes, and footer links exist if the MVP was implemented.
- Content sync validation accepts `authors` arrays and no longer requires `author`.
- Cloud metadata/index mapping handles `authors` pragmatically.
- UI, layout, card, and header surfaces display authors correctly.

Known completed prerequisite:

- Obsidian vault `author:` to `authors:` cleanup is complete.

Recommendation:

- Completed on 2026-06-19. Verification found schema, routes, footer/about links, cloud metadata, and detail-header author rendering already in place. Closeout fixes added consistent card-level author chips outside the campaign-chip gate and sync-time validation for `contributors[].roles[]` values.

### 3. Breadcrumb Restoration / Verification

Status: Complete
Priority: P1/P2
Source: `plans/todos/breadcrumb-restoration-navigation-ux-2026-05-08.md`

Scope:

- Verify breadcrumb behavior on real content pages with `parentChain`.
- Close the todo if current components already render the expected breadcrumbs.
- Otherwise implement a narrow front-end/navigation fix.

Recommendation:

- Completed as a small shared header/layout fix on 2026-06-19. Current vault content has no non-empty `parentChain` entries to screenshot-test, but World, Using Aletheia, and Campaign detail layout paths now all pass `parentChain` and `relationships` to the shared article header renderer.

### 4. Campaign Notes and Tenancy HLD

Status: HLD complete; implementation blocked pending follow-up LLD/approval
Priority: P2
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, Phase 3

Scope:

- Per-campaign vault mapping.
- Logical tenant/campaign isolation in storage and indexes.
- Markdown import/publish as a permanent path.
- Append-only live notes as a cloud-first Campaigns exception.
- Sync-back/export to campaign Obsidian vaults.
- Conflict avoidance by forbidding same-file bidirectional editing in v1.
- Future path to per-campaign buckets, separate indexes/databases, PostgreSQL, or Campaigns service extraction.

Closeout:

- Planning artifact completed on 2026-06-19 as `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`.
- Campaign live-note implementation is not started and remains blocked/delayed until a follow-up LLD is approved.
- The HLD keeps live notes append-only, campaign-slug scoped, and export/import based; it does not authorize implementation by itself.

### 5. Main-Site UX/Test Plan

Status: Partial route-level execution recorded; manual lanes remain
Priority: P2
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, Phase 4

Scope:

- Campaign user-management UI backed by `woa-admin` APIs.
- Email normalization and exact-email errors.
- Login, sign-up, and password reset.
- Contact/contribute form validation and Mailjet failure states.
- Publication/content-state badges and spoiler warnings.
- Preview vs production expectations.

Closeout / current findings:

- Planning artifact completed on 2026-06-19 as `plans/main-site-ux-route-test-plan-2026-06-19.md`, covering auth/password flows, contact/contribute forms, campaign management entry behavior, publication badges/warnings, breadcrumbs/relationships, and staging-vs-production publication expectations.
- First execution findings were recorded on 2026-06-19 as `plans/main-site-ux-route-test-findings-2026-06-19.md`.
- Local route smoke checks and remote publication D1/R2 checks passed for the covered lanes.
- Fixes from the first pass: local `dev:cf:auth` now prepares local content before building, and missing campaign-family entries now return HTTP 404 fallback content instead of throwing a server error.
- Remaining manual lanes need operator/test-account env: auth success paths, Mailjet sandbox success behavior, anonymous/non-member/member/GM campaign-management checks, active staging hostname verification, and post-deploy production verification.

## Deferred / Future

### Related Resource Enrichment and Spell Discovery

Status: Open / Future
Source: `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`

Notes:

- Future promoted-resource UX/enrichment idea.
- Spell data/API authority remains external.
- This repo owns only approved front-end consumption/rendering.

### External Admin Taxonomy Management

Status: Open / External
Source: `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`

Notes:

- Not an in-repo public-site implementation task under ADR-0021.
- Track as external admin/operator requirement.

### Remote Parity Automation

Status: Deferred
Source: `.kilo/plans/1775545082688-jolly-meadow.md`

Notes:

- Decide later between manual/operator-run parity checks and a secret-backed CI lane.
- Requires ownership, failure policy, and required secrets before workflow changes.

### Campaign Media Image Variants

Status: Backlog
Source: `.kilo/plans/1779504834397-quick-eagle.md`

Notes:

- Backlog, not current sprint.

### Image Attribution Validation and Lightbox

Status: Deferred contributor follow-ups
Source: `plans/features/contributors-and-attribution-implementation-plan-2026-05-29.md`

Notes:

- Image attribution validation should begin as warnings.
- Lightbox should be a site-wide progressive enhancement, not contributor-specific behavior.

## Decision Points Before Next Implementation

### Phase 2 Sequence

Decision: Use a consolidated Phase 2 implementation plan before code/template changes.

Implication:

- Do not implement template-only or schema-only changes first without checking the consolidated Phase 2 sequence.
- The Phase 2 plan must sequence schema, sync validation, D1/R2 publication filters, Obsidian templates, frontmatter migration, and UI badges/warnings together.

### Tracker Ownership

Decision: Keep this separate post-grill tracker.

Implication:

- Leave `plans/todos/index.md` unchanged unless a later cleanup deliberately merges the roadmap and deferred-todo index.

### External Ownership Boundaries

Decision: Keep external ownership items out of this repo's implementation queue.

External or non-owned implementation work includes:

- taxonomy management,
- campaign member mutation endpoints,
- spell CRUD, spell types, spell counts, and spell search backend/API authority.

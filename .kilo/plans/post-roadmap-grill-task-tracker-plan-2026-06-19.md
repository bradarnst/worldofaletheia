# Post-Roadmap-Grill Task Tracker Plan

Date: 2026-06-19
Status: Ready for implementation
Requested durable tracker target: `plans/post-roadmap-grill-task-tracker-2026-06-19.md`
Source plan: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`

## Current Finding

There is already a documented task order in `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, especially under `Implementation-Ready Plan`:

1. Phase 1: Publication Policy ADR - complete.
2. Phase 2: Publication Schema/Sync Plan - next.
3. Phase 3: Campaign Notes/Tenancy HLD.
4. Phase 4: Main-Site UX/Test Plan.

There is also `plans/todos/index.md`, but it is a narrower deferred-todo index. It does not currently capture the full post-grill execution queue, the completed publication-policy ADR set, or the missed Obsidian vault cleanup.

## Plan Mode Constraint

The user asked for the living tracker somewhere under `./plans`, but the current plan-mode permissions blocked writing `plans/*.md`. During implementation mode, create the tracker at:

- `plans/post-roadmap-grill-task-tracker-2026-06-19.md`

Do not modify source files for this request. This is documentation/planning cleanup only.

## Tracker Content To Create

Create `plans/post-roadmap-grill-task-tracker-2026-06-19.md` with these sections:

1. Purpose
2. Existing Documented Order
3. Completed
4. Active Next Queue
5. Deferred / Future
6. Decision Points Before Next Implementation

## Completed Items To Record

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
- This was originally missed in the task tracker and should now be explicitly recorded.

Follow-up implication:

- Repository schemas, sync validation, index mapping, and UI consumers should treat `authors` as canonical and avoid preserving long-term `author` fallback unless a concrete migration need remains.

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

## Active Next Queue To Record

### 1. Publication Schema, Sync, Index, Template, and UI Implementation

Status: Next candidate
Priority: P0
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, Phase 2

Scope:

- Update `src/content.config.ts` for `publication`, `contentState`, and `audienceWarnings`.
- Keep legacy `status` only as temporary migration input.
- Update content-sync validation and migration messaging.
- Update D1/index metadata if needed for publication/content-state/warning fields.
- Enforce staging vs production R2/D1 publication filters.
- Update Obsidian templates so new content defaults to `publication: preview`, `contentState: unfinished`, and `audienceWarnings: []`.
- Add public UI badges/warnings for `contentState` and `audienceWarnings` where content is visible.

Acceptance criteria from the grill:

- `pnpm content:sync:staging:dry-run` shows preview and publish content in the staging lane.
- `pnpm content:sync:prod:dry-run` excludes preview content.
- Public production search/listing cannot return preview content.
- Preview deploys read staging target content.

Detailed handoff currently available:

- `.kilo/plans/obsidian-templater-frontmatter-templates-handoff-2026-06-19.md` covers the Obsidian template slice.

### 2. Contributors/Authorship MVP Completion Check

Status: Near-term candidate, depends on current implementation state
Priority: P1
Sources: `.kilo/plans/1780050988617-happy-panda.md`, `plans/features/contributors-and-attribution-implementation-plan-2026-05-29.md`

Scope to verify or finish:

- Repository schema supports canonical `authors`.
- Structured `contributors` metadata is supported where intended.
- Contributor collection/routes/footer links exist if MVP was implemented.
- Content sync validation accepts `authors` arrays and no longer requires `author`.
- Cloud metadata/index mapping handles `authors` pragmatically.
- UI/layout/card/header surfaces display authors correctly.

Known completed prerequisite:

- Obsidian vault `author:` to `authors:` cleanup is complete.

Recommendation:

- Run this as a verification pass after or alongside publication-schema work, because both touch frontmatter/schema/sync behavior.

### 3. Breadcrumb Restoration / Verification

Status: Open
Priority: P1/P2
Source: `plans/todos/breadcrumb-restoration-navigation-ux-2026-05-08.md`

Scope:

- Verify breadcrumb behavior on real content pages with `parentChain`.
- Close the todo if current components already render the expected breadcrumbs.
- Otherwise implement a narrow front-end/navigation fix.

Recommendation:

- Keep this as a small, separate UI verification/fix slice after the publication/authorship metadata work unless breadcrumbs are currently blocking authoring or review.

### 4. Campaign Notes and Tenancy HLD

Status: Planned architecture slice
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

Recommendation:

- Do this after publication metadata and source-contract implementation work is underway, because live campaign notes reopen source-of-truth and write-authority questions.

### 5. Main-Site UX/Test Plan

Status: Planned follow-up
Priority: P2
Source: `.kilo/plans/feature-roadmap-grill-2026-06-17.md`, Phase 4

Scope:

- Campaign user-management UI backed by `woa-admin` APIs.
- Email normalization and exact-email errors.
- Login, sign-up, and password reset.
- Contact/contribute form validation and Mailjet failure states.
- Publication/content-state badges and spoiler warnings.
- Preview vs production expectations.

Recommendation:

- Run after publication fields and display behavior exist, so the tests can assert the new UX instead of legacy `status` behavior.

## Deferred / Future Items To Record

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

## Decisions Captured

### Tracker Ownership

Decision: Create a separate tracker.

Create `plans/post-roadmap-grill-task-tracker-2026-06-19.md` as the ordered living roadmap, and leave `plans/todos/index.md` as the narrower deferred-todo index unless a later cleanup deliberately merges them.

### Phase 2 Sequencing

Decision: Use a consolidated Phase 2 implementation plan before code/template changes.

Create a Phase 2 plan that sequences schema, sync validation, D1/R2 publication filters, Obsidian templates, frontmatter migration, and UI badges/warnings. This avoids splitting template work from validation/storage behavior before the implementation order is settled.

## Prior Decision Points

### Phase 2 Sequencing

Decision needed:

- Should the next implementation slice be templates first, repo schema/sync first, or a consolidated Phase 2 implementation plan first?

Options:

1. Templates first.
   - Best if stale Obsidian frontmatter is the immediate problem.
   - Risk: templates may need a second pass if schema/sync details change.
2. Schema/sync first.
   - Best if validation and production/staging safety are the immediate problem.
   - Risk: authors may keep creating stale notes until templates catch up.
3. Consolidated Phase 2 plan first.
   - Best if we want a safer order across schema, sync, D1/R2, templates, migration, and UI.
   - Risk: delays code/template work by one planning pass.

Recommendation:

- Use consolidated Phase 2 planning if D1/R2 filtering and schema migration are likely non-trivial.
- Use templates first if authoring hygiene is the immediate priority and a possible follow-up pass is acceptable.

### Tracker Ownership

Decision needed:

- Keep `plans/post-roadmap-grill-task-tracker-2026-06-19.md` as the living post-grill tracker, or fold this material into `plans/todos/index.md`.

Recommendation:

- Keep a separate post-grill tracker because it is an ordered roadmap, while `plans/todos/index.md` is a deferred-todo index.

## Implementation Steps After Plan Mode

1. Create `plans/post-roadmap-grill-task-tracker-2026-06-19.md` with the tracker content above.
2. Leave `plans/todos/index.md` unchanged.
3. Create a consolidated Phase 2 implementation plan for publication schema/sync/index/template/migration/UI work before implementation.
4. Use that Phase 2 plan to drive the next code/template slice.

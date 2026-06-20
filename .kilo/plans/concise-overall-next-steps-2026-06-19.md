# Concise Overall Next Steps and Handoff

Date: 2026-06-19
Last updated: 2026-06-20
Status: Current concise tracker after publication/authorship/breadcrumb closeout and first UX route-test pass
Primary tracker: `plans/post-roadmap-grill-task-tracker-2026-06-19.md`
First route-test findings: `plans/main-site-ux-route-test-findings-2026-06-19.md`

## How to Read This

This file is the short handoff view for the next work session. It separates completed work, partial test execution, remaining manual verification, blocked implementation, and deferred/external items. "Complete" means coded/applied/verified or intentionally closed; it does not mean every related future idea is done.

## Current Priority Order

1. Verify the committed route-test fixes after deployment, especially that preview-only/missing campaign-family URLs return 404/noindex instead of HTTP 500 in production.
2. Complete the remaining manual main-site UX route lanes with operator env/test accounts and record follow-up findings.
3. If the manual lanes remain blocked by env/account access, draft the Campaign Notes/Tenancy LLD only if live notes are chosen as the next active implementation track.
4. Decide whether deferred contributor/image enhancements deserve promotion into active work.
5. Keep external and non-owned items out of this repo's implementation queue.

Latest verification update, 2026-06-20: staging/prod content-sync dry runs and D1 publication checks still match expectations, and `pnpm build` passes. Production direct checks for the preview-only/missing campaign-family routes still returned HTTP 500 from the deployed site, so the source fix in commit `349499a` remains deploy-verification pending rather than closed.

## Phase and Workstream Summary

| Phase / workstream | Current status | Done | Remaining / next | Blockers / dependencies |
| --- | --- | --- | --- | --- |
| Phase 1: Publication policy ADR set | Complete | ADRs define `publication`, `contentState`, and `audienceWarnings`; preview/staging, SEO/search exclusion, D1/R2 filtering, campaign auth boundaries, and ADR-0001 clarification are documented. | No known next step. | None known. |
| Phase 2: Publication schema, sync, index, template, and UI | Complete | Schema/sync/filtering/D1 columns/UI wiring are in place; Obsidian templates emit publication metadata; remote staging/prod migrations and syncs were applied; production excludes `publication: preview`; staging uses `content/staging/...`, production uses `content/...`. | Optional cleanup only: remove obsolete legacy/no-prefix R2 objects if desired. | None known. |
| Contributors/Authorship MVP completion check | Core complete; enhancements deferred | Canonical `authors` verified; contributor collection/routes/footer/about links exist; D1 attribution/search plumbing verified; card/header author display fixed; sync validates `contributors[].roles[]`. | Decide whether image attribution convention/docs, stronger image-credit validation, and site-wide lightbox/full-size image UX should enter active work. | Deferred enhancements need separate prioritization; not required for core authorship MVP. |
| Breadcrumb restoration / verification | Complete | Shared article header already rendered breadcrumbs; World, Using Aletheia, and Campaign detail layouts pass `parentChain` and `relationships`; todo closed. | Visually verify when real non-empty `parentChain` content exists. | Current vault has no non-empty `parentChain` examples. |
| Phase 3: Campaign Notes/Tenancy HLD | HLD complete; implementation blocked/delayed | HLD written at `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`; append-only live notes, campaign-slug tenancy, export/import sync-back, and future separation path are defined at a high level. | Write an LLD before implementation; then plan data model, authz, append-only note storage, export/sync-back, and UI. | Blocked pending LLD/approval. No live-note implementation should start before that. |
| Phase 4: Main-site UX route testing | Partial execution recorded; source fixes committed | Test plan written at `plans/main-site-ux-route-test-plan-2026-06-19.md`; first findings logged at `plans/main-site-ux-route-test-findings-2026-06-19.md`; local route smoke and remote D1/R2 publication checks ran; local startup order and missing campaign-family entry 404 behavior were fixed and committed in `349499a`. | Complete account/form success-path testing with operator env/test accounts; verify active staging URL; verify production after deploy. | Needs test accounts/env access, active staging/preview hostname, and production deploy verification. |
| Todo pipeline cleanup | Complete | Search S2 is done/good enough; sorcerer spell-list UX removed from active next-slice status; external ownership boundaries clarified; related-resource enrichment remains future. | No known next step. | None known. |

## Contributors/Authorship Phase Snapshot

| Phase / milestone | Status | Notes |
| --- | --- | --- |
| Data model foundation: `author` to `authors` | Complete | Vault cleanup was already done; repo schema/sync/UI use canonical `authors`. |
| Contributors MVP pages | Complete | Contributor collection, index/detail routes, footer/about links are present. |
| Article credits and profile listings | Core complete | `authors` and structured `contributors` are supported; profile/search attribution behavior exists. |
| Relational D1 attribution | Complete for current use | Migration, sync metadata, attributions, and contributor filtering exist. |
| Contributor role validation | Complete | Sync validation checks `contributors[].roles[]` against allowed role values. |
| Image attribution convention | Deferred / partial | Contributor link/reference validation exists, but full image-credit convention/docs and artist-caption mismatch checks are not complete. |
| Full-size image/lightbox UX | Deferred | Explicitly postponed from the initial contributor MVP; if revived, treat as site-wide progressive enhancement. |

## Deferred, Backlog, and External Items

| Item | Status | Handling |
| --- | --- | --- |
| Related resource enrichment and spell discovery | Open / Future | Future promoted-resource UX/enrichment idea; spell data/API authority remains external. |
| External admin taxonomy management | Open / External | Not an in-repo public-site implementation task; track as external admin/operator requirement. |
| Remote parity automation | Deferred | Decide later between manual/operator-run parity checks and a secret-backed CI lane; needs ownership, failure policy, and secrets. |
| Campaign media image variants | Backlog | Not current sprint. |
| Image attribution validation and lightbox | Deferred contributor follow-ups | Attribution validation should begin as warnings; lightbox should be site-wide, not contributor-specific. |

## Active Next Options

### Option A: Finish Main-Site UX Route Testing

Recommended next target when operator env/test accounts are available. The first pass already produced and committed concrete fixes; the remaining work is verification-heavy.

Inputs:

- `plans/main-site-ux-route-test-plan-2026-06-19.md`
- `plans/main-site-ux-route-test-findings-2026-06-19.md`
- Current publication and breadcrumb closeout state in `plans/post-roadmap-grill-task-tracker-2026-06-19.md`
- Test account/env access for local Cloudflare parity, staging, and production

Expected output:

- Follow-up findings appended or filed for remaining manual lanes.
- Production verification that missing/preview-only campaign-family URLs no longer return HTTP 500 after deploy.
- Clear triage for any account/form/campaign-role issues found during manual verification.

### Option B: Campaign Notes/Tenancy LLD

Choose this only if live notes are intentionally promoted into active planning or if manual route-test lanes remain blocked.

Inputs:

- `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`
- Better Auth plus exact `campaign_memberships.campaign_slug` and role boundaries
- ADR-0001, ADR-0004, ADR-0024, and ADR-0025

Expected output:

- Data model and migration strategy for append-only live-note events.
- Authorization and tenancy checks for every route/query/object key.
- Export/import workflow design that avoids same-file bidirectional editing.
- UI/island scope proposal for Campaigns only.

### Option C: Deferred Contributor/Image Enhancements

Choose only if authorship polish is higher priority than route testing or campaign-note planning.

Inputs:

- `plans/features/contributors-and-attribution-implementation-plan-2026-05-29.md`
- Current contributor validation and card/header display behavior

Expected output:

- Decision on image-credit frontmatter convention.
- Warning-first validation plan for image credit mismatches.
- Site-wide progressive lightbox/full-size image UX plan.

## Hard Boundaries

Do not pull these into the main-site implementation queue:

- Cloudflare Access checks.
- Campaign member mutation endpoints.
- Spell CRUD, spell type authority, spell counts, or spell search backend/API authority.
- Taxonomy management/admin console implementation.
- Campaign live-note editing/storage before an approved LLD.
- Same-file bidirectional editing between Obsidian and runtime site features.
- Edits under `docs/contracts/`.

## Handoff Prompt for Next Session

Use this prompt to start the next session:

```text
You are continuing the next World of Aletheia work session. Start by reading these files:

1. AGENTS.md
2. plans/post-roadmap-grill-task-tracker-2026-06-19.md
3. .kilo/plans/concise-overall-next-steps-2026-06-19.md
4. plans/main-site-ux-route-test-plan-2026-06-19.md
5. plans/main-site-ux-route-test-findings-2026-06-19.md
6. plans/features/campaign-notes-tenancy-hld-2026-06-19.md

Current state:

- Publication metadata Phase 1 and Phase 2 are complete, including remote staging/prod D1/R2 closeout.
- Contributors/Authorship MVP is core-complete; only image attribution convention/validation and lightbox UX remain deferred.
- Breadcrumb restoration is complete in shared layout/header plumbing; visual verification waits for real non-empty parentChain content.
- Campaign Notes/Tenancy has an HLD only; implementation is blocked until an LLD is approved.
- Main-site UX route testing has a first findings pass. Local route smoke and remote publication checks passed. Two fixes were committed in `349499a`: `dev:cf:auth` now prepares local content before build, and missing campaign-family entries return 404 fallback content instead of throwing HTTP 500.

Recommended next target:

Finish the remaining main-site UX route-test lanes if operator env/test accounts and an active staging/preview hostname are available. Verify post-deploy production behavior for preview-only/missing campaign-family URLs. If those lanes remain blocked, move to a Campaign Notes/Tenancy LLD planning session rather than implementing live notes.

Hard constraints:

- Use pnpm only.
- Do not add dependencies without explicit approval.
- Do not use Cloudflare Access; auth is Better Auth and campaign authorization is exact campaign_memberships slug/role checks.
- Do not edit files under docs/contracts/.
- Do not implement campaign live notes before an approved LLD.
- Keep external ownership items out of this repo's implementation queue: taxonomy management, campaign member mutation endpoints, and spell backend/API authority.
```

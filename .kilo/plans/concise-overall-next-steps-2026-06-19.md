# Concise Overall Next Steps and Handoff

Date: 2026-06-19
Last updated: 2026-06-20
Status: Current concise tracker after Campaign Notes foundation deployment
Primary tracker: `plans/post-roadmap-grill-task-tracker-2026-06-19.md`
First route-test findings: `plans/main-site-ux-route-test-findings-2026-06-19.md`

## How to Read This

This file is the short handoff view for the next work session. It separates completed work, partial test execution, remaining manual verification, blocked implementation, and deferred/external items. "Complete" means coded/applied/verified or intentionally closed; it does not mean every related future idea is done.

## Current Priority Order

1. Continue Campaign Notes implementation with the server-side R2 document API layer: authenticated read/create/update endpoints using the deployed D1 `campaign_note_documents` index and optimistic version checks.
2. Complete the remaining manual main-site UX route lanes with operator env/test accounts and record follow-up findings.
3. Decide whether deferred contributor/image enhancements deserve promotion into active work.
4. Keep external and non-owned items out of this repo's implementation queue.

Latest verification update, 2026-06-20: Campaign Notes R2-backed document foundation has been migrated, built, and deployed. The owner reports the earlier production HTTP 500 route thread is not current; treat remaining main-site UX route lanes as manual/operator verification work unless a new production failure is independently reproduced.

## Phase and Workstream Summary

| Phase / workstream | Current status | Done | Remaining / next | Blockers / dependencies |
| --- | --- | --- | --- | --- |
| Phase 1: Publication policy ADR set | Complete | ADRs define `publication`, `contentState`, and `audienceWarnings`; preview/staging, SEO/search exclusion, D1/R2 filtering, campaign auth boundaries, and ADR-0001 clarification are documented. | No known next step. | None known. |
| Phase 2: Publication schema, sync, index, template, and UI | Complete | Schema/sync/filtering/D1 columns/UI wiring are in place; Obsidian templates emit publication metadata; remote staging/prod migrations and syncs were applied; production excludes `publication: preview`; staging uses `content/staging/...`, production uses `content/...`. | Optional cleanup only: remove obsolete legacy/no-prefix R2 objects if desired. | None known. |
| Contributors/Authorship MVP completion check | Core complete; enhancements deferred | Canonical `authors` verified; contributor collection/routes/footer/about links exist; D1 attribution/search plumbing verified; card/header author display fixed; sync validates `contributors[].roles[]`. | Decide whether image attribution convention/docs, stronger image-credit validation, and site-wide lightbox/full-size image UX should enter active work. | Deferred enhancements need separate prioritization; not required for core authorship MVP. |
| Breadcrumb restoration / verification | Complete | Shared article header already rendered breadcrumbs; World, Using Aletheia, and Campaign detail layouts pass `parentChain` and `relationships`; todo closed. | Visually verify when real non-empty `parentChain` content exists. | Current vault has no non-empty `parentChain` examples. |
| Phase 3: Campaign Notes source/live editing | Foundation deployed | Corrected LLD exists at `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`; R2-backed Markdown document foundation is implemented and deployed via D1 `campaign_note_documents`, R2 key/frontmatter/version helpers, and D1 index repo/tests. | Implement server-side R2 document read/create/update API routes; then add bounded Astro Island Markdown editor. | Realtime collaborative editing, Obsidian/R2 sync tooling, and broader public/GM visibility policy remain later decisions. |
| Phase 4: Main-site UX route testing | Partial execution recorded; source fixes committed/deployed | Test plan written at `plans/main-site-ux-route-test-plan-2026-06-19.md`; first findings logged at `plans/main-site-ux-route-test-findings-2026-06-19.md`; local route smoke and remote D1/R2 publication checks ran; local startup order and missing campaign-family entry 404 behavior were fixed and deployed. | Complete account/form success-path testing with operator env/test accounts; verify active staging URL and any remaining production UX routes as needed. | Needs test accounts/env access and active staging/preview hostname. |
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

### Option A: Continue Campaign Notes R2 Document API

Recommended next implementation target. The storage/index/version foundation is deployed; the next slice should expose authenticated server-side read/create/update behavior before building the editor UI.

Inputs:

- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`
- `migrations/0015_campaign_note_documents.sql`
- `src/lib/campaign-note-documents.ts`
- `src/lib/campaign-note-documents-repo.ts`
- Better Auth plus exact `campaign_memberships.campaign_slug` and role boundaries

Expected output:

- API routes or Astro Actions for campaign note document read/create/update.
- R2 whole-document Markdown read/write using the deployed key convention.
- Optimistic conflict behavior returning `409 Conflict` on stale saves.
- Tests for anonymous/non-member/member/GM access, cross-campaign isolation, and stale-version conflicts.

### Option B: Finish Main-Site UX Route Testing

Recommended next target when operator env/test accounts are available. The first pass already produced and committed concrete fixes; the remaining work is verification-heavy.

Inputs:

- `plans/main-site-ux-route-test-plan-2026-06-19.md`
- `plans/main-site-ux-route-test-findings-2026-06-19.md`
- Current publication and breadcrumb closeout state in `plans/post-roadmap-grill-task-tracker-2026-06-19.md`
- Test account/env access for local Cloudflare parity, staging, and production

Expected output:

- Follow-up findings appended or filed for remaining manual lanes.
- Optional confirmation that missing/preview-only campaign-family URLs continue to avoid HTTP 500 in the deployed site.
- Clear triage for any account/form/campaign-role issues found during manual verification.

### Option C: Campaign Notes Astro Island Editor

Choose this only after the server-side R2 document API contract is implemented and tested.

Inputs:

- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`
- Campaign note document API routes from Option A
- ADR-0007 vanilla TypeScript-first island policy

Expected output:

- Bounded Campaigns-only Markdown editor island.
- Load/edit/save UI with conflict messaging.
- No realtime collaborative editing or global client state.

### Option D: Deferred Contributor/Image Enhancements

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
- Realtime collaborative campaign editing before a separate technology decision.
- Blind last-write-wins same-file editing between Obsidian/R2/runtime site features.
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
- Campaign Notes has an approved corrected LLD and the R2-backed document foundation has been migrated, built, and deployed.
- Main-site UX route testing has a first findings pass. Local route smoke and remote publication checks passed. Two fixes were committed/deployed: `dev:cf:auth` now prepares local content before build, and missing campaign-family entries return 404 fallback content instead of throwing HTTP 500.

Recommended next target:

Continue Campaign Notes with the server-side R2 document API layer: authenticated read/create/update endpoints using the deployed D1 `campaign_note_documents` index, R2 Markdown documents, frontmatter validation, and optimistic version checks. Build the Astro Island editor only after that API contract is proven.

Hard constraints:

- Use pnpm only.
- Do not add dependencies without explicit approval.
- Do not use Cloudflare Access; auth is Better Auth and campaign authorization is exact campaign_memberships slug/role checks.
- Do not edit files under docs/contracts/.
- Do not implement realtime collaborative campaign editing before a separate technology decision.
- Keep external ownership items out of this repo's implementation queue: taxonomy management, campaign member mutation endpoints, and spell backend/API authority.
```

# Current Workstream Status Tracker

Date: 2026-06-19
Status: Current concise tracker after implementation closeout

## How to Read This

This tracker separates **implemented/production-ready work** from **planning artifacts**, **pending test execution**, and **deferred/blocked implementation**. “Complete” means coded/applied/verified or intentionally closed; it does not mean every related future idea is done.

## Workstream Summary

| Workstream | Current status | Done | Remaining / next | Blockers / dependencies |
| --- | --- | --- | --- | --- |
| Publication metadata + remote closeout | Complete | Schema/sync/filtering/D1 columns/UI wiring are in place; remote staging/prod sync applied; prod excludes `publication: preview`; staging uses `content/staging/...`, prod uses `content/...`. | No required next step known. Optional cleanup: remove obsolete legacy/no-prefix R2 objects if desired. | None known. |
| Breadcrumb restoration | Complete | Shared article header already rendered breadcrumbs; Using Aletheia and Campaign detail layouts now pass `parentChain` and `relationships`; todo closed. | Visually verify when real non-empty `parentChain` content exists. | Current vault has no non-empty `parentChain` examples. |
| Contributors/Authorship core | Core complete; enhancements deferred | Canonical `authors` verified; contributor schema/routes/footer/about links exist; D1 attribution/search plumbing verified; card/header author display fixed; sync validates contributor role values. | Deferred: image attribution convention/docs, stronger image-credit validation, and site-wide lightbox/full-size image UX. | Deferred enhancements need separate prioritization; not required for core authorship MVP. |
| Campaign Notes/Tenancy | HLD complete; implementation blocked/delayed | HLD written: `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`. | Write LLD before implementation; then implement data model, authz, append-only note storage, export/sync-back, and UI. | Blocked pending LLD/approval. No live-note implementation should start before that. |
| Main-site UX route testing | Test plan complete; execution pending | Test scripts written: `plans/main-site-ux-route-test-plan-2026-06-19.md`. | Execute local/staging/prod route-level tests; record findings; implement fixes found by testing. | Needs test accounts/env access and staging/prod verification time. |

## Contributors/Authorship Phase Snapshot

| Phase / milestone | Status | Notes |
| --- | --- | --- |
| Data model foundation: `author` → `authors` | Complete | Vault cleanup was already done; repo schema/sync/UI use canonical `authors`. |
| Contributors MVP pages | Complete | Contributor collection, index/detail routes, footer/about links are present. |
| Article credits + profile listings | Core complete | `authors` and structured `contributors` are supported; profile/search attribution behavior exists. |
| Relational D1 attribution | Complete for current use | Migration, sync metadata, attributions, and contributor filtering exist. |
| Contributor role validation | Complete | Sync validation now checks `contributors[].roles[]` against allowed role values. |
| Image attribution convention | Deferred / partial | Contributor link/reference validation exists, but full image-credit convention/docs and artist-caption mismatch checks are not complete. |
| Full-size image/lightbox UX | Deferred | Explicitly postponed from the initial contributor MVP. |

## Still Open After This Tracker

1. Execute `plans/main-site-ux-route-test-plan-2026-06-19.md`.
2. Draft a Campaign Notes/Tenancy LLD before any live-note implementation.
3. Decide whether deferred contributor enhancements — image attribution convention and lightbox/full-size image viewing — should enter the active queue.

## Boundaries

Do not pull these into the main-site implementation queue: taxonomy management, campaign member mutation endpoints, spell backend/API authority, Cloudflare Access checks, or Campaign live-note editing/storage before the LLD.

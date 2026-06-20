# Next Step: Campaign Notes/Tenancy LLD

Date: 2026-06-20
Status: Ready for implementation planning

## Decision

The next implementation step is to write the **Campaign Notes/Tenancy LLD**.

## Why This Is Next

- The route-test source fix from `349499a` has already been deployed.
- The user reports production does not show the HTTP 500 issue, so do not treat that as the active next task.
- Remaining main-site UX route-test lanes are mostly manual/operator verification work: auth accounts, Mailjet success paths, campaign role matrix, and active staging hostname.
- The next in-repo implementation artifact that moves the roadmap forward is the Campaign Notes/Tenancy LLD.
- Do not implement live-note runtime code until this LLD is approved.

## Implementation Target

Create:

- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`

The LLD should refine:

- `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`

## Required LLD Scope

The LLD should define:

- campaign slug tenancy model
- note scopes for v1
- authorization matrix using Better Auth plus exact `campaign_memberships.campaign_slug` and role checks
- append-only event model
- D1 schema proposal and migration strategy
- R2 export artifact convention
- export/import flow back to Obsidian without bidirectional same-file editing
- server API boundaries to implement later
- Campaigns-only UI/island scope
- test and acceptance criteria
- open decisions needing owner approval before coding

## Recommended Defaults

> **Superseded:** The LLD produced at `plans/features/campaign-notes-tenancy-lld-2026-06-20.md` rejected several of these defaults in its "Correction From Prior Draft" section. The defaults below are the historical prompt to the author; for the authoritative model, read the LLD.

- V1 live notes are GM-authored only. *(Rejected by LLD: V1 is member + gm.)*
- V1 scopes are `campaign` and `session`.
- V1 visibility is GM-only unless explicitly expanded later. *(Rejected by LLD: `campaignMembers` is the V1 default; `gm`-only is an open decision.)*
- D1 stores event metadata and short markdown bodies. *(Rejected by LLD: R2 is canonical for Markdown bodies; D1 is index/coordination only.)*
- R2 stores generated export artifacts.
- Redaction is append-only via a new redaction event. *(Rejected by LLD: V1 uses whole-document load/edit/save with optimistic version checks, not append-only events.)*
- Runtime code never edits Obsidian or published markdown directly.
- `gmSpoilers` remains label-only and is not authorization.

## Not Next

Do not prioritize these before the LLD unless explicitly requested:

- production deploy/debug work
- campaign live-note code
- campaign member mutation endpoints
- Cloudflare Access checks
- external admin/taxonomy implementation
- source changes under `docs/contracts/`

## Definition of Done

- The LLD exists at `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`.
- It is detailed enough to hand to a coding pass for schema/routes/UI work.
- It preserves the existing auth, source-of-truth, and external-boundary decisions.

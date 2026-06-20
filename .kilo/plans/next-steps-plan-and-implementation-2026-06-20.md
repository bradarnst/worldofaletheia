# Next Steps Plan and Implementation

Date: 2026-06-20
Status: Ready for implementation
Source of truth: `.kilo/plans/concise-overall-next-steps-2026-06-19.md`

## Goal

Move from planning-only verification into deployable repository output, without performing a production deploy.

In this context, implementation means producing code, tests, or design artifacts that can be committed and later deployed through CI/CD or manually approved production release flow. It does not mean running `pnpm deploy:prod` from this session.

## Current State

- Commit `349499a Fix route-test blockers and record UX findings` already contains the source fix for missing campaign-family content returning HTTP 404 fallback instead of throwing HTTP 500.
- Current production still returns HTTP 500 for missing/preview-only campaign-family URLs because the fix is not yet observable in production. That is a deploy/release verification issue, not evidence that more route code is required.
- Staging/prod content-sync dry runs and D1 publication state match expectations.
- `pnpm build` passes.
- Remaining auth/form/campaign-role UX lanes require operator secrets, active staging hostname, and test accounts.
- Working tree has planning/finding document changes from prior verification; preserve them.

## Hard Constraints

- Use `pnpm` only.
- Do not deploy production or staging from this implementation pass.
- Do not edit `docs/contracts/`.
- Do not add dependencies.
- Do not introduce Cloudflare Access checks.
- Do not implement campaign member mutation endpoints.
- Do not implement Campaign Notes/live notes runtime code before an approved LLD.
- Preserve unrelated user/agent changes in the working tree.

## Implementation Strategy

The next in-repo implementation should be split into two passes:

1. Close the already-fixed route blocker as deployable source, without deploying.
2. Produce the Campaign Notes/Tenancy LLD as the next substantive implementation artifact because the remaining route-test lanes are environment/account blocked.

This keeps momentum while respecting the CI/CD direction and the existing hard boundary that live-note code must wait for an LLD.

## Pass 1: Route Fix Source Hardening

Purpose: ensure the route fix already in `349499a` is deployable and not hiding an obvious local regression. This is not a production deploy.

Steps:

1. Inspect current route code and working tree.
   - Confirm `src/pages/campaigns/[campaign]/[family]/[...slug].astro` still sets `Astro.response.status = 404` for missing campaign or missing family entry.
   - Confirm missing/restricted/unavailable content remains `noindex, nofollow`.
   - Confirm no unrelated source/runtime changes are pending.

2. Run local verification.
   - `pnpm build`
   - `pnpm content:sync:prod:dry-run`
   - Optional if time permits: `pnpm content:sync:staging:dry-run`

3. Decide whether source hardening is warranted.
   - Do not refactor just to create a test harness for one Astro page.
   - Add code/tests only if inspection finds a real deployable gap, such as an unhandled valid route state that can still throw before fallback rendering.
   - If adding a test would require extracting route logic, keep the extraction small, local, and justified by an actual branch of behavior, not by abstract coverage goals.

4. Record the no-deploy status.
   - Update findings/tracker docs only if new evidence is produced.
   - Mark production closure as pending external deploy/CI verification, not pending source implementation.

Expected output:

- Either no source change because the code is already deployable, or a very narrow route/test hardening commit if a concrete gap is found.
- Findings accurately distinguish deploy verification from source implementation.

## Pass 2: Campaign Notes/Tenancy LLD

Purpose: produce the design artifact that unlocks later live-note implementation, without starting live-note runtime code.

Create `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`.

The LLD should refine `plans/features/campaign-notes-tenancy-hld-2026-06-19.md` into implementation-ready detail while staying within accepted ADRs.

### Required Inputs

- `plans/features/campaign-notes-tenancy-hld-2026-06-19.md`
- ADR-0001: Obsidian-first content architecture
- ADR-0004: Astro-native Campaigns content access
- ADR-0007: vanilla TypeScript-first Astro islands
- ADR-0009: campaign content source separation
- ADR-0010: cloud-default source mode
- ADR-0016: D1 index and R2 blob storage
- ADR-0019: unified `campaign_memberships` roles
- ADR-0021: external admin capability boundary
- ADR-0024: publication metadata model
- ADR-0025: portable Markdown/frontmatter contract

### LLD Content Requirements

The LLD should include:

- Scope and non-goals.
- Tenant identity: exact `campaign_slug` as the partition key for every row, route, query, and object key.
- V1 note scopes with explicit recommended defaults.
- Authorization matrix for anonymous, non-member, member, and GM.
- D1 physical schema proposal and migration strategy.
- R2 object-key convention for export artifacts if exports use R2.
- Append-only event semantics, including redaction/tombstone behavior.
- Export/import workflow that preserves ADR-0001 and ADR-0025 by avoiding same-file bidirectional editing.
- Server route/API surface proposal under Campaigns only.
- UI/island scope proposal, vanilla TypeScript-first unless triggers justify another framework later.
- Observability, audit, and failure behavior.
- Test plan and acceptance criteria.
- Open decisions that truly require owner approval before coding.

### Recommended Defaults To Use In The LLD

> **Superseded:** The LLD produced at `plans/features/campaign-notes-tenancy-lld-2026-06-20.md` rejected these starting defaults in its "Correction From Prior Draft" section. The defaults below are retained only as the historical prompt to the author. For the authoritative model, read the LLD, not this section.

Use these as starting proposal unless implementation reading finds a contradiction:

- V1 allows GM-authored live notes only. Player/member authoring can be a later extension. *(Rejected by LLD: V1 is member + gm.)*
- V1 scopes are `session` and `campaign`, with `gm` visibility first. Player-visible shared notes are deferred unless explicitly promoted. *(Partially rejected by LLD: `campaignMembers` is the default visibility; `gm`-only visibility is an open decision, not the V1 default.)*
- Use D1 for note event metadata and short markdown bodies in v1. Use R2 for generated export artifacts, not for every note body unless body size or attachment needs justify it. *(Rejected by LLD: R2 is canonical for Markdown bodies; D1 is index/coordination only.)*
- Events are append-only. Redaction is represented by a new event that supersedes display of a prior body; do not mutate historical event rows except for narrow operational metadata if explicitly justified. *(Rejected by LLD: V1 uses whole-document load/edit/save with optimistic version checks, not append-only events.)*
- Exports are generated artifacts for operator import into the campaign vault; runtime code must not write back into Obsidian or edit published markdown files.
- Better Auth remains authentication; authorization is exact `campaign_memberships.campaign_slug` plus role `member | gm`.
- `gmSpoilers` remains label-only and never participates in note authorization.

### Suggested D1 Shape To Evaluate

The LLD should evaluate, refine, or reject this concrete starting shape:

```sql
campaign_note_events
- id TEXT PRIMARY KEY
- campaign_slug TEXT NOT NULL
- session_slug TEXT NULL
- scope TEXT NOT NULL CHECK (scope IN ('campaign', 'session'))
- visibility TEXT NOT NULL CHECK (visibility IN ('gm'))
- actor_user_id TEXT NOT NULL
- event_type TEXT NOT NULL CHECK (event_type IN ('note_appended', 'note_redacted', 'export_created'))
- body_markdown TEXT NULL
- supersedes_event_id TEXT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'
- created_at TEXT NOT NULL

campaign_note_exports
- id TEXT PRIMARY KEY
- campaign_slug TEXT NOT NULL
- session_slug TEXT NULL
- source_event_high_watermark TEXT NOT NULL
- r2_key TEXT NOT NULL
- status TEXT NOT NULL CHECK (status IN ('generated', 'imported', 'superseded'))
- created_by_user_id TEXT NOT NULL
- created_at TEXT NOT NULL
```

The LLD should also specify indexes, likely:

```sql
CREATE INDEX idx_campaign_note_events_campaign_created
ON campaign_note_events (campaign_slug, created_at);

CREATE INDEX idx_campaign_note_events_session_created
ON campaign_note_events (campaign_slug, session_slug, created_at);
```

### Server Boundary To Design

The LLD should propose route/API boundaries, not implement them. Candidate surfaces:

- `GET /api/campaigns/[campaign]/notes?session=...`
- `POST /api/campaigns/[campaign]/notes`
- `POST /api/campaigns/[campaign]/notes/[eventId]/redactions`
- `POST /api/campaigns/[campaign]/notes/exports`

The LLD must call out that these are not campaign member mutation endpoints and must not expose raw D1 mutation behavior.

## Validation Commands For Implementation Pass

For Pass 1 route/source hardening:

- `pnpm build`
- `pnpm content:sync:prod:dry-run`
- Optional: `pnpm content:sync:staging:dry-run`
- If source code changes are made: run the narrowest relevant `pnpm test -- ...` set plus `pnpm build`.

For Pass 2 LLD only:

- No build is required unless source files are touched.
- Read/verify referenced ADRs and HLD before writing the LLD.
- Use MADR-style clarity for decisions inside the LLD where tradeoffs matter, but do not create a new ADR unless the LLD concludes a new architecture decision is required.

## Definition of Done

- No deploy has been performed.
- Route-fix source state is confirmed deployable or narrowly hardened if a real gap is found.
- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md` exists and is implementation-ready enough to guide a later code pass.
- The LLD preserves Obsidian/source-contract boundaries, campaign slug tenancy, Better Auth plus `campaign_memberships` authorization, and the external-admin boundary.
- Any remaining auth/form/staging/production UX lanes are explicitly recorded as environment/account/deploy verification work, not in-repo source implementation blockers.

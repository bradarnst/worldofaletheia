# Campaign Notes Option C Write-Session Boundary Plan

Date: 2026-06-21
Status: Finalized planning direction

## Decision

Campaign Notes should use **Option C** as the target architecture:

> `woa-admin` owns Campaign Notes authority, D1/index/search/audit state, key policy, and write finalization. The main site and deploy-time producer may write Markdown bodies to R2 only through `woa-admin`-approved write/import sessions.

This supersedes the earlier direction in `.kilo/plans/campaign-notes-r2-document-api-implementation-2026-06-20.md`, which incorrectly planned main-site API routes that directly owned Campaign Notes D1/R2 mutation.

## Non-Negotiable Boundaries

1. The main site must not directly mutate Campaign Notes D1 state.
2. The main site must not own the Campaign Notes document index, search index, audit log, or storage layout policy.
3. `woa-admin` is the authority for Campaign Notes create/update/finalize/import behavior.
4. Better Auth remains authentication.
5. Campaign authorization remains exact `campaign_memberships.campaign_slug` plus role:
   - `member | gm` for campaign-member notes;
   - `gm` only for GM-only notes.
6. Do not use Cloudflare Access.
7. Do not edit `docs/contracts/` from this repo.
8. R2 direct writes are allowed only as body transfer, not as authority. The object key/bucket/prefix must be issued or approved by `woa-admin`.

## Why R2 Direct Writes Are Acceptable Under Option C

Direct R2 writes are not equivalent to direct D1 mutation.

D1 rows represent authoritative state: document identity, visibility, campaign tenancy, source lifecycle, current version, search/indexing, and auditability. Those must stay under `woa-admin`.

R2 objects are Markdown body blobs. The main site or producer can write them safely only if:

- the target bucket/prefix/key came from `woa-admin`;
- the write is associated with a short-lived write/import session;
- the write is finalized through `woa-admin` before it becomes canonical;
- orphaned/unfinalized objects are considered recoverable garbage, not visible content;
- `woa-admin` remains the only component that marks a document revision current.

This preserves the future path to separate campaign buckets or per-campaign prefixes because bucket/prefix selection remains centralized in `woa-admin`.

## Write Lanes

Campaign Notes need two write lanes.

### 1. Runtime Editor Lane

Used when a campaign member or GM edits a note from the website.

```text
main site editor
  -> woa-admin: request write session
  -> R2: PUT Markdown to approved key
  -> woa-admin: finalize write
  -> woa-admin: update D1/index/search/audit and return canonical metadata
```

The main site may hold an R2 binding or use a signed/scoped write URL/token, but it must not invent the R2 key or update D1.

### 2. Deploy-Time Obsidian/Markdown Lane

Used when session notes are written in Obsidian/Markdown and published by the producer/deploy workflow.

```text
Obsidian/Markdown source
  -> producer/deploy sync
  -> woa-admin: request import session or bulk import plan
  -> R2: PUT Markdown to approved key(s)
  -> woa-admin: finalize import
  -> woa-admin: update D1/index/search/audit and return import results
```

Deploy-time writes must not directly mutate Campaign Notes D1. They may write R2 only through an approved import session or equivalent `woa-admin` import/finalize contract.

## Dual-Authoring Goal

A note can eventually be both:

1. authored in Obsidian/Markdown and deployed, and
2. edited later through the runtime editor.

This is an explicit eventual goal, not a prohibited state.

If easy enough, the first implementation should allow this from the start by modeling revisions and conflicts cleanly. If not, V1 may ship with a simpler operational rule, but the data/API shape must not block later dual-authoring.

## Recommended Lifecycle Model

`woa-admin` should track enough metadata to distinguish body transfer from canonical state.

The detailed data-concept checklist belongs in the handoff document: `plans/features/woa-admin-campaign-notes-api-handoff-2026-06-21.md`.

At minimum, the `woa-admin` model should cover document identity, title, visibility/read semantics, edit policy, current revision, content hash, approved R2 target metadata, source/import metadata, last write lane, audit attribution, object metadata, and conflict status. The exact schema belongs in `woa-admin`, not this main-site repo.

## Conflict Policy

The critical case is cross-lane overwrite.

### Runtime editor save

Runtime saves should use optimistic concurrency:

- main site loads canonical metadata from `woa-admin`;
- editor submits `expectedContentHash` or `expectedRevisionId`;
- `woa-admin` issues a write session only if the expected version is current;
- finalize fails with `409 Conflict` if the current version changed before finalize.

### Deploy-time import

Deploy imports should be idempotent and conflict-aware:

- producer sends `sourcePath`, `sourceHash`, document identity, campaign slug, session slug, title, visibility, and body hash metadata;
- `woa-admin` detects whether the document has runtime edits after the last imported source hash;
- if no conflicting runtime edit exists, import can become current;
- if a runtime edit exists, import should not silently overwrite it.

Recommended behavior for conflicting deploy import:

- record an import conflict or candidate revision;
- keep the runtime-edited version current;
- surface the conflict to an operator/GM workflow later;
- never silently replace runtime edits during deploy.

This allows dual-authoring while avoiding bidirectional sync or silent data loss.

## Minimum Viable Policy

If full dual-authoring conflict workflow is too much for the first slice, use this V1 fallback:

1. The API/schema includes source/revision fields so dual-authoring is not blocked.
2. Runtime edits are allowed for any readable/editable note.
3. Deploy imports may update notes only when the latest current revision descends from the same source hash or has no runtime edit after the previous import.
4. Deploy imports that would overwrite runtime edits return/import as conflict records instead of changing current content.
5. Manual conflict resolution is deferred.

This keeps the eventual goal intact while avoiding a premature merge UI.

## Main-Site Responsibilities

The main site should become an API consumer for Campaign Notes.

Allowed responsibilities:

- render Campaign Notes UI;
- authenticate the user with Better Auth session behavior already used by the site;
- call `woa-admin` Campaign Notes APIs;
- request runtime write sessions;
- upload Markdown to the approved R2 target;
- call finalize;
- display conflicts, stale-save errors, and recoverable upload/finalize failures;
- use client-side validation for UX only, not authority.

Disallowed responsibilities:

- direct D1 mutation for Campaign Notes;
- owning `campaign_note_documents` as a main-site canonical table;
- inventing R2 keys/prefixes/buckets;
- deciding canonical current revision after upload;
- owning search/index/audit updates;
- implementing privileged Campaign Notes admin workflows.

## Producer/Deploy Responsibilities

The deploy-time producer may:

- read Obsidian/Markdown source;
- validate portable Markdown/frontmatter contract;
- request an import session or bulk import plan from `woa-admin`;
- upload Markdown bodies to approved R2 targets;
- finalize import with object metadata, source hash, content hash, and idempotency keys;
- report import conflicts.

The producer must not directly mutate Campaign Notes D1.

## Candidate `woa-admin` API Shape

This is a planning sketch, not a `docs/contracts/` change.

Keep the detailed capability and endpoint sketch in `plans/features/woa-admin-campaign-notes-api-handoff-2026-06-21.md` to avoid parallel contract drift.

This Option C plan only requires that `woa-admin` provide equivalent capabilities for readable document list/read, runtime write sessions, deploy import sessions, finalization/abort behavior, conflict status, and approved R2 write targets. The API should return approved R2 write targets, not accept arbitrary client-provided R2 keys as authoritative.

## R2 Bucket/Prefix Strategy

`woa-admin` should own the mapping from campaign identity to storage location.

Initial implementation can use shared buckets with prefixes, for example:

```text
campaigns/{campaignSlug}/notes/{documentId}/revisions/{revisionId}.md
```

Long-term implementation can move to per-campaign buckets or separate environment buckets without changing main-site behavior, because the main site receives write targets from `woa-admin`.

Recommended environment separation:

- staging writes to staging bucket/prefixes;
- production writes to production bucket/prefixes;
- preview/import behavior follows the publication/environment policy already established for the broader content system.

## Handling Existing Main-Site Foundation Work

Previously added main-site Campaign Notes D1/R2 foundation should not be expanded as the authoritative implementation.

Likely remediation:

1. Stop building on `src/lib/campaign-note-documents-repo.ts` as a main-site D1 repository.
2. Do not implement the old main-site API route plan.
3. Keep reusable Markdown/frontmatter/hash helpers only if they are useful for non-authoritative validation or are moved to the correct owner later.
4. Decide separately whether already-applied `0015_campaign_note_documents.sql` is left unused, deprecated by migration, or transferred conceptually to `woa-admin` ownership.
5. Replace main-site work with an API client pattern similar to existing external API consumption.

## Implementation Phases

### Phase 0 — Planning correction

- Treat the previous main-site R2 document API plan as superseded.
- Record Option C as the Campaign Notes boundary direction.
- Stop additional main-site direct D1/R2 API implementation work.

### Phase 1 — `woa-admin` contract/handoff

- Define `woa-admin` authoritative Campaign Notes data model.
- Define runtime write-session/finalize flow.
- Define deploy import-session/finalize flow.
- Define conflict behavior for deploy-vs-runtime edits.
- Define R2 bucket/prefix/key policy.

### Phase 2 — Main-site API consumer

- Add a Campaign Notes client module in the main site.
- Implement read/list behavior from `woa-admin`.
- Implement runtime save using write session -> R2 PUT -> finalize.
- Surface `409 Conflict` and import-conflict states clearly.

### Phase 3 — Deploy-time producer integration

- Update producer/deploy workflow to call `woa-admin` import sessions.
- Upload Obsidian-authored Markdown to approved R2 targets.
- Finalize imports and report conflicts.
- Keep source-to-publish one-way for static content while allowing Campaign Notes as a deliberate cloud-writable exception.

### Phase 4 — Dual-authoring refinement

- Add richer conflict resolution UI/workflow.
- Support operator/GM review of deploy candidate revisions.
- Consider diff/merge tooling only when the basic write-session/import model is proven.
- Revisit realtime collaboration separately if/when needed.

## Out of Scope

- Realtime collaborative editing.
- Append-only notes.
- Cloudflare Access.
- Main-site privileged admin dashboard.
- Direct main-site Campaign Notes D1 mutation.
- Editing `docs/contracts/`.
- Replacing Better Auth.
- Solving all bidirectional sync concerns for Canon/static content.

## Definition of Done For Next Implementation Slice

The next implementation slice is ready only when:

1. the old main-site API plan is treated as superseded;
2. `woa-admin` is identified as the Campaign Notes authority;
3. both runtime and deploy-time write lanes are represented;
4. direct D1 mutation from main site is explicitly out of scope;
5. direct R2 writes are limited to `woa-admin`-approved write/import sessions;
6. the data/API shape preserves eventual dual-authoring of Obsidian-deployed and runtime-edited notes;
7. conflict behavior prevents silent overwrite across write lanes.

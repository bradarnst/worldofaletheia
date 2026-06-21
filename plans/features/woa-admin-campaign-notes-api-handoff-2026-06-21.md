# `woa-admin` Campaign Notes API Handoff

Date: 2026-06-21
Status: Handoff package for external service/API owner
Owning project for implementation: `woa-admin`
Consuming project: World of Aletheia main site (`worldofaletheia.com`)

## Purpose

This handoff describes what the World of Aletheia main site needs from `woa-admin` to support Campaign Notes without making the public Astro site the authority for Campaign Notes storage, indexing, or privileged workflows.

This is **not** an API contract owned by this repository. It is a consumer-needs package and recommended architecture context for the `woa-admin` team. The final endpoint shape, schema, and storage internals belong to `woa-admin`.

Do not place this material under `docs/contracts/` unless contract ownership is explicitly transferred and documented.

## Executive Summary

The main site needs to consume Campaign Notes as an external capability:

- `woa-admin` owns Campaign Notes D1 state, index/search metadata, audit records, R2 key policy, write finalization, and conflict semantics.
- The main site renders notes and may upload Markdown bodies to R2 only through `woa-admin`-approved write sessions.
- The deploy-time Obsidian/Markdown producer may upload Markdown bodies to R2 only through `woa-admin`-approved import sessions.
- No consumer should directly mutate Campaign Notes D1 state.
- A note may eventually be both authored/deployed from Obsidian and edited later through the runtime editor. The data model and API behavior should preserve that path from the beginning if practical.

## Relevant Main-Site Decisions and Constraints

The `woa-admin` implementation should account for these active main-site constraints:

1. **Better Auth remains authentication.** Do not introduce Cloudflare Access for this site.
2. **Campaign Notes are gated by default, with explicit public-read exceptions.** Access semantics should follow each note's visibility setting:
   - `public` notes are publicly readable when deliberately marked public;
   - `campaignMembers` notes are readable by campaign `member | gm` using exact `campaign_memberships.campaign_slug`;
   - `gm` notes are readable only by campaign `gm`.
3. **Campaign Notes are whole Markdown documents**, not append-only event logs.
4. **Runtime collaborative editing is out of scope** until a separate technology decision is made.
5. **R2 may be written directly by consumers only as body transfer**, never as storage-layout authority.
6. **D1/index/search/audit mutation must be owned by `woa-admin`.**
7. **The main site is an API consumer**, not the owner of Campaign Notes API behavior.

Related project documents:

- `.kilo/plans/campaign-notes-option-c-write-session-boundary-2026-06-21.md`
- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`
- `plans/adrs/0019-campaign-membership-role-unification.md`
- `plans/adrs/0021-external-admin-capability-boundary.md`
- `plans/adrs/0025-portable-markdown-source-contract-and-frontmatter-authority.md`

## Required Consumer Functionality

The main site eventually needs to support:

1. List Campaign Notes visible to the current reader.
2. Read a full Campaign Note Markdown document.
3. Create a Campaign Note document.
4. Save a full replacement Markdown document with optimistic conflict handling.
5. Show stale-edit conflicts without losing the user's draft.
6. Read notes according to their visibility: `public`, `campaignMembers`, or `gm`.
7. Edit notes by original author and `gm` by default, with an allowed future/policy option for all campaign `member | gm` users to edit a note. Public readability must never grant edit rights.
8. Support deploy-time import of Obsidian-authored session notes.
9. Preserve eventual dual-authoring, where an Obsidian-deployed note can later be runtime-edited and future deploy imports can detect conflicts.

## Recommended Ownership Boundary

```text
main site / producer
  - render UI or run deploy import
  - request write/import session
  - upload Markdown body to approved R2 target
  - call finalize
  - consume canonical metadata and conflict results

woa-admin
  - authenticate/authorize or validate delegated identity
  - choose bucket/prefix/key
  - own document identity and current revision
  - update D1/index/search/audit
  - decide conflict behavior
  - expose approved consumer API

R2
  - stores Markdown bodies/revisions/media blobs
  - is not authoritative by itself
```

## Write Lanes Needed

### Runtime Editor Lane

Used by the main site when a campaign member or GM edits in the browser.

```text
main site editor
  -> woa-admin: request write session
  -> R2: PUT Markdown to approved target
  -> woa-admin: finalize write
  -> woa-admin: update D1/index/search/audit and return canonical metadata
```

The main site may receive either:

- a scoped/signed upload target; or
- an approved R2 binding/key instruction if same-account Worker bindings are intentionally used.

In both cases, `woa-admin` must choose or approve the target. The main site must not invent R2 keys, prefixes, or buckets.

### Deploy-Time Obsidian/Markdown Import Lane

Used by the content producer/deploy process when session notes are authored as Markdown.

```text
Obsidian/Markdown source
  -> producer/deploy sync
  -> woa-admin: request import session or bulk import plan
  -> R2: PUT Markdown to approved target(s)
  -> woa-admin: finalize import
  -> woa-admin: update D1/index/search/audit and return import results
```

Deploy imports should be idempotent. Re-running the same deploy should not create duplicate canonical documents or accidental new revisions unless source content changed.

## Dual-Authoring Requirement

Eventual desired behavior:

1. A session note is authored in Obsidian and imported during deploy.
2. A campaign member or GM later edits the same note through the runtime editor.
3. A later deploy import sees that the source Markdown changed and detects whether applying it would overwrite runtime edits.
4. The service records or returns a conflict instead of silently replacing the runtime-edited current version.

Recommended first-slice policy if full merge tooling is not ready:

- allow runtime edits on imported notes;
- keep enough revision/source metadata to detect post-import runtime edits;
- allow deploy import to update current content only when no conflicting runtime edit exists;
- keep runtime-edited content current when a deploy conflict exists;
- return/import conflict records for later operator/GM resolution.

This avoids silent data loss while keeping the eventual dual-authoring goal open.

## Recommended Authoritative Data Concepts

The exact schema is up to `woa-admin`, but the main site and producer will need responses that expose equivalent concepts.

Core document identity:

- `documentId`
- `campaignSlug`
- `scope`: `campaign | session`
- `sessionSlug` when `scope = session`
- `title`
- `visibility`: `public | campaignMembers | gm`
- `editPolicy`: default author-plus-GM behavior, with optional campaign-member editing when explicitly enabled

Revision and storage:

- `currentRevisionId`
- `contentHash`
- `r2Bucket` or bucket alias
- `r2Key`
- object metadata such as ETag or last modified where useful

Source lifecycle:

- `sourceKind`: `obsidianDeploy | runtimeEditor | mixed`
- `sourcePath` for imported Obsidian/Markdown notes
- `sourceHash` for last imported source body
- `sourceRevision` or producer-side revision identifier when available
- `lastWriteLane`: `deploy | runtime`
- `lastFinalizedAt`

Audit/conflict:

- created/updated actor identity or service identity
- write/import session ID
- idempotency key
- conflict status or conflict record ID when an import/save cannot become current

## API Capability Checklist

The main site does not require these exact paths, but it does require equivalent capabilities.

### Read/list capabilities

- List readable notes for a campaign.
- Filter by session slug when needed.
- Return metadata without body for list views.
- Read one note's canonical Markdown body plus metadata.
- Apply visibility/role checks server-side, including deliberate public-read behavior.

### Runtime write capabilities

- Request a write session for create/update.
- Include expected revision/hash for updates.
- Enforce the document edit policy before issuing write sessions.
- Return an approved R2 upload target.
- Finalize a successful upload.
- Abort or expire incomplete write sessions.
- Return `409 Conflict` or equivalent stale-write signal when current revision changed.

### Deploy/import capabilities

- Request single or bulk import sessions for Obsidian-authored Markdown.
- Include source path/hash/revision metadata.
- Return approved R2 upload targets.
- Finalize imports idempotently.
- Detect deploy-vs-runtime conflicts.
- Return conflict records/results instead of silently overwriting runtime edits.

### Operational capabilities

- Reconcile/garbage-collect orphaned unfinalized R2 objects.
- Query import/write session status.
- Support staging and production separation.
- Preserve audit records sufficient to diagnose who/what made a note current.

## Candidate API Shape

This is intentionally illustrative, not authoritative.

Runtime lane:

- `GET /campaigns/{campaignSlug}/notes/documents`
- `GET /campaigns/{campaignSlug}/notes/documents/{documentId}`
- `POST /campaigns/{campaignSlug}/notes/write-sessions`
- `POST /campaigns/{campaignSlug}/notes/write-sessions/{writeSessionId}/finalize`
- `POST /campaigns/{campaignSlug}/notes/write-sessions/{writeSessionId}/abort`

Deploy/import lane:

- `POST /campaigns/{campaignSlug}/notes/import-sessions`
- `POST /campaigns/{campaignSlug}/notes/import-sessions/{importSessionId}/finalize`
- `GET /campaigns/{campaignSlug}/notes/import-sessions/{importSessionId}`
- optional bulk import endpoints for deploy runs

## R2 Bucket and Prefix Requirements

The main site has no requirement to own the bucket/prefix layout. It does need the API to support evolution toward stronger campaign isolation.

Recommended storage policy:

1. Start with shared buckets and campaign prefixes if that is operationally simpler.
2. Keep bucket/prefix/key mapping behind `woa-admin` APIs.
3. Preserve the option to move to per-campaign buckets later without changing main-site route/UI logic.
4. Separate staging and production targets.
5. Treat unfinalized R2 objects as garbage-collectable, not canonical content.

Example prefix only:

```text
campaigns/{campaignSlug}/notes/{documentId}/revisions/{revisionId}.md
```

## Main-Site Integration After `woa-admin` Contract Exists

After `woa-admin` publishes the approved contract, the main site should:

1. Remove or quarantine direct Campaign Notes D1 repository usage.
2. Replace planned in-repo Campaign Notes API routes with an external API client.
3. Implement read/list UI against `woa-admin`.
4. Implement runtime save as write session -> R2 upload -> finalize.
5. Surface conflict and finalize-failure states in the editor UX.
6. Avoid direct Campaign Notes D1 mutation entirely.

## Existing Main-Site Work To Treat Carefully

The main-site repo currently contains a previously implemented foundation that should not become the authority if `woa-admin` owns Campaign Notes:

- `migrations/0015_campaign_note_documents.sql`
- `src/lib/campaign-note-documents.ts`
- `src/lib/campaign-note-documents-repo.ts`
- `src/lib/campaign-note-documents.test.ts`
- `src/lib/campaign-note-documents-repo.test.ts`

Recommended interpretation:

- `src/lib/campaign-note-documents-repo.ts` should not be expanded or used as the authoritative runtime repository.
- `migrations/0015_campaign_note_documents.sql` needs a later remediation decision: leave unused, deprecate, or transfer conceptually to `woa-admin` ownership.
- Markdown/frontmatter/hash helpers may remain useful as non-authoritative validation helpers only if they match the final `woa-admin` contract.

## Open Questions For `woa-admin`

1. Will the main site upload directly to R2 via signed/scoped targets, or through same-account Worker bindings with approved keys?
2. Where will Better Auth session validation happen for `woa-admin` calls?
3. How will deploy-time producer identity authenticate to import endpoints?
4. What is the canonical document identity format for notes imported from Obsidian paths?
5. What edit-policy values are supported beyond the default original-author-plus-GM behavior?
6. Is revision history stored as immutable R2 objects, D1 rows, or both?
7. What conflict record model is needed for deploy-vs-runtime edits?
8. What import idempotency key should the producer provide?
9. What audit fields are required for member/GM runtime edits versus deploy imports?
10. What staging/production R2/D1 targets and preview behavior should be used?
11. What is the minimum API subset needed before the main-site editor can begin integration?

## Acceptance Criteria For `woa-admin` Readiness

The main site can safely begin its refactor only when `woa-admin` provides:

1. approved read/list API behavior;
2. approved runtime write-session/finalize behavior;
3. approved deploy import-session/finalize behavior or a stated phased substitute;
4. documented auth/session/delegation requirements;
5. documented visibility/read semantics and edit-policy semantics;
6. documented R2 upload target behavior;
7. documented conflict behavior for stale runtime edits and deploy-vs-runtime conflicts;
8. environment target guidance for staging and production;
9. enough example request/response payloads for main-site API-client tests.

## Near-Term Main-Site Position

Until `woa-admin` completes or publishes the approved contract, the main site should not continue implementing Campaign Notes direct-storage APIs. Main-site work should be limited to boundary cleanup, planning updates, and later API-client integration against the actual `woa-admin` contract.

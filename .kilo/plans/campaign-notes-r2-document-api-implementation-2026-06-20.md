# Campaign Notes R2 Document API Implementation Plan

Date: 2026-06-20
Status: Superseded on 2026-06-21

> Superseded by `.kilo/plans/campaign-notes-option-c-write-session-boundary-2026-06-21.md` and `plans/features/woa-admin-campaign-notes-api-handoff-2026-06-21.md`.
>
> This plan assumed the main site would implement Campaign Notes API routes and directly coordinate D1/R2 writes. That is no longer the intended ownership boundary. `woa-admin` should define and implement the authoritative Campaign Notes API/contract first; the main site should later refactor to consume that approved contract and must not directly mutate Campaign Notes D1 state.

## Decision

Historical/superseded decision: this plan previously said the next step was to implement the **server-side R2 document API layer** for Campaign Notes inside the main site.

Current decision: do **not** implement this plan in the main site. `woa-admin` should define and implement the authoritative Campaign Notes API/service contract first, including runtime write sessions, deploy import sessions, R2 upload target policy, D1/index/search/audit ownership, and conflict behavior. The main site should later refactor to consume that approved contract.

## Why This Is Next

The deployed foundation already provides:

- D1 `campaign_note_documents` index/coordination table.
- R2 object key builder.
- Markdown/frontmatter validation.
- SHA-256 content hash/version helper.
- D1 repository with campaign slug predicates, member/gm visibility checks, and optimistic conflict detection.

What was missing under the old assumption was the runtime boundary that actually reads and writes Markdown documents in R2. That boundary is now assigned to `woa-admin`, not this main-site implementation plan.

## Implementation Target

Old superseded target: add authenticated Campaign Notes document API routes under the Campaigns API namespace in the main site.

Do not implement this target unless a later ADR explicitly moves Campaign Notes API ownership back into this repository.

Recommended route shape:

- `GET /api/campaigns/[campaign]/notes/documents`
- `POST /api/campaigns/[campaign]/notes/documents`
- `GET /api/campaigns/[campaign]/notes/documents/[documentId]`
- `PUT /api/campaigns/[campaign]/notes/documents/[documentId]`

Use Astro API routes, not Astro Islands, for this slice.

## Required Source Files To Inspect First

- `plans/features/campaign-notes-tenancy-lld-2026-06-20.md`
- `src/lib/campaign-note-documents.ts`
- `src/lib/campaign-note-documents-repo.ts`
- `src/lib/auth-session.ts`
- `src/lib/campaign-membership-repo.ts`
- `src/lib/campaign-media.ts`
- `src/lib/campaign-media-handler.ts`
- `src/pages/api/search.ts`

## Proposed Implementation Surface

### 1. R2 Bucket Helper

Add a focused helper for campaign note document objects, likely:

- `src/lib/campaign-note-document-storage.ts`

Responsibilities:

- Resolve `woa_campaign_private` R2 binding from `cloudflare:workers`.
- Provide typed `get`, `put`, and maybe `head` wrappers for Markdown objects.
- Only accept R2 keys built by `buildCampaignNoteDocumentR2Key()` or retrieved from D1; never accept arbitrary client-provided R2 keys.
- Use `content-type: text/markdown; charset=utf-8` for Markdown writes.
- Return R2 `etag`/HTTP metadata where available.

### 2. API Helper / Handler

Add a focused handler module, likely:

- `src/lib/campaign-note-document-api.ts`

Responsibilities:

- Parse route params.
- Resolve Better Auth session with `getRequestSession()`.
- Check exact campaign membership with `CampaignMembershipRepo`.
- Use `CampaignNoteDocumentsRepo` for index reads/writes.
- Use storage helper for R2 reads/writes.
- Normalize JSON responses and status codes.

Keep route files thin, similar to campaign media handler style.

### 3. Route Files

Recommended files:

- `src/pages/api/campaigns/[campaign]/notes/documents/index.ts`
- `src/pages/api/campaigns/[campaign]/notes/documents/[documentId].ts`

Supported methods:

#### `GET /api/campaigns/[campaign]/notes/documents`

List readable document index rows.

Query params:

- `scope=campaign|session` optional.
- `session=...` optional; when omitted, do not filter by session.
- `limit=...` optional; repo already clamps to max 100.

Access:

- Anonymous can only list `public` documents.
- Authenticated campaign `member` or `gm` can list `campaignMembers` documents.
- `gm` visibility requires GM role.

Response should include metadata only, not Markdown bodies.

#### `POST /api/campaigns/[campaign]/notes/documents`

Create a Markdown document.

Request body candidate:

```ts
interface CreateCampaignNoteDocumentRequest {
  scope: 'campaign' | 'session';
  sessionSlug?: string | null;
  documentId: string;
  title: string;
  visibility?: 'public' | 'campaignMembers' | 'gm';
  markdown: string;
}
```

Rules:

- Require authenticated campaign member or GM.
- Default `visibility` to `campaignMembers`.
- For first slice, either reject `visibility: public` unless GM, or keep it as an explicit TODO/open policy. Prefer reject unless GM to avoid accidental public publication.
- Reject `visibility: gm` unless GM.
- Validate frontmatter with `validateCampaignNoteMarkdown()` using expected campaign/document id.
- Ensure frontmatter campaign and document id match the route/request.
- Build R2 key server-side.
- Compute content hash server-side.
- Write Markdown to R2.
- Insert D1 document row.
- If D1 insert fails after R2 write, return a recoverable server error and log key/document id without body content.

#### `GET /api/campaigns/[campaign]/notes/documents/[documentId]`

Read one Markdown document.

Rules:

- Use `CampaignNoteDocumentsRepo.getReadableDocument()` first.
- Fetch R2 by the D1 `r2Key` only.
- Return metadata plus Markdown body.
- Never let the client pass an R2 key.
- Return `404` if no readable index row or R2 object is missing.
- Return `403` only when authentication exists but role is explicitly insufficient if the implementation can distinguish that safely; otherwise `404` is acceptable to avoid information leakage.

#### `PUT /api/campaigns/[campaign]/notes/documents/[documentId]`

Save full Markdown document.

Request body candidate:

```ts
interface UpdateCampaignNoteDocumentRequest {
  title: string;
  visibility?: 'public' | 'campaignMembers' | 'gm';
  markdown: string;
  expectedContentHash: string;
}
```

Rules:

- Require authenticated campaign member or GM.
- Validate the caller can read/edit the exact campaign document.
- Reject stale or missing `expectedContentHash`.
- Validate frontmatter against exact route campaign and document id.
- Compute new content hash.
- Avoid blind overwrite:
  - read current D1 row;
  - if current `contentHash` differs from `expectedContentHash`, return `409 Conflict` before R2 write;
  - write full Markdown object to R2;
  - update D1 row using `updateDocumentIndexAfterSave()` with `expectedContentHash`;
  - if D1 update returns `conflict`, return `409 Conflict` and log that R2 may require reconciliation.

This final R2-then-D1 race is not fully atomic. The handler must document/log the recoverable reconciliation case.

## Authorization Rules

- Better Auth is authentication.
- D1 `campaign_memberships` is authorization.
- `campaignMembers` read/write requires `role IN ('member', 'gm')` for exact `campaign_slug`.
- `gm` visibility requires `role = 'gm'`.
- `public` reads require no session.
- Setting `public` visibility should be GM-only until owner approves member self-publication.
- `gmSpoilers`, `publication`, `status`, legacy `secret`, and `audienceWarnings` are not authorization inputs.

## Error Behavior

Use JSON responses and noindex headers.

Recommended status mapping:

- `400`: invalid JSON/body/query/frontmatter.
- `401`: write attempted without a valid session.
- `403`: authenticated but not allowed for a write or restricted visibility change.
- `404`: document/campaign not found or not readable.
- `409`: expected content hash is stale.
- `500`: unexpected D1/R2 write/read failure.
- `503`: binding unavailable or auth/session service unavailable.

Do not log Markdown bodies, cookies, tokens, full frontmatter payloads, or email addresses.

## Tests To Add

### Helper/storage tests

- Bucket helper rejects missing binding.
- Storage helper uses only server-built/D1-provided keys.
- Markdown writes use `text/markdown; charset=utf-8`.

### API handler tests

Use handler-level tests rather than full Astro route harness if route testing becomes heavy.

Required cases:

- Anonymous can list/read public documents only.
- Anonymous cannot create/update.
- Authenticated non-member cannot create/update/read `campaignMembers` docs.
- Campaign member can create/read/update `campaignMembers` docs for exact campaign.
- GM can create/read/update `gm` docs for exact campaign.
- Member cannot set `gm` visibility.
- Member cannot set `public` visibility if public promotion is GM-only in this slice.
- Cross-campaign document id guessing fails.
- Invalid frontmatter campaign/document id returns `400`.
- Stale `expectedContentHash` returns `409` and does not write R2.
- R2 missing object after readable D1 row returns `404` or recoverable error according to chosen behavior.

## Verification Commands

Use pnpm only.

Minimum:

```bash
pnpm test -- src/lib/campaign-note-documents.test.ts src/lib/campaign-note-documents-repo.test.ts
pnpm test -- <new campaign note API/storage tests>
pnpm build
```

No deploy should be performed unless explicitly requested.

## Out of Scope For This Slice

- Astro Island editor UI.
- Realtime collaborative editing.
- Obsidian/R2 sync plugin/tooling.
- Campaign member mutation endpoints.
- Cloudflare Access.
- Admin/taxonomy console.
- Edits under `docs/contracts/`.

## Definition Of Done

- API routes exist for list/create/read/update Campaign Note documents.
- Reads and writes use R2 Markdown objects with D1 index metadata.
- All D1 queries are exact `campaign_slug` scoped.
- No client-provided R2 key is trusted.
- `campaignMembers` access works for `member | gm`.
- Stale saves return `409 Conflict`.
- Tests cover access, tenancy, frontmatter mismatch, and stale-version behavior.
- `pnpm build` passes.

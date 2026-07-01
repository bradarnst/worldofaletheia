# Main-Site Campaign Notes Integration Plan

## Goal

Integrate `woa-admin` Campaign Notes into `worldofaletheia.com` as a separate, API-backed read surface that replaces the old published session-note path.

This plan treats:
- `docs/contracts/campaign-notes-api.openapi.yaml` as the binding contract
- the handoff bundle in `docs/handoff/tmp-main-site-campaign-notes-handoff-20260701/` as implementation guidance
- accepted ADRs as binding architecture decisions
- older import-session assumptions as superseded and out of scope

## Locked Decisions

1. Campaign Notes are separate from broader Campaign Content.
2. `woa-admin` owns Campaign Notes read/write API behavior and canonical note state.
3. Main-site Campaign Notes routes are SSR runtime routes from the start.
4. The published note surface changes from `/campaigns/{campaign}/sessions` to:
   - `/campaigns/{campaignSlug}/notes`
   - `/campaigns/{campaignSlug}/notes/{documentId}`
5. Do not preserve old session-note URLs or add legacy aliases.
6. Render Campaign Notes Markdown as website pages only, not public raw Markdown downloads.
7. Slice 1 is read-only; website create/edit UX and write-session integration are deferred.
8. Old session-note ingestion/publication is disabled in the same slice that adds `/notes`.

## Current Repo Reality

Old note publication path still exists in the main site:
- `src/content.config.ts` defines the `sessions` collection from old campaign content files
- `src/pages/campaigns/[campaign]/sessions/index.astro`
- `src/pages/campaigns/[campaign]/sessions/[...slug].astro`
- `src/pages/campaigns/[...slug].astro` links to `Sessions`
- `src/pages/sitemap.xml.ts` emits `/campaigns/{campaign}/sessions*`
- `scripts/content-sync/cloud-content-metadata.mjs`, `validate.mjs`, `fs-diff.mjs`, `obsidian-links.mjs` still classify/index campaign `sessions`

Superseded in-repo Campaign Notes foundation also exists and must not become authoritative:
- `migrations/0015_campaign_note_documents.sql`
- `src/lib/campaign-note-documents.ts`
- `src/lib/campaign-note-documents-repo.ts`
- `src/lib/campaign-note-documents.test.ts`
- `src/lib/campaign-note-documents-repo.test.ts`
- `scripts/db-migrate-auth-plan.mjs` still references `0015_campaign_note_documents.sql`

Existing main-site capabilities that should be reused:
- Better Auth session lookup in `src/lib/auth-session.ts`
- campaign membership / GM authorization in `src/utils/campaign-access.ts` and `src/lib/campaign-request-access.ts`
- SSR runtime execution via `astro.config.mjs` (`output: 'server'`)

## Staged Implementation Plan

### Stage 1. Freeze and remove the old Campaign Notes publication path

1. Stop treating old `sessions` content as a published Campaign Notes source.
2. Remove the website note publication surface under:
   - `src/pages/campaigns/[campaign]/sessions/index.astro`
   - `src/pages/campaigns/[campaign]/sessions/[...slug].astro`
3. Replace campaign landing-page links/cards that currently point to `Sessions` with `Notes`.
4. Remove old session-note sitemap entries from `src/pages/sitemap.xml.ts`.
5. Disable old `sessions` ingestion/classification for Campaign Notes in the content-sync path.
6. Treat remaining old vault session-note files as archive or migration source only, not live publication input.

Implementation notes:
- Broader campaign family content stays in the existing main-site content model for now.
- This cut only removes old session-note publication, not all campaign content ingestion.

### Stage 2. Add a dedicated `woa-admin` Campaign Notes read client

Create a dedicated adapter/client for Campaign Notes reads, separate from broader campaign content and separate from the superseded in-repo D1 repo approach.

Responsibilities:
1. Call:
   - `GET /api/v1/campaigns/{campaignSlug}/notes/documents`
   - `GET /api/v1/campaigns/{campaignSlug}/notes/documents/{documentId}`
2. Parse contract response types for:
   - `DocumentMetadata`
   - `DocumentPage`
   - `DocumentDetail`
   - error payloads
3. Build outbound request headers for anonymous versus authenticated reads.
4. Reuse existing main-site session and campaign authorization checks to determine whether an authenticated request should be attempted.
5. Fail closed for protected notes when authenticated bridging is unavailable or invalid.

Recommended file shape:
- new adapter under `src/adapters/` for external API consumption, matching ADR-0021 external-boundary intent
- keep it narrowly scoped to Campaign Notes reads only

Do not:
- reuse `src/lib/campaign-note-documents-repo.ts`
- read Campaign Notes from main-site D1
- rebuild note indexing/storage inside this repo

### Stage 3. Add the outbound auth/header bridge to `woa-admin`

Use existing main-site auth/authz to produce the outbound headers expected by the Campaign Notes API.

Required behavior:
1. Anonymous request:
   - call `woa-admin` with no actor headers
   - only public notes should be returned
2. Authenticated and authorized request:
   - resolve Better Auth session user
   - resolve campaign membership / GM status for the exact `campaignSlug`
   - when the user is authorized for the exact campaign, attach `x-woa-runtime-actor` and `x-woa-runtime-signature`
3. Authenticated but unauthorized request:
   - do not send `x-woa-runtime-actor`
   - do not send `x-woa-runtime-signature`
   - treat the outbound call as anonymous
4. Missing or invalid signing material:
   - if the main site cannot produce a valid unexpired assertion, omit both headers and fail closed to anonymous behavior

Implementation contract for this repo:
1. Environment buckets:
   - use `staging` and `production` only
   - do not use the older handoff `preview` naming in main-site implementation
2. Secret and environment inputs:
   - secret name: `CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET`
   - non-secret environment marker must resolve to exactly `staging` or `production`
   - the selected secret and environment marker must match the current Wrangler deployment environment for this repo
3. Authorization-to-role mapping:
   - `gm` campaign access signs `role: "gm"`
   - member-only campaign access signs `role: "member"`
   - do not sign broader or inferred roles
4. Assertion payload shape:
   - the JSON payload must contain exactly:
     - `userId`
     - `campaignSlug`
     - `role`
     - `environment`
     - `issuedAt`
     - `expiresAt`
   - no extra claims should be added in this slice
5. Timestamp rules:
   - `issuedAt` and `expiresAt` must be RFC 3339 UTC timestamps
   - `expiresAt = issuedAt + 5 minutes`
   - the assertion must not be sent if it is already expired or cannot be created with a full valid window
6. Header encoding:
   - `x-woa-runtime-actor = base64url(JSON.stringify(payload))`
7. Signature rule:
   - `x-woa-runtime-signature = base64url(HMAC-SHA-256(secret, x-woa-runtime-actor))`
   - the HMAC input is the encoded actor header value itself, not the raw JSON string
8. Failure handling:
   - signed-in but unauthorized users must be downgraded to anonymous
   - missing secret, invalid environment marker, signature generation failure, or expired assertion must not produce partial actor headers
   - never send one of the two headers without the other

Out of scope for this slice:
- adding broader identity claims
- using campaign metadata as a substitute for signed membership assertions
- introducing a second signing format or compatibility mode

### Stage 4. Add SSR read-only Campaign Notes routes

Add:
- `src/pages/campaigns/[campaign]/notes/index.astro`
- `src/pages/campaigns/[campaign]/notes/[documentId].astro`

Route requirements:
1. SSR only; do not use `getStaticPaths()`.
2. Read note data live from the `woa-admin` client.
3. Keep routes scoped under campaign pages, but distinct from broader campaign family content.
4. Use exact `campaignSlug` route scoping from the contract.

List route requirements:
1. Render note metadata from `DocumentPage.items`.
2. Support the contract’s filtering inputs only when intentionally exposed in UI.
3. Preserve pagination/cursor behavior from the API, even if the first UI iteration is minimal.
4. Show only notes visible to the current caller.

Detail route requirements:
1. Read one `DocumentDetail` by exact `documentId`.
2. Use note metadata from the API as the page source of truth.
3. Treat `404` as unreadable-or-missing per contract; do not leak whether a protected note exists.

### Stage 5. Render Campaign Notes Markdown as website pages

1. Render returned Markdown into normal website content pages.
2. Do not expose the raw returned Markdown as a public download surface.
3. Preserve the existing Campaigns visual/layout language where appropriate, but distinguish `Notes` from other campaign content.
4. Use note metadata from the contract for visible labels such as:
   - title
   - visibility
   - note type
   - session date or session slug when present
5. Preserve website-owned link resolution for root-relative links in Markdown.

Implementation note:
- The contract returns `body` as canonical Markdown including frontmatter.
- The renderer should strip or ignore frontmatter for display and render the Markdown content as HTML.
- Frontmatter remains authoritative metadata, but not public presentation.

### Stage 6. Preserve visibility semantics

Required semantics from the contract:
1. Anonymous callers can see only unarchived public notes.
2. Authenticated campaign members can see unarchived public and `campaignMembers` notes.
3. Campaign GMs and authors can access behavior allowed by the contract.
4. Archived note behavior must remain contract-driven.

Slice guidance:
- Public-only initial delivery is acceptable if needed for the first deployable slice.
- Protected note reads should then follow by completing the outbound auth/header bridge, not by inventing local visibility shortcuts.
- The main site should not override `woa-admin` visibility decisions with its own independent note-access model.

### Stage 7. Keep Campaign Notes separate from broader Campaign Content

Do not merge Campaign Notes into:
- `sessions`
- campaign family collections
- generic campaign content loaders
- broader Campaign Content vault assumptions

Instead:
- Campaign Notes = API-backed note documents from `woa-admin`
- broader Campaign Content = existing main-site-managed campaign pages and family collections for now

Practical UI consequence:
- campaign landing pages should present `Notes` as a distinct section/card, not as a relabeled `Sessions` collection
- broader campaign navigation should remain intact for non-note content

## Removal / Quarantine / Leave-Unused Decisions

### Remove or replace in this slice

1. Old published note pages:
   - `src/pages/campaigns/[campaign]/sessions/index.astro`
   - `src/pages/campaigns/[campaign]/sessions/[...slug].astro`
2. Old sitemap/session-note publication references in `src/pages/sitemap.xml.ts`
3. Campaign landing-page `Sessions` publication references in `src/pages/campaigns/[...slug].astro`
4. Old session-note ingestion/classification from content-sync code where it exists specifically as a Campaign Notes publication path

### Quarantine / leave unused for now

Do not build on these files:
- `src/lib/campaign-note-documents.ts`
- `src/lib/campaign-note-documents-repo.ts`
- related tests
- `migrations/0015_campaign_note_documents.sql`

Plan status for them:
- leave unused in the main-site implementation slice unless explicitly removing them is low-risk and coordinated
- document them as superseded remnants from the direct-storage plan
- do not expand them to support the new API-backed design

### Separate remediation follow-up

A later cleanup pass should decide whether to:
1. remove `0015_campaign_note_documents.sql` from main-site migration planning entirely
2. keep it as historical dead code until a safe cleanup window
3. add operator remediation for environments where the empty legacy table still exists

This remediation is secondary to the main Campaign Notes route cutover.

## Validation Plan

### Contract and integration validation

1. Confirm the handoff copy of `campaign-notes-api.openapi.yaml` matches `docs/contracts/campaign-notes-api.openapi.yaml`.
2. Validate the adapter against contract success and error shapes.
3. Validate anonymous list/detail reads for public notes.
4. Validate authenticated reads once outbound header bridging is implemented, including both `member` and `gm` roles.
5. Validate `404` / `403` / `401` handling does not leak protected-note existence.
6. Validate header bridge specifics:
   - no actor headers on anonymous requests
   - no actor headers for signed-in but unauthorized users
   - `x-woa-runtime-actor` payload fields exactly match the repo-local Stage 3 contract
   - `x-woa-runtime-signature` is computed as `base64url(HMAC-SHA-256(secret, x-woa-runtime-actor))`
   - expired assertions are never sent
   - `staging` uses staging signing inputs and `production` uses production signing inputs

### Route and rendering validation

1. `/campaigns/{campaignSlug}/notes` renders with live API data.
2. `/campaigns/{campaignSlug}/notes/{documentId}` renders Markdown as HTML pages.
3. No public raw Markdown download surface exists.
4. Existing campaign pages link to `Notes`, not `Sessions`.
5. Campaign Notes pages set indexing behavior consistent with visibility.

### Cutover validation

1. Old `/campaigns/{campaign}/sessions*` note pages are no longer the published note surface.
2. Old session-note sitemap entries are gone.
3. Old content-sync no longer publishes session notes into the website.
4. Broader campaign content still works after note-path removal.

## Risks

1. Hidden dual-source behavior if old `sessions` ingestion is only partially removed.
2. Contract drift if the main site guesses outbound auth header semantics instead of confirming them.
3. UI confusion if `Notes` and broader campaign content are not clearly separated in navigation and labeling.
4. SEO/indexing mistakes if protected-note routes are crawlable.
5. Rendering edge cases if returned Markdown frontmatter is not stripped cleanly before display.

## Explicit Out of Scope

1. Website create/edit UX for Campaign Notes.
2. `woa-admin` write-session integration.
3. Public raw Markdown exports/downloads.
4. Reworking broader Campaign Content architecture.
5. Reintroducing any old import-session or direct main-site storage assumptions.

## Recommended Execution Order

1. Remove old note publication and ingestion path.
2. Add the external Campaign Notes read adapter.
3. Implement anonymous public-note list/detail SSR routes.
4. Add campaign landing-page/navigation updates from `Sessions` to `Notes`.
5. Add authenticated outbound header bridging for protected reads.
6. Complete cleanup/quarantine documentation for superseded in-repo Campaign Notes code.

## Open Follow-Up For `woa-admin` Only If Needed

Only raise a `woa-admin` follow-up if implementation discovers a contradiction between:
- the Stage 3 repo-local signing contract above, and
- actual `woa-admin` verifier behavior in integration testing.

Do not change the OpenAPI contract from the main-site side; raise any verifier mismatch explicitly.

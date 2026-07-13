# Main-Site Campaign Notes Integration Plan — Superseded by 2026-07-12 Contract

## Status

- **Status:** Approved / implementation-ready
- **Updated:** 2026-07-13T10:39:47+02:00
- **Approval:** User approved the recommendation to delay `/notes`, perform the containment pass, and wait for the broader `woa-admin` Campaign Content API before unified implementation.
- **Supersedes:** Earlier Campaign Notes plan based on the pre-2026-07-12 `campaign-notes-api.openapi.yaml`
- **Binding contract:** `docs/contracts/campaign-notes-api.openapi.yaml` version `0.3.1`
- **Consumer guide:** `docs/handoff/tmp-main-site-campaign-notes-handoff-20260712/campaign-notes-main-site-handoff.md`

## Executive Recommendation

**Recommendation: choose Option 3 — delay production implementation of the new Campaign Notes routes until the broader Campaign Content API/routing cutover is ready, while doing a small safety/alignment pass now.**

The small pass should:

1. Treat all earlier Campaign Notes code/plans based on the older spec as superseded.
2. Prevent the current old-contract `/campaigns/{campaign}/notes` surface from being treated as production-ready.
3. Update implementation planning and tests to the new v0.3.1 contract before any further Campaign Notes route work.
4. Avoid adding a feature flag unless the wait for the broader campaign cutover expands beyond “a few days.”

Rationale:

- The current Campaign Notes implementation in this repo is already out of contract with v0.3.1.
- The project has very little campaign content right now, so the product benefit of shipping a split-routing Notes-only integration is low.
- The split model would create short-lived routing and IA complexity: Notes from `woa-admin`, other campaign content from current Astro collections/content-index paths.
- The sister-site expects the broader campaign article cutover very soon; waiting avoids work that may be immediately replaced.
- The overriding risk is main-site breakage, not delayed campaign content availability.

## Source-of-Truth Inputs

### New OpenAPI Contract

`docs/contracts/campaign-notes-api.openapi.yaml` is externally owned and must not be edited from this repo.

Important v0.3.1 contract facts:

- API is **read-only** for Campaign Notes.
- Base endpoints remain:
  - `GET /api/v1/campaigns/{campaignSlug}/notes/documents`
  - `GET /api/v1/campaigns/{campaignSlug}/notes/documents/{documentId}`
- Notes are indexed from per-campaign Campaign Content Buckets; main site must not invent bucket names, R2 keys, or storage paths.
- `DocumentMetadata` is intentionally minimal:
  - `documentId`
  - `title`
  - `type`
  - `authors`
  - `sessionSlug`
  - `sessionDate`
  - `createdAt`
  - `updatedAt`
- Detail adds `body`.
- List query params are now:
  - `title`
  - `author`
  - `type`
  - `sessionSlug`
  - `sessionDate`
  - `limit`
  - `cursor`
- `DocumentId` convention is now `{YYYYMMDDHHmmss}-{titleSlug}`.
- Visibility values include `public`, `campaignMembers`, and `gm`.
- Production reads expose `publication: publish` only; preview/staging reads may expose `publication: preview` and `publication: publish`.

### New Runtime Actor Assertion Contract

The previous saved plan used an obsolete repo-local assertion payload with `environment`, `issuedAt`, and `expiresAt`. That is superseded.

The v0.3.1 payload is:

```json
{
  "aud": "woa-admin:campaign-notes:v1",
  "exp": 1780000000,
  "campaignSlug": "the-weight-of-sun-and-soil",
  "userId": "better-auth-user-id",
  "role": "member",
  "operation": "notes:read"
}
```

Rules:

- `x-woa-runtime-actor = base64url(JSON.stringify(payload))`
- `x-woa-runtime-signature = base64url(HMAC-SHA-256(secret, x-woa-runtime-actor))`
- HMAC input is the exact encoded actor header value.
- `aud` must be exactly `woa-admin:campaign-notes:v1`.
- `operation` must be exactly `notes:read` for these endpoints.
- `exp` is a Unix timestamp in seconds and must be in the future.
- `campaignSlug` must exactly match the path parameter.
- `role` is `member` or `gm` and must still match `campaign_memberships` in `woa-admin`.
- Anonymous reads send neither runtime actor header.
- Signed-in but unauthorized users should be downgraded to anonymous by omitting both headers.
- Never send only one of the two runtime actor headers.

## Current Repo Assessment

### Existing Older-Contract Work

The repo currently contains Campaign Notes work that appears to be based on the older spec:

- `src/adapters/campaign-notes-api.ts`
  - uses old fields such as `noteType`, `authorUserIds`, archive/revision metadata, `sourceKind`, and `lastWriteLane`
  - sends `noteType` query instead of the v0.3.1 `type` query
- `src/lib/campaign-notes-runtime-assertion.ts`
  - signs an obsolete payload using `environment`, `issuedAt`, and `expiresAt`
  - does not include `aud`, `exp`, or `operation`
- `src/pages/campaigns/[campaign]/notes/index.astro`
- `src/pages/campaigns/[campaign]/notes/[documentId].astro`
  - render metadata using old `noteType` semantics
- `src/pages/campaigns/[...slug].astro` and/or `src/pages/campaigns/index.astro` if they link campaign users to `/notes`

This means any `/notes` work should be considered **new-route contract drift**, not a stable base.

Legacy `/campaigns/{campaign}/sessions` is a separate question:

- If the legacy `/sessions` route still exists and works in the current branch/deployment, it can safely remain as the temporary campaign-session surface while the new `/notes` API integration is delayed.
- Do not replace a working `/sessions` surface with `/notes` until `/notes` is rewritten to v0.3.1 or the broader Campaign Content API cutover is ready.
- If `/sessions` has already been removed in the current implementation branch, do not restore it unless there is a concrete production need.

### Current Git/Working Tree Reality at Review Time

At the time of this assessment, only the new contract and handoff directory are uncommitted:

- `docs/contracts/campaign-notes-api.openapi.yaml`
- `docs/handoff/tmp-main-site-campaign-notes-handoff-20260712/`

The older Campaign Notes source files are already present in the repo state and must be revised or neutralized before any production rollout that depends on the v0.3.1 `woa-admin` behavior.

## Architectural Context

Relevant existing decisions:

- ADR-0001: Obsidian remains the preferred source-to-publish authoring flow.
- ADR-0004: avoid service/repository layers unless a concrete trigger exists; a real external API boundary justifies a narrow adapter.
- ADR-0009: private campaign content belongs outside the public Git repo and should be fetched from protected cloud storage after authz.
- ADR-0013: Campaign content families are explicit campaign-domain collections under `/campaigns/**`.
- ADR-0016: D1 is canonical lookup/index, R2 is blob storage only.
- ADR-0021: privileged/admin ownership belongs to `woa-admin`; this repo consumes approved APIs.
- ADR-0024: `publication` is separate from `visibility` and controls publication lane.
- ADR-0025: frontmatter is authoritative; folder hierarchy is derived/validated placement.

The new v0.3.1 Campaign Notes model is consistent with these decisions as an external API consumer model, but only if the main site keeps the adapter narrow and avoids building a temporary second campaign routing architecture around a single collection.

## Options Assessment

### Option 1 — Implement Campaign Notes now while leaving other campaign collections on existing routes

**Description:**

Update the existing `/campaigns/{campaign}/notes` and detail routes to the v0.3.1 contract immediately. Keep all other campaign family collections on current Astro/content-index routes.

**Work involved:**

- Replace old adapter types and validators with v0.3.1 shapes.
- Replace `noteType` query handling with `type`, plus optional `title` and `author` filters if exposed.
- Replace runtime assertion payload with `aud`/`exp`/`operation` contract.
- Update list/detail pages to use `type`, `authors`, and minimal metadata.
- Adjust campaign landing-page “Notes” card to avoid implying local counts unless API counts are fetched.
- Re-test anonymous/member/GM reads against `woa-admin`.
- Remove or quarantine obsolete old-contract tests.

**Gains:**

- Real-life test of the new Campaign Content Bucket read path.
- Earlier validation of signed runtime assertions.
- Enables Notes sooner if needed.

**Costs / risks:**

- Split routing and mental model: Notes are API-backed, other campaign content is still current main-site content collections.
- Likely near-term rework when all campaign content moves to the same API/bucket model.
- More code churn for little user-visible gain because campaign content volume is currently tiny.
- If counts/navigation try to unify Notes and existing family content, complexity grows quickly.

**Assessment:** feasible but not recommended unless immediate real-world API testing is worth the churn.

### Option 2 — Cut all campaign content over now, but only Notes work

**Description:**

Move the Campaigns domain conceptually to the new per-campaign API/bucket model now, accepting that only Notes are available until the sister-site finishes broader campaign content endpoints.

**Gains:**

- Avoids split model in code.
- Forces the main site toward the intended future architecture.

**Costs / risks:**

- Other campaign article types would disappear or become unavailable.
- Campaign landing and family routes would need temporary empty/unavailable states.
- There are only a few campaign articles, but this still changes user-visible behavior.
- This cuts over before the full external contract exists, which increases uncertainty.

**Assessment:** not recommended. It has the disruption of a cutover without the complete target API.

### Option 3 — Delay production implementation until the broader campaign routing/endpoints are finished

**Description:**

Do not ship or expand the Notes-only API integration now. Wait for `woa-admin` to finish the broader Campaign Content API/routing set, then integrate Campaign Notes as the first or one of many campaign content families under a consistent API-backed model.

**Immediate safety work still needed:**

- Mark the previous `/notes` implementation as superseded by v0.3.1.
- Do not rely on the current old-contract `/notes` route in production.
- Hide/remove Notes links until implementation resumes, or update the existing `/notes` route to a safe unavailable state if links must remain.
- Leave a working legacy `/sessions` route alone as the temporary surface; if it has already been removed, do not restore it unless there is a concrete production need.

**Gains:**

- Lowest rework.
- Avoids temporary split-routing architecture.
- Best fit with “nothing breaks on the main site.”
- Defers complexity until the actual target shape is known.

**Costs / risks:**

- No early production test of the new Campaign Notes endpoint.
- Campaign Notes content waits a few days.
- Existing old-contract code must not accidentally ship as if it were current.

**Assessment:** recommended.

### Option 4 — Add a feature flag for Campaign Notes

**Description:**

Implement v0.3.1 Campaign Notes now, but guard route links/rendering behind a flag.

**Gains:**

- Can test in staging or for selected campaigns.
- Easy rollback if the flag is operationally simple.

**Costs / risks:**

- Adds feature-flag complexity for a short-lived gap.
- Still requires immediate adapter/signature rewrite.
- Does not avoid split-routing code; it only hides it.
- The project does not currently need a broader feature-flag platform for this short window.

**Assessment:** not recommended unless the broader campaign API is delayed longer than expected or real-world endpoint testing becomes urgent.

## Recommended Plan

### Phase 0 — Immediate Safety / No-Breakage Pass

Goal: prevent old-contract Campaign Notes behavior from being mistaken for current production behavior while avoiding a real Notes implementation until the broader Campaign Content API is ready.

This is deliberately **not** a Campaign Notes feature implementation. It is a containment pass.

What “small” means:

- no new feature flag framework;
- no new generic Campaign Content abstraction;
- no attempt to make Notes fully work against v0.3.1 yet;
- no attempt to migrate all campaign family routes;
- no local visibility model for notes;
- no new R2/D1 ownership in this repo.

What “safety/alignment” means:

1. The main site should not call `woa-admin` using the old-contract adapter/signature payload.
2. The main site should not link ordinary users into a new `/notes` route that appears live but is contract-drifted.
3. Existing working `/sessions` behavior should not be disturbed just because `/notes` is deferred.
4. Future agents should see that the old Notes implementation is superseded by v0.3.1 before editing it.
5. Existing non-campaign and current campaign article surfaces should continue to build and render.

Recommended concrete implementation posture:

1. **Disable production-facing Notes links for now.**
   - Remove or hide the `Notes` card/link from campaign landing pages until v0.3.1 implementation resumes.
   - If a working `Sessions` card/link already exists, keep using it as the temporary legacy surface.
   - Do not add `/notes` routes to sitemap/search/discovery.
2. **Neutralize the current old-contract `/notes` route if it exists.** Choose one of:
   - preferred: remove the `/campaigns/[campaign]/notes` route files entirely until implementation resumes; or
   - acceptable: keep the route files but make them render a stable unavailable/noindex page and perform no `woa-admin` fetch.
   - This does not require removing or changing a working `/campaigns/[campaign]/sessions` route.
3. **Mark old-contract code as superseded.**
   - Add comments or TODOs around `src/adapters/campaign-notes-api.ts` and `src/lib/campaign-notes-runtime-assertion.ts`, or remove them if no current code imports them after routes are disabled.
   - Do not keep tests that assert the old `issuedAt`/`expiresAt` assertion payload as if it were valid.
4. **Preserve legacy sessions only if already working.**
   - If `/campaigns/{campaign}/sessions` exists and works, leave it alone during the delay.
   - If `/campaigns/{campaign}/sessions` has already been removed, do not restore it just to fill the temporary gap unless there is a concrete production need.
5. **Run normal validation.**
   - `pnpm test`
   - `pnpm build`
   - Confirm no broken imports remain after disabling/removing the old-contract Notes route.

Actions:

1. Treat the current `src/adapters/campaign-notes-api.ts` and `src/lib/campaign-notes-runtime-assertion.ts` as superseded by v0.3.1.
2. Do not expand the current `/campaigns/{campaign}/notes` implementation until it is rewritten to v0.3.1.
3. Prefer hiding or removing campaign landing-page links to `/notes` until the broader cutover is ready.
4. If a working `/sessions` link/surface exists, it may remain as the temporary legacy campaign-session surface.
5. If `/notes` route files remain, they must render a stable noindex “Campaign Notes temporarily unavailable” page and must not call `woa-admin`.
6. Ensure sitemap/search do not include broken `/notes` detail URLs. Do not remove working `/sessions` sitemap/search behavior unless the sessions publication path has already been intentionally removed.
7. Keep current Canon/Using/Reference surfaces untouched.

### Phase 1 — Wait for Broader Campaign Content Contract

Goal: avoid short-lived split-routing work.

Actions:

1. Monitor `woa-admin` completion of broader campaign article endpoints/routing.
2. Request/confirm whether the broader Campaign Content API will reuse:
   - the same runtime actor assertion shape,
   - the same list/detail page envelope,
   - the same publication/visibility semantics,
   - per-family route mapping under `/campaigns/{campaign}/{family}`.
3. Avoid designing a main-site-only abstraction for Notes that will not generalize to the imminent broader contract.

### Phase 2 — Implement Unified Campaign Content API Consumption

Goal: implement the future model once enough endpoint surface exists.

Actions:

1. Build or revise a narrow server-side adapter for Campaign Content reads.
2. Keep the adapter as small as ADR-0004 permits:
   - external API boundary only;
   - no local repo/service model unless duplicated logic or auth complexity demands it.
3. Implement runtime actor assertion once, using the v0.3.1 shape:
   - `aud`
   - `exp`
   - `campaignSlug`
   - `userId`
   - `role`
   - `operation`
4. Use the same auth/session/membership resolver already present in:
   - `src/lib/auth-session.ts`
   - `src/lib/campaign-request-access.ts`
   - `src/utils/campaign-access.ts`
5. Route Notes to `/campaigns/{campaign}/notes` and non-note campaign families to their existing public route shape only once their API-backed source exists.

### Phase 3 — Clean Up Legacy Campaign Notes / Sessions Remnants

Goal: remove dual-source confusion.

Actions:

1. Remove or quarantine old session-note publication routes if not already removed:
   - `src/pages/campaigns/[campaign]/sessions/index.astro`
   - `src/pages/campaigns/[campaign]/sessions/[...slug].astro`
2. Ensure `sessions` is not treated as the live Campaign Notes source in:
   - `src/content.config.ts`
   - `scripts/content-sync/cloud-content-metadata.mjs`
   - `scripts/content-sync/validate.mjs`
   - `scripts/content-sync/fs-diff.mjs`
   - `scripts/content-sync/obsidian-links.mjs`
3. Remove old local D1 Campaign Notes remnants only in a coordinated cleanup:
   - `src/lib/campaign-note-documents.ts`
   - `src/lib/campaign-note-documents-repo.ts`
   - related tests
   - `migrations/0015_campaign_note_documents.sql`
4. Do not delete historical migrations blindly if an environment may still have the old experimental table.

## If We Do Implement Notes Immediately Despite the Recommendation

If real-world testing of the new endpoint becomes important enough to justify Option 1, the implementation must first replace all old-contract assumptions.

Required v0.3.1 code changes:

1. Adapter types:
   - rename `noteType` to `type`
   - rename `authorUserIds` to `authors`
   - remove archive/revision/source-lane fields from required metadata validation
   - allow `visibility` to be absent from metadata responses because v0.3.1 metadata does not expose it
2. List params:
   - use `type`, not `noteType`
   - optionally support `title` and `author`
3. Assertion payload:
   - replace `environment`, `issuedAt`, `expiresAt` with `aud`, `exp`, and `operation`
   - keep HMAC over encoded actor header value
4. Rendering:
   - do not assume detail metadata exposes visibility/publication
   - set conservative `noindex` unless route-level/publication semantics are confirmed through API response behavior
5. Tests:
   - update payload/signature tests to v0.3.1
   - update adapter response-shape tests to minimal metadata
6. UI:
   - avoid count badges unless the API provides counts or the route fetches the first page
   - avoid combining Notes counts with local campaign-family counts

## Decision Matrix

| Option | Main-site breakage risk | Rework risk | Product benefit now | Complexity | Recommendation |
| --- | --- | --- | --- | --- | --- |
| 1. Implement Notes now, split routing | Medium | Medium/High | Low/Medium | Medium | Not preferred |
| 2. Cut all campaigns now, Notes only | Medium/High | Medium | Low | Medium | No |
| 3. Delay until broader campaign API | Low | Low | Delayed | Low | **Yes** |
| 4. Feature flag Notes | Low/Medium | Medium | Medium for testing | Medium | Only if delay grows |

## Validation Criteria for the Recommended Path

Before implementation resumes:

1. `docs/contracts/campaign-notes-api.openapi.yaml` v0.3.1 is treated as the only Campaign Notes contract.
2. No code path depends on old `noteType`/`authorUserIds`/revision/archive metadata as required response fields.
3. No production-facing UI promises working `/notes` until the v0.3.1 adapter is in place.
4. Existing non-campaign site surfaces continue to build and render.
5. Campaign landing pages do not link users into broken old-contract `/notes` routes.
6. A working legacy `/sessions` route, if present, remains undisturbed during the delay.

When unified campaign API implementation begins:

1. Anonymous public-note reads work with no runtime actor headers.
2. Authenticated member/GM reads use the v0.3.1 actor payload and signature.
3. Signed-in unauthorized users send no actor headers and receive anonymous behavior.
4. `404` remains unreadable-or-missing and does not leak protected note existence.
5. Production/staging publication behavior is contract-driven by `woa-admin`, not locally inferred from main-site campaign metadata.

## Final Recommendation

Do **not** invest in a full Notes-only implementation right now unless endpoint testing is urgently needed.

Do perform a small safety/alignment pass so the old implementation does not break the main site or mislead future agents. Then wait for the broader `woa-admin` Campaign Content API and implement Campaign Notes as part of the unified campaign-content cutover.

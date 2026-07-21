Status: ready-for-agent
Labels: ready-for-agent

# Spec: Campaign Content V1 live-loader integration

## Problem Statement

Campaign Content is currently represented by legacy main-site campaign collections and an unused Campaign Notes proof of concept. This mixes campaign-owned content into the main-site content model, leaves obsolete notes-specific code and links in place, and does not match the new authoritative Campaign Content Source API owned by `woa-admin`.

The project needs to replace the legacy Campaign Content path with an Astro-native, server-to-server integration that consumes Campaign Content from `woa-admin`, keeps `worldofaletheia.com` as the browser-facing authentication, authorization, routing, rendering, and asset-serving boundary, and eradicates old local campaign content and unused Campaign Notes behavior without compatibility fallback.

## Solution

Implement a first vertical slice of the new Campaign Content architecture using an Astro live content collection backed by a custom live loader for the `woa-admin` Campaign Content Source API.

The first slice covers the Campaign Index, campaign root pages, campaign about pages, notes indexes, and notes detail pages. The live loader fetches metadata lists with `getLiveCollection()` and detail Markdown with `getLiveEntry()`, then routes render through Astro `render()` as normally as possible. `worldofaletheia.com` derives Campaign Gate and Content Visibility access before any source fetch, mints short-lived campaign-scoped runtime assertions for every server-to-server call, and never exposes `woa-admin` URLs or assertions to browsers.

A temporary, complete, non-dynamic Campaign Gate Manifest lives in the main site and defines the outer gate for each campaign as `public` or `campaignMembers`. Missing entries fail conservatively to `campaignMembers` and emit warnings, but do not make a campaign unavailable if `woa-admin` can serve it. Longer-term `woa-admin` contract changes for campaign gate metadata and Campaign Index public metadata are tracked separately.

## User Stories

1. As a site visitor, I want to see a Campaign Index listing available campaigns by title, so that I can discover campaigns without needing private access.
2. As a site visitor, I want campaign titles to be meaningful human-readable names, so that the Campaign Index is useful rather than a list of opaque IDs.
3. As a site visitor, I want public-gated campaign roots to be reachable without signing in, so that public campaign introductions can be shared.
4. As a site visitor, I want member-gated campaign roots to block me before content is fetched, so that private campaign material is protected.
5. As a signed-in campaign member, I want to enter member-gated campaigns I belong to, so that I can read table-facing campaign material.
6. As a signed-in campaign member, I want public and campaign-member notes to appear in campaign note lists, so that I can browse material intended for players.
7. As a signed-in campaign member, I do not want GM-only notes to appear in lists or detail pages, so that GM material remains hidden from players.
8. As a campaign GM, I want to see public, campaign-member, and GM-only Campaign Content Items, so that I can use the site as a complete campaign reference.
9. As a campaign GM, I want GM-only material protected by item-level Content Visibility, so that the Campaign Gate does not need a GM-only mode.
10. As a campaign GM, I want a campaign to be either public-gated or campaign-member-gated, so that campaign availability is simple to reason about.
11. As a campaign GM, I want campaign-specific Markdown and assets to come from the campaign source managed through `woa-admin`, so that the main site is not a second content source.
12. As a campaign GM, I want old unused Campaign Notes behavior removed, so that obsolete implementation history cannot interfere with the new notes collection.
13. As a campaign GM, I want old local Campaign Content removed rather than migrated, so that there is no drift between obsolete main-site content and the authoritative source.
14. As an operator, I want a complete Campaign Gate Manifest, so that campaign gate intent is auditable in the main site during V1.
15. As an operator, I want missing Campaign Gate Manifest entries to default to `campaignMembers`, so that an omission does not accidentally make a campaign public.
16. As an operator, I want missing Campaign Gate Manifest entries to produce warnings, so that drift can be noticed and corrected.
17. As an operator, I want invalid Campaign Gate Manifest values to fail closed, so that bad config does not expose campaign content.
18. As an operator, I want manifest-present but source-missing campaigns to show generic unavailable/not-found behavior, so that source availability remains owned by `woa-admin` without leaking details.
19. As an operator, I want `worldofaletheia.com` to always send runtime assertions to `woa-admin`, including public-only reads, so that server-to-server calls are consistent and traceable.
20. As an operator, I want runtime assertions scoped to one Campaign Slug, so that an assertion for one campaign cannot be reused for another campaign.
21. As an operator, I want runtime assertions scoped to the Campaign Content read operation, so that assertions cannot be reused for unrelated operations.
22. As an operator, I want runtime assertions to expire quickly, so that replay value is limited.
23. As an operator, I want runtime assertion subjects to avoid PII, so that upstream logs do not contain emails, names, cookies, or session tokens.
24. As a developer, I want Campaign Content consumed through Astro live collections, so that the implementation remains Astro-native.
25. As a developer, I want a single `campaignContent` live collection with collection-key filters, so that campaign-family routing does not duplicate loader logic across many collections.
26. As a developer, I want metadata lists fetched through `getLiveCollection()`, so that list, section, and future search pages can use efficient indexed responses.
27. As a developer, I want detail pages fetched through `getLiveEntry()`, so that Markdown bodies are only fetched when needed.
28. As a developer, I want Astro `render()` used for Campaign Content Markdown, so that Markdown rendering follows the framework’s content pipeline instead of a parallel renderer.
29. As a developer, I want existing non-campaign R2 loaders left intact, so that Canon and Using Aletheia content continue to work as they do today.
30. As a developer, I want route code to derive access before calling the live loader, so that the loader does not inspect raw cookies or decide user authorization.
31. As a developer, I want the live loader filter to receive an explicit request-scoped access context, so that authorization facts are passed deliberately and testably.
32. As a developer, I want Campaign Gate checks to happen before any `woa-admin` fetch, so that unauthorized campaign access never causes source reads.
33. As a developer, I want `woa-admin` to filter by the asserted allowed visibility scope, so that the main site never fetches broader-than-authorized metadata or Markdown.
34. As a developer, I want thin boundary validation of API responses, so that malformed upstream responses fail closed without duplicating the full source validator.
35. As a developer, I want list filters to mirror the OpenAPI query model, so that type, subtype, tag, author, contributor, title, update, limit, and cursor filters can pass through cleanly.
36. As a developer, I want campaign slug, collection key, and document ID passed as structured fields, so that loaders do not have to parse route strings unnecessarily.
37. As a developer, I want the Campaign Root Entry Point rendered from campaign pages content, so that campaign-specific root content belongs to the campaign source.
38. As a developer, I want the campaign about page handled as a normal Campaign Content Item, so that it does not become a second Campaign Gate or settings document.
39. As a developer, I want notes to use the generic Campaign Content `notes` collection, so that the old notes-only model is gone.
40. As a developer, I want old note routes to become new API-backed notes routes or disappear, so that no route points at obsolete storage or contracts.
41. As a developer, I want one-segment document IDs for V1, so that the main site matches the current Campaign Content Source API and avoids inventing nested-path encoding.
42. As a developer, I want no browser-facing URL to point at `woa-admin`, so that source APIs remain server-to-server only.
43. As a reader, I want images and other referenced assets in Campaign Content Markdown to load from `worldofaletheia.com`, so that pages work without exposing the source API.
44. As a developer, I want Campaign Content asset references rewritten to a main-site asset route, so that rendered HTML never contains `woa-admin` asset URLs.
45. As a developer, I want asset access derived from readable referencing documents, so that assets inherit appropriate access without separate asset visibility fields.
46. As a campaign member, I want private assets referenced only by private documents to be unavailable to anonymous users, so that hidden images do not leak independently of Markdown.
47. As a GM, I want GM-only assets referenced only by GM-readable documents to be available to GMs, so that GM pages render correctly.
48. As a site visitor, I want unavailable or inaccessible Campaign Content to return generic not-found/unavailable behavior, so that private existence details are not leaked.
49. As an operator, I want integration and contract errors logged with campaign-safe context, so that issues can be diagnosed without exposing secrets.
50. As a search engine crawler, I should only index public-gated public Campaign Content pages, so that member/GM or unavailable pages are not indexed.
51. As a developer, I want a vertical slice first, so that the live-loader, assertion, routing, rendering, and asset approach is proven before every collection key is migrated.
52. As a maintainer, I want no legacy fallback during the vertical slice, so that failures are visible and obsolete campaign behavior cannot silently continue.

## Implementation Decisions

- Campaign Content is anything inside of, or directly associated with, a specific campaign: campaign-owned source documents and referenced source assets.
- Campaigns Presentation is the cross-campaign browser-facing material that explains, lists, or frames campaigns as a site area. It is not Campaign Content.
- The Campaign Index publicly lists all available campaigns with at least their titles. Campaign existence and titles are not treated as secret.
- Optional Campaign Index metadata beyond title, such as excerpts or summaries configured by a campaign GM, is deferred to a future `woa-admin` contract request.
- `woa-admin` is the source authority for Campaign Content and source availability. `worldofaletheia.com` must not become the canonical publication switch for campaign existence.
- `worldofaletheia.com` is the browser-facing boundary for authentication, authorization, routing, rendering, and browser-facing asset URLs.
- Browsers must never call `woa-admin` directly and must never receive runtime assertions.
- The user will sync the authoritative Campaign Content OpenAPI contract into the contract area and remove the obsolete Campaign Notes contract as an explicit external contract sync from `woa-admin`.
- The main implementation must not edit externally owned contract files itself.
- Campaign Gate is the outer boundary for entering a campaign-specific area. Published Campaign Gate values are only `public` and `campaignMembers`.
- `gm` is not a published Campaign Gate value. GM-only secrecy belongs to item-level Content Visibility or preview/unpublished workflow.
- Content Visibility is cumulative: `public` is readable by everyone who passes the Campaign Gate; `campaignMembers` is readable by campaign members and GMs; `gm` is readable only by GMs.
- A `campaignMembers` Campaign Gate blocks anonymous users from all underlying items, even items whose Content Visibility is `public`.
- For V1, Campaign Gate comes from a complete, non-dynamic main-site Campaign Gate Manifest keyed by Campaign Slug.
- The manifest lists every campaign the main site expects to serve, with `public` or `campaignMembers` gate values.
- Missing manifest entries default to `campaignMembers`, emit operator-visible warnings, and do not make a `woa-admin`-available campaign unavailable.
- Invalid manifest values fail closed to `campaignMembers` and log an error.
- Manifest-present but source-missing means the source is unavailable. The main site must not fabricate campaign content from the manifest.
- Future work should request a `campaignGate` capability from `woa-admin` and add it to the OpenAPI specs in a bundled contract revision.
- Legacy local Campaign Content and the unused Campaign Notes implementation are to be eradicated, not migrated or kept behind compatibility fallbacks.
- Old links, route stubs, tests, and active code that point to legacy local campaign content or old Campaign Notes behavior should be deleted or modified so they cannot be used accidentally.
- Already-applied database migrations may remain as migration history if required, but new behavior must not build on the old Campaign Notes table or model.
- Existing R2/build-time loaders for non-campaign content remain. The refactor only replaces legacy campaign content loading.
- Campaign Content is exposed through one Astro live collection, conceptually named `campaignContent`, backed by a custom live loader for the `woa-admin` Campaign Content Source API.
- Use `getLiveCollection()` for metadata lists and `getLiveEntry()` for detail Markdown. Detail pages render through Astro `render()`.
- The live collection uses a collection-key filter/discriminator rather than separate live collections for every campaign family.
- List filters should mirror the source API query model and include campaign slug, optional collection key, type, subtype, tag, author, contributor, title, updated-since, limit, cursor, and request-scoped access context.
- Detail filters should include campaign slug, collection key, document ID, and request-scoped access context.
- Campaign slug, collection key, and document ID remain structured fields. Do not encode them into one composite string unless Astro forces it; if forced, use a typed helper rather than ad hoc parsing.
- Route code resolves Better Auth session, Campaign Membership, Campaign Gate, and allowed visibility before calling the live loader.
- The loader does not inspect raw browser cookies and does not decide end-user authorization.
- If the Campaign Gate fails, the route must not call `woa-admin`.
- All main-site calls to `woa-admin` use signed runtime assertions, including public-only reads.
- Runtime assertions are scoped to one Campaign Slug, the Campaign Content read operation, the Campaign Content audience, one allowed visibility set, and a short expiry window.
- Runtime assertions are not scoped to individual document IDs in V1. Campaign-level scope is sufficient because assertions are short-lived, server-to-server, and never browser-exposed.
- Runtime assertion expiry is 60 seconds.
- Assertion subject is trace-only. Use a non-PII value such as an internal user ID prefix for authenticated users and `anonymous` for anonymous public reads.
- The source API should return only content readable under the asserted allowed visibility scope. The main site may defensively validate returned visibility but must not fetch broad data and filter locally.
- Boundary validation on the main site should validate the response shape and critical rendering/access fields needed to render safely, but should not duplicate the full source validation owned by `woa-admin`.
- Campaign route mapping for V1 is: campaign root from the pages index item; campaign about from the pages about item; notes index from the notes collection; notes detail from the notes collection and one-segment document ID.
- Do not expose a visible pages route segment for root campaign pages in V1.
- V1 does not support nested Campaign Content document paths. Document IDs are one path segment.
- Campaign Content Markdown asset references are rewritten to main-site URLs under an internal campaign asset route.
- The main-site campaign asset route applies the same Campaign Gate and membership-derived visibility scope as content reads, signs an assertion, fetches source bytes from `woa-admin`, and streams the asset to the browser.
- Asset access is derived from readable referencing documents, as enforced by `woa-admin`; assets do not have independent main-site visibility fields.
- Error behavior fails closed. Source 404 means not found or not readable; source 401 means integration/config error; source 400 means contract or request bug; rate-limit, service-unavailable, and network failures produce generic temporary unavailable behavior.
- Campaign-specific root/detail routes are indexable only when the Campaign Gate is `public` and the requested item Content Visibility is `public`. Member/GM/unavailable states are `noindex, nofollow`.
- The first implementation unit is a vertical slice: Campaign Index, campaign root, campaign about, notes list, and notes detail.
- The first implementation unit ends before all other campaign collection keys, search integration, relationship rendering, dynamic gate storage, OpenAPI changes, asset materialization caching, or nested document paths.
- A new ADR should be created for this decision set because it supersedes or narrows earlier campaign content source, local collection, and cloud index assumptions.

## Testing Decisions

- The highest-value test seam is the browser-facing campaign route behavior backed by a mocked or controlled live-loader/source boundary. Tests should prove what a user can see or not see, rather than testing loader internals through private functions.
- A second focused seam is needed for pure access-policy logic: Campaign Gate Manifest parsing, Campaign Gate defaults, cumulative Content Visibility, allowed visibility derivation, and gate-failure behavior.
- A third focused seam is needed for server-to-server source call mapping: runtime assertion payloads, headers, URL/query mapping, and error mapping. This seam should avoid real `woa-admin` calls.
- Good tests verify external behavior: which routes call the source, what visibility scope they request, which entries render, what error state appears, and whether browser HTML leaks forbidden URLs or metadata.
- Tests should not assert implementation details such as exact helper function structure, internal logging implementation beyond observable warnings/errors where useful, or the private mechanics of Astro rendering.
- Unit tests should cover valid Campaign Gate Manifest entries, missing entries defaulting to `campaignMembers`, invalid entries failing closed, and warnings/errors for drift.
- Unit tests should cover allowed visibility derivation for public gate plus anonymous, member, and GM users.
- Unit tests should cover allowed visibility derivation for campaign-member gate plus anonymous, member, and GM users, including no source call when anonymous fails the gate.
- Unit tests should cover runtime assertion payloads: campaign-scoped, operation-scoped, audience-scoped, 60-second expiry, allowed visibility set, and no PII subject.
- Unit tests should cover live-loader request mapping for metadata lists, including collection key and supported filters.
- Unit tests should cover live-loader request mapping for detail reads, including campaign slug, collection key, and document ID.
- Unit tests should cover that assertion headers are always present for main-site source reads, including public-only reads.
- Unit tests should cover source error mapping for not found, unauthorized assertion failure, invalid request, rate limit, service unavailable, network failure, and validation failure.
- Route or integration tests should cover the Campaign Index rendering campaign titles without revealing protected item details.
- Route or integration tests should cover campaign root rendering from the campaign root entry point when the user passes the Campaign Gate.
- Route or integration tests should cover campaign about rendering as a normal Campaign Content Item when present.
- Route or integration tests should cover notes list rendering only readable metadata returned by the source scope.
- Route or integration tests should cover notes detail rendering readable Markdown with Astro rendering.
- Route or integration tests should cover anonymous denial for campaign-member-gated campaigns before source fetch.
- Route or integration tests should cover member access excluding GM-only items.
- Route or integration tests should cover GM access including GM-only items.
- Route or integration tests should cover missing manifest entry defaulting to member gate.
- Route or integration tests should cover missing source content showing generic unavailable/not-found behavior.
- Route or integration tests should assert that rendered HTML never contains the `woa-admin` origin.
- Route or integration tests should assert asset references are rewritten to the main-site campaign asset route.
- Asset route tests should cover public, member, and GM requests and should rely on `woa-admin` source response semantics for referenced-readable assets.
- Existing test prior art includes campaign access tests, campaign membership repository tests, campaign collection helper tests, campaign media handler tests, and Campaign Notes tests that can inform behavior while the old notes implementation itself is removed.
- Baseline validation for the first implementation unit should include the project test command and the project build command.

## Out of Scope

- Implementing all Campaign Content collection keys beyond pages and notes.
- Search integration over Campaign Content.
- Relationship rendering, parent chains, or advanced discovery UX.
- Public Campaign Index metadata beyond title, such as excerpts, card images, campaign status, or custom summaries.
- A dynamic D1-backed Campaign Gate store on the main site.
- A `woa-admin` `campaignGate` endpoint or OpenAPI change.
- A `woa-admin` Campaign Index public metadata endpoint or OpenAPI change.
- Materialized asset caching or public asset publishing optimization.
- Nested Campaign Content document paths or nested route encoding.
- Preview site protections and unpublished campaign workflow.
- Rendering HTML on `woa-admin`.
- Browser-direct access to `woa-admin` APIs.
- Migrating old local campaign content or old Campaign Notes data.
- Building a compatibility layer for old Campaign Notes APIs or storage.
- Changing Better Auth account behavior or campaign membership schema beyond what the access checks already require.
- Editing externally owned contract files as part of the implementation.

## Further Notes

The issue tracker setup files for the Matt Pocock skills were not present in the repo, so this spec is published using the local Markdown issue convention under `.scratch/` with `Status: ready-for-agent` and `Labels: ready-for-agent`.

The project owner will perform the external contract sync after this design work: copying the authoritative Campaign Content Read API contract from `woa-admin` into the contracts area and removing the obsolete Campaign Notes contract with an explicit note that the new contract supersedes it.

Two external backlog requests already exist for future `woa-admin` contract work: one for campaign gate metadata and one for public Campaign Index metadata.

The new ADR should be written before or alongside implementation because this refactor intentionally changes the Campaign Content source boundary, rendering model, and legacy cleanup posture.

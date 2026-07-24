# Campaign Content V1 Source Authority and Live Collection Boundary

## Status

- Date: 2026-07-24
- Status: Accepted
- Deciders: Brad
- Parent issue: [#3](https://github.com/bradarnst/worldofaletheia/issues/3)
- Implementation ticket: [#4](https://github.com/bradarnst/worldofaletheia/issues/4)

## Context and Problem Statement

Campaign Content is moving from legacy main-site campaign collections and an unused Campaign Notes proof of concept to a server-to-server source integration owned by `woa-admin`.

The current repository needs a stable decision record before implementation agents alter the Campaigns domain. Earlier ADRs already establish important constraints:

- ADR-0001 and ADR-0025 keep content authoring portable and source-driven rather than making the public site an editor.
- ADR-0004 requires Astro-native content access and avoids speculative service, adapter, or contract layers.
- ADR-0009 moves private Campaign Content out of the public repository and into protected runtime source reads.
- ADR-0012 separates content producer responsibilities from the public site over time.
- ADR-0016 keeps D1/R2 as the canonical cloud index/blob model for non-campaign site content.
- ADR-0019 makes `campaign_memberships` the campaign authorization authority for `member` and `gm` roles.
- ADR-0021 keeps privileged admin capabilities external by default, with `woa-admin` as the expected owner.
- ADR-0024 keeps campaign `visibility` as the only content access-control field.

Campaign Content V1 narrows the Campaigns source boundary further: `woa-admin` becomes the Campaign Content source authority, while `worldofaletheia.com` remains the browser-facing site boundary for authentication, authorization, routing, rendering, and asset delivery.

## Decision Drivers

- Keep private campaign-owned Markdown and assets out of the public repository.
- Preserve `worldofaletheia.com` as the only browser-facing Campaign Content runtime.
- Keep privileged campaign source and admin workflows owned by `woa-admin`.
- Keep the main-site implementation Astro-native by using Astro live collections instead of a parallel renderer or repository layer.
- Fail closed for missing or invalid access configuration.
- Remove obsolete local Campaign Content and Campaign Notes paths rather than maintaining compatibility fallbacks.
- Avoid exposing `woa-admin` URLs, assertions, cookies, session tokens, or private source metadata to browsers.
- Defer external `woa-admin` contract changes until they can be requested and versioned deliberately.

## Considered Options

### Option 1: Keep legacy local campaign collections and add `woa-admin` as a fallback

Keep existing main-site campaign content paths available and consult `woa-admin` only when local content is absent.

**Pros**

- Lower immediate cutover risk.
- Existing local route behavior could continue during partial implementation.

**Cons**

- Creates split-brain Campaign Content authority.
- Allows obsolete Campaign Notes behavior to keep influencing new routes.
- Makes failures less visible by silently falling back to stale content.
- Conflicts with the public-repository confidentiality goal.

### Option 2: Build a separate browser-facing Campaigns app now

Move Campaign Content rendering and access into a separate app or service under `woa-admin` or another Campaigns runtime.

**Pros**

- Strongest implementation isolation.
- Cleaner independent service boundary eventually.

**Cons**

- Higher immediate delivery risk than V1 requires.
- Requires cross-app browser auth/session, routing, SEO, and asset decisions now.
- Moves `worldofaletheia.com` away from its current Campaigns presentation boundary before extraction triggers are fully proven.

### Option 3: Use `woa-admin` as server-to-server source authority and render through one Astro live collection in the main site (Chosen)

Consume Campaign Content through a single Astro live collection, conceptually named `campaignContent`, backed by a custom live loader for the `woa-admin` Campaign Content Source API. Main-site routes derive access before source reads, sign short-lived runtime assertions for every server-to-server call, render Markdown through Astro, and serve rewritten assets through main-site URLs.

**Pros**

- Establishes one Campaign Content source authority without forcing a full app split now.
- Keeps the browser-facing site, routes, auth, rendering, and SEO under `worldofaletheia.com`.
- Uses Astro-native live collection primitives instead of a parallel data/rendering layer.
- Makes legacy fallback removal explicit and testable.
- Keeps `woa-admin` private to server-to-server integration.

**Cons**

- Adds runtime dependency on the `woa-admin` source API.
- Requires careful request-scoped authorization and assertion handling.
- Requires a temporary main-site Campaign Gate Manifest until `woa-admin` exposes gate metadata.

## Decision Outcome

Chosen option: Option 3 — use `woa-admin` as the server-to-server Campaign Content source authority and render Campaign Content through one main-site Astro live collection.

### Source and Browser-Facing Boundaries

1. `woa-admin` is the source authority for Campaign Content documents, Campaign Content assets, and source availability.
2. `worldofaletheia.com` is the browser-facing boundary for:
   - Better Auth session resolution,
   - Campaign Membership authorization through D1 `campaign_memberships`,
   - Campaign Gate enforcement,
   - route mapping under `/campaigns/**`,
   - Markdown rendering,
   - SEO/indexability decisions,
   - and browser-facing asset URLs.
3. Browsers must never call `woa-admin` directly for Campaign Content V1.
4. Browsers must never receive runtime assertions, `woa-admin` URLs, source API credentials, or upstream authorization details.
5. `worldofaletheia.com` must not become a second canonical publication switch for campaign existence or source availability.

### Astro Live Collection Model

1. Campaign Content V1 uses one Astro live collection, conceptually named `campaignContent`.
2. The live collection uses structured filters rather than route-string parsing as the normal interface:
   - Campaign Slug,
   - collection key,
   - document ID for detail reads,
   - list filters such as type, subtype, tag, author, contributor, title, updated-since, limit, and cursor,
   - and an explicit request-scoped access context.
3. List surfaces use `getLiveCollection()` for metadata lists.
4. Detail surfaces use `getLiveEntry()` for Markdown bodies.
5. Detail rendering uses Astro `render()` so Campaign Content Markdown follows the framework content pipeline rather than a parallel renderer.
6. The first V1 route slice covers:
   - Campaign Index,
   - campaign root pages,
   - campaign about pages,
   - notes indexes,
   - and notes detail pages.
7. Campaign root content comes from the campaign pages collection root entry point; campaign about content is a normal Campaign Content Item, not a second gate or settings document.
8. Notes use the generic Campaign Content `notes` collection, not the obsolete Campaign Notes model.
9. V1 document IDs are one route segment. Nested Campaign Content document paths are deferred.

### Campaign Gate and Visibility Policy

1. Campaign Gate is the outer boundary for entering a campaign-specific area.
2. Published Campaign Gate values for V1 are only `public` and `campaignMembers`.
3. `gm` is not a Campaign Gate value. GM-only secrecy belongs to item-level Content Visibility.
4. Content Visibility remains cumulative:
   - `public` is readable by everyone who passes the Campaign Gate,
   - `campaignMembers` is readable by members and GMs,
   - `gm` is readable only by GMs.
5. A `campaignMembers` Campaign Gate blocks anonymous users before any source fetch, even for underlying items whose Content Visibility is `public`.
6. Route code resolves Better Auth session, Campaign Membership, Campaign Gate, and allowed visibility before calling the live loader.
7. The live loader does not inspect raw browser cookies and does not decide end-user authorization.
8. `woa-admin` is expected to return only content readable under the asserted allowed visibility scope. The main site may defensively validate returned visibility, but must not fetch broader-than-authorized Campaign Content and filter it locally as the primary access strategy.

### Temporary Campaign Gate Manifest

1. Campaign Content V1 uses a complete, non-dynamic main-site Campaign Gate Manifest keyed by Campaign Slug.
2. The manifest exists only because `woa-admin` does not yet expose campaign gate metadata in the Campaign Content Source contract.
3. The manifest lists every campaign the main site expects to serve, with a `public` or `campaignMembers` gate value.
4. Missing manifest entries fail closed to `campaignMembers`, emit operator-visible warnings, and do not by themselves make a `woa-admin`-available campaign unavailable.
5. Invalid manifest values fail closed to `campaignMembers` and emit operator-visible errors.
6. Manifest-present but source-missing campaigns use generic not-found or temporarily-unavailable behavior. The main site must not fabricate campaign content from the manifest.
7. A future `woa-admin` contract request must add source-owned Campaign Gate metadata so this manifest can be retired.

### Server-to-Server Runtime Assertions

1. Every main-site request to `woa-admin` for Campaign Content uses a signed runtime assertion, including public-only reads.
2. Runtime assertions are server-to-server credentials and are never exposed to browsers.
3. Assertions are scoped to:
   - one Campaign Slug,
   - the Campaign Content read operation,
   - the Campaign Content source audience,
   - one allowed visibility set,
   - and a short expiry window.
4. Runtime assertion expiry for V1 is 60 seconds.
5. Assertions are not scoped to individual document IDs in V1. Campaign-level scope is acceptable because assertions are short-lived, server-to-server only, and never browser-exposed.
6. Assertion subjects are trace-only and must avoid PII. Use non-PII values such as an internal user ID prefix for authenticated users and `anonymous` for anonymous public reads.
7. Source `401` responses represent integration or assertion failures and must not be treated as ordinary end-user authorization denials.

### Asset Serving Boundary

1. Campaign Content Markdown may reference campaign-owned assets, but rendered browser HTML must use `worldofaletheia.com` asset URLs.
2. The main site rewrites Campaign Content asset references to an internal main-site campaign asset route.
3. The asset route applies the same Campaign Gate and membership-derived visibility scope as content reads.
4. The asset route signs a runtime assertion, fetches source bytes from `woa-admin`, and streams them to the browser from the main-site origin.
5. Asset access is derived from readable referencing documents as enforced by `woa-admin`; assets do not gain an independent main-site visibility field in V1.
6. Rendered HTML and public metadata must never expose `woa-admin` asset URLs.

### Legacy Eradication Policy

1. Legacy local Campaign Content paths are removed rather than migrated or retained as compatibility fallback.
2. The unused Campaign Notes implementation is removed or replaced by the new API-backed notes route behavior.
3. Old route stubs, tests, links, and active code that point at obsolete local Campaign Content or old Campaign Notes behavior should be deleted or modified so they cannot be used accidentally.
4. Already-applied database migrations may remain as historical migration records if required, but new behavior must not build on the old Campaign Notes table or model.
5. Failures in the new source path should be visible through fail-closed unavailable/not-found behavior, not hidden by legacy fallback.

### Deferred External Contract Requests

The main implementation must not edit externally owned contract files under `docs/contracts/`. Contract changes belong to the owning external project and must be requested deliberately.

Deferred `woa-admin` contract requests include:

1. Campaign Gate metadata owned by `woa-admin`, replacing the temporary main-site Campaign Gate Manifest.
2. Public Campaign Index metadata beyond title, such as GM-authored excerpts, summaries, card art, or campaign status.
3. Any future nested document path support or broader Campaign Content collection-key expansion beyond the V1 route slice.

## Consequences

### Positive

- Campaign Content has a single source authority for V1.
- The public repository no longer needs local private campaign source material or obsolete notes behavior.
- `worldofaletheia.com` remains the stable browser-facing route, auth, render, and asset boundary.
- The implementation stays aligned with Astro-native live collection primitives.
- Runtime assertions make server-to-server reads consistent and traceable without exposing upstream credentials to browsers.
- The temporary Campaign Gate Manifest gives operators an auditable V1 gate posture while preserving fail-closed defaults.

### Negative

- Main-site Campaigns rendering now depends on `woa-admin` source availability.
- The temporary Campaign Gate Manifest can drift until `woa-admin` owns gate metadata.
- Runtime assertion signing, validation, and logging require careful secret handling and test coverage.
- Asset rewriting and streaming add a new protected route surface that must be validated separately.

### Neutral

- Better Auth remains the authentication/session boundary.
- D1 `campaign_memberships` remains the campaign authorization authority for member and GM roles.
- This decision does not move privileged admin CRUD into the public site.
- This decision does not change non-campaign Canon, Using Aletheia, or Reference content source behavior.
- This decision does not require editing externally owned contracts in this repository.
- Full Campaigns app/service extraction remains deferred until explicit extraction triggers are met.

## Validation and Testing Expectations

Implementation work for this ADR should use the seams already identified in the parent spec:

1. Browser-facing campaign route behavior backed by a mocked or controlled live-loader/source boundary.
2. Pure access-policy logic for Campaign Gate Manifest parsing, defaulting, cumulative Content Visibility, allowed visibility derivation, and gate failure.
3. Server-to-server source call mapping for assertion payloads, headers, URL/query mapping, and error mapping.

Tests should prove route-visible behavior and boundary contracts rather than private helper structure. High-value assertions include:

- unauthorized campaign-member-gated access causes no `woa-admin` source fetch,
- public-only reads still include runtime assertions,
- members do not receive GM-only content,
- GMs receive GM-visible content,
- missing manifest entries default to `campaignMembers` with warnings,
- invalid manifest entries fail closed,
- source errors map to generic not-found or unavailable behavior without leaking private existence details,
- rendered HTML never contains a `woa-admin` origin,
- asset references are rewritten to the main-site campaign asset route.

## Links

- [#3 Campaign Content V1 live-loader integration](https://github.com/bradarnst/worldofaletheia/issues/3)
- [#4 Record Campaign Content V1 architecture ADR](https://github.com/bradarnst/worldofaletheia/issues/4)
- [0001 Obsidian-First Content Architecture](0001-obsidian-first-content-architecture.md)
- [0004 Campaigns Data Access Policy: Astro-Native Content Collections First](0004-campaigns-astro-native-content-access-policy.md)
- [0009 Campaign Content Source Separation for Public Repository](0009-campaign-content-source-separation-for-public-repo.md)
- [0012 Content Producer Extraction: Dedicated Repository with Staged Cutover](0012-content-producer-extraction-strategy.md)
- [0016 D1 as Canonical Cloud Content Index and R2 as Blob Storage](0016-d1-as-canonical-cloud-content-index-and-r2-blob-storage.md)
- [0019 Campaign Membership Role Unification in `campaign_memberships`](0019-campaign-membership-role-unification.md)
- [0021 External Admin Capability Boundary](0021-external-admin-capability-boundary.md)
- [0024 Content Publication Metadata Model](0024-content-publication-metadata-model.md)
- [0025 Portable Markdown Source Contract and Frontmatter Authority](0025-portable-markdown-source-contract-and-frontmatter-authority.md)

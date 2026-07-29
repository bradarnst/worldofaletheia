# Campaign Content Source API main-site handoff

This guide is derived from the Campaign Content OpenAPI contracts:

- `docs/contracts/campaign-content-read-api.openapi.yaml`
- `docs/contracts/campaign-content-operator-api.openapi.yaml` (owned and versioned in the `woa-admin` sister repository; not included in this repository)

OpenAPI is authoritative for routes, status codes, schemas, filtering, pagination, auth headers, and error bodies. This guide exists to make the intended `worldofaletheia.com` integration boundary explicit.

## Ownership split

`woa-admin` owns Campaign Content source storage abstraction, validation, derived indexing, source reads, publication filtering, authored visibility metadata, and reference-aware asset source reads.

`worldofaletheia.com` owns browser authentication, end-user authorization, route composition, Astro loader integration, Markdown rendering, asset URL rewriting/materialization, browser-facing caching, and whether a page is built statically, served dynamically, or mixed.

Browsers must not consume the `woa-admin` Source API directly. Browser-facing rendered HTML must not point image or link URLs directly at `woa-admin` asset endpoints.

## Runtime assertion model

Calls with no runtime assertion headers are public-only source reads.

Calls that need `campaignMembers` or `gm` content send both existing header names:

- `x-woa-runtime-actor`
- `x-woa-runtime-signature`

The decoded assertion payload uses:

```json
{
  "aud": "woa-admin:campaign-content:v1",
  "operation": "content:read",
  "campaignSlug": "the-weight-of-sun-and-soil",
  "exp": 1784217600,
  "allowedVisibility": ["public", "campaignMembers"],
  "subject": "optional trace metadata"
}
```

`woa-admin` verifies the envelope, expiry, audience, operation, campaign match, signature, and allowed visibility values. It does not read Better Auth cookies or decide whether an end user is a campaign member. The main site must make that decision before minting the assertion.

## Campaign Surface Registry

The main site uses `GET /api/v1/campaigns` as the source of truth for campaign listing and Campaign Gate metadata.

Returned surfaces require both active campaign storage and matching Campaign Surface Registry metadata for the same campaign and environment. Bucket rows alone are not public-site listing metadata. Registry response items are intentionally limited to the OpenAPI-defined fields: `campaignSlug`, `title`, `gate`, and `updatedAt`.

If the registry is unavailable or malformed, the main site must fail closed: the campaign index degrades without listing protected surfaces, and campaign route gate resolution must not fall back to local hard-coded slugs.

### Production setup and verification

Setup is applied in `woa-admin`, because it owns Campaign Content storage and registry metadata. There is no main-site database migration, seed file, local fallback list, or `wrangler` command to run in this repository for registry rows.

For each public-site environment, the owning `woa-admin` operator must configure an active Campaign Surface Registry row for every campaign surface that should be listable or routable on `worldofaletheia.com`. The exact mutation command or UI path is intentionally owned by the `woa-admin` project; this repository's required setup action is to request/verify that the `woa-admin` registry endpoint returns the contract-shaped rows below for the target environment.

Required registry metadata per surface:

- `campaignSlug`
- `title`
- `gate` (`public` or `campaignMembers`)
- `updatedAt`

Verification steps:

1. Confirm the main-site environment has `CAMPAIGN_CONTENT_SOURCE_BASE_URL` pointed at the matching `woa-admin` environment. For Cloudflare Pages/Workers, inspect the deployed environment variable or secret in the Cloudflare dashboard/environment settings.
2. From an operator shell with access to that origin, request the registry:

   ```bash
   curl -fsS "$CAMPAIGN_CONTENT_SOURCE_BASE_URL/api/v1/campaigns"
   ```

   Verify it returns `200` with only an `items` array of registry items using the four fields above.
3. Verify the response shape locally before deployment-sensitive testing:

   ```bash
   CAMPAIGN_CONTENT_SOURCE_BASE_URL="https://<woa-admin-origin>" curl -fsS "$CAMPAIGN_CONTENT_SOURCE_BASE_URL/api/v1/campaigns"
   ```

4. Load `/campaigns` on the main site and verify the returned registry surfaces appear.
5. Load a `public` campaign route anonymously and verify public content is reachable.
6. Load a `campaignMembers` campaign route anonymously and verify it fails closed before protected source content is fetched; then sign in as a D1 `campaign_memberships` member/GM for the exact `campaignSlug` and verify access.

Rollback/recovery:

- To remove a campaign from public-site listing and routing, remove or disable its Campaign Surface Registry metadata in `woa-admin`; do not change bucket rows alone.
- If registry metadata is malformed or the registry endpoint is down, the main site will fail closed. Restore the previous valid registry response or roll back the `woa-admin` registry deployment/configuration.
- Do not add local hard-coded campaign slug or gate fallbacks in this repository as a recovery mechanism.

## Astro entry mapping

List routes return metadata-only entries:

- `GET /api/v1/campaigns/{campaignSlug}/documents`
- `GET /api/v1/campaigns/{campaignSlug}/collections/{collection}/documents`

Detail routes return the same entry shape plus frontmatter-stripped Markdown:

- `GET /api/v1/campaigns/{campaignSlug}/collections/{collection}/documents/{id}`

Entries are intentionally Astro-like: `id`, collection identity, `campaignSlug`, and `data`. `data.collection` and `data.campaign` are included so the main site does not reconstruct frontmatter identity.

`woa-admin` does not render HTML and does not expose raw frontmatter-bearing Markdown as the canonical response.

## Collections

The URL-facing collection keys are `pages`, `notes`, `lore`, `places`, `sentients`, `bestiary`, `flora`, `factions`, `systems`, `meta`, `characters`, `scenes`, `adventures`, and `hooks`.

The canonical returned collection values are camelCase values such as `campaignPages`, `campaignNotes`, `campaignLore`, and `campaignPlaces`. The old sister-site `campaigns` collection name is legacy terminology for root campaign pages and is not the new Campaign Content contract value.

There is no runtime supported-collections endpoint in V1. Use the OpenAPI contract as the schema source of truth.

## Assets

The Source API exposes referenced source assets through:

```text
GET /api/v1/campaigns/{campaignSlug}/assets?path=assets/...
```

Assets are readable only when at least one currently readable indexed document references them under the same publication and visibility scope. The main site should materialize or proxy these assets behind its own browser-facing URLs and rewrite Markdown references during rendering.

## Compatibility

There is no Campaign Notes compatibility window. Notes are represented by the generic `notes` collection under the Campaign Content Source API.

The old notes-only routes are obsolete implementation history and must not be used for new main-site integration.

Existing main-site campaign content, Campaign Notes integration assumptions, R2 objects, and D1/index tables should be treated as superseded by this Campaign Content contract. That is a significant integration change: the main site may need to retire, delete, migrate, or rebuild its own legacy content/index/storage state as part of adopting the new source boundary.

This handoff does not prescribe those main-site operations. `worldofaletheia.com` owns the browser-facing migration plan, including any cleanup or modification of its own R2 buckets, D1 tables, generated content, caches, routes, and rendering/indexing code.

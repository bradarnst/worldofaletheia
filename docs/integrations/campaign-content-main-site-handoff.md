---
audience: developer-operator
publication: repo-local
status: current
owner: woa-admin
---

# Campaign Content Source API main-site handoff

This guide is derived from the Campaign Content OpenAPI contracts:

- `docs/contracts/campaign-content-read-api.openapi.yaml`
- `docs/contracts/campaign-content-operator-api.openapi.yaml` (owned and versioned in the `woa-admin` sister repository; not included in this repository)

OpenAPI is binding and authoritative for routes, status codes, schemas, filtering, pagination, auth headers, and error bodies. This contract-adjacent handoff exists to make the intended `worldofaletheia.com` integration boundary explicit without becoming procedural setup guidance or redefining HTTP behavior.

For first rollout sequencing across `woa-admin`, Cloudflare resources, GM sync setup, main-site cutover, and legacy cleanup, use the rollout guide owned by the `woa-admin` sister repository.

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

## Campaign surfaces

The main site discovers active campaign surfaces through:

```text
GET /api/v1/campaigns
```

This endpoint returns the environment-specific Campaign Surface Registry. A returned surface requires both active campaign storage configured in `woa-admin` for that runtime environment and matching Campaign Surface Registry metadata for the same campaign and environment. Bucket rows alone are not public-site campaign listing metadata.

Response items are intentionally limited to the OpenAPI-defined `campaignSlug`, `title`, `gate`, and `updatedAt` fields. The endpoint does not expose bucket names, storage slugs, environment fields, membership/user fields, admin metadata, document excerpts, tags, Markdown, rendered HTML, or asset paths.

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

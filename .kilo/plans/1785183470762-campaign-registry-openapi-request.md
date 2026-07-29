# Feature Request: Add Campaign Registry Endpoint to woa-admin Campaign Content API

## Target repository

`bradarnst/woa-admin`

## Issue type

Feature request / OpenAPI contract change

## Summary

Add a campaign registry endpoint to the `woa-admin` API so the public `worldofaletheia.com` site can list and gate campaigns without hard-coding campaign slugs in source code.

The public site currently has to carry campaign identity in code because the Campaign Content Source API is campaign-specific only. That creates an unnecessary deploy dependency whenever campaign slugs change or new campaigns become listable.

## Problem

`worldofaletheia.com` currently has active hard-coded campaign slug lists in:

- `src/lib/campaign-index.ts`
- `src/lib/campaign-gate-policy.ts`

Those constants currently contain the old campaign slugs:

- `brad`
- `barry`

The canonical campaign identities now live in `woa-admin`, with slugs such as:

- `the-weight-of-sun-and-soil`
- `the-lattice-was-like-that-when-i-found-it`

Because the current Campaign Content API only exposes campaign-scoped reads, the public site has no authoritative way to ask `woa-admin` which campaigns are listable or what Campaign Gate applies to each campaign.

This is accidental cross-repo coupling. `woa-admin` owns campaign identity and metadata; `worldofaletheia.com` should consume that registry instead of defining it.

## Current contract gap

The existing Campaign Content read contract supports campaign-specific endpoints, including:

- `GET /api/v1/campaigns/{campaignSlug}/documents`
- `GET /api/v1/campaigns/{campaignSlug}/collections/{collection}/documents`
- `GET /api/v1/campaigns/{campaignSlug}/collections/{collection}/documents/{id}`
- `GET /api/v1/campaigns/{campaignSlug}/assets`

There is no cross-campaign endpoint for campaign registry/listing metadata.

## Proposed endpoint

Add:

```http
GET /api/v1/campaigns
```

This endpoint should return campaigns that are available to the public site as campaign surfaces. It should not return private document titles, notes, assets, member lists, GM-only metadata, or unrelated admin state.

If `woa-admin` needs to distinguish public-site-listable campaigns from all campaigns, prefer a filter on the Campaigns resource rather than introducing a non-resource noun:

```http
GET /api/v1/campaigns?listed=true
```

or:

```http
GET /api/v1/campaigns?surface=public-site
```

Avoid names like `/api/v1/campaigns/discovery`; the resource being returned is Campaigns, not discoveries.

## Proposed response shape

```json
{
  "items": [
    {
      "campaignSlug": "the-weight-of-sun-and-soil",
      "title": "The Weight of Sun and Soil",
      "gate": "campaignMembers",
      "listed": true,
      "updatedAt": "2026-07-28T00:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### Field notes

- `campaignSlug`: exact route-safe canonical slug used by Campaign Content, Campaign Gate, and `campaign_memberships.campaign_slug`.
- `title`: safe public display title for campaign listing cards.
- `gate`: public-site Campaign Gate value. Initial values should match the public site model:
  - `public`
  - `campaignMembers`
- `listed`: whether the campaign should appear on the public `/campaigns` index.
- `updatedAt`: optional metadata for cache validation/operator debugging.
- `nextCursor`: optional pagination cursor. May be `null` if the initial implementation returns the full list.

## Authorization and visibility

This endpoint should be safe for the public site to call server-to-server. It should return only campaign-level metadata that `woa-admin` has approved for public-site listing or routing.

It must not expose:

- campaign member lists
- user IDs or emails
- GM-only metadata
- protected document titles/excerpts/tags
- asset paths unless explicitly public campaign metadata
- unpublished campaigns unless requested through an authorized admin/operator surface

Open question for `woa-admin`: whether the endpoint is public-read, runtime-assertion-protected, or uses a separate public-site integration credential. The main-site preference is to reuse the existing server-to-server Campaign Content source configuration if appropriate.

## Public-site consumption intent

After this endpoint exists, `worldofaletheia.com` should replace the hard-coded campaign constants with a registry loader:

```ts
getCampaignRegistry() -> CampaignRegistryItem[]
```

Callers:

- `/campaigns` index renders the returned campaigns.
- Campaign Gate resolution uses the returned `gate` for known campaigns.
- Campaign detail routes continue to use the route slug and read campaign content through the existing Campaign Content Source API.
- D1 `campaign_memberships` remains the authorization authority for member/GM access using the exact same `campaignSlug`.

## Acceptance criteria

- [ ] OpenAPI contract in `woa-admin` defines `GET /api/v1/campaigns` or an equivalent Campaigns resource endpoint.
- [ ] Response includes at minimum `campaignSlug`, `title`, and `gate` for each listable campaign.
- [ ] Contract documents whether the endpoint is public-read or server-to-server authenticated.
- [ ] Contract states that returned campaigns are safe for the public site to list/route.
- [ ] Contract prohibits returning member/user/admin/private content data from this endpoint.
- [ ] `worldofaletheia.com` can remove hard-coded campaign slugs from `src/lib/campaign-index.ts` and `src/lib/campaign-gate-policy.ts` once it consumes the endpoint.
- [ ] Slug changes in `woa-admin` no longer require a source-code change in `worldofaletheia.com`; they only require the public site to read the updated registry.

## Related context

- `worldofaletheia.com` consumes Campaign Content from `woa-admin` through the server-to-server source boundary.
- Campaign Content routes require exact slug alignment between:
  - `woa-admin` Campaign Content records
  - main-site Campaign Gate
  - D1 `campaign_memberships.campaign_slug`
- The current hard-coded main-site constants were a workaround for the lack of a V1 cross-campaign registry endpoint.
- This request is an OpenAPI/API-contract change owned by `woa-admin`, not a main-site content migration.

# Campaign Member Role Update External API Handoff

## Status

Superseded as an in-repo implementation plan. Campaign member role update is external API behavior.

## Ownership Boundary

This repository does **not** implement `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}` or any other campaign member-management endpoint business logic.

Owned here:

- front-end campaign admin UI
- front-end API client calls to documented `/api/v1/campaigns/**` paths
- user-facing loading, permission, success, and error display states
- tests for URL construction, request method selection, and front-end error parsing

External API owner owns:

- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}` endpoint implementation
- Better Auth session validation at the API boundary
- D1 `campaign_memberships` authorization and mutation
- update-only membership semantics
- API response DTOs and error behavior
- OpenAPI contract changes or clarifications

Do not create local `src/pages/api/v1/campaigns/[campaignSlug]/members/[userId].ts` route files in this repo for this behavior unless a later ADR explicitly changes ownership.

## Current Front-End Dependency

The campaign admin UI and `src/utils/campaign-management-api-client.ts` may call:

```text
PUT /api/v1/campaigns/{campaignSlug}/members/{userId}
```

That call is intentionally a consumer call to an external API. The absence of a local route file in this repository is expected.

## External API Capability Request

The external API/API-contract owning project should implement or confirm ownership for:

```text
PUT /api/v1/campaigns/{campaignSlug}/members/{userId}
```

Required behavior:

- Authenticate actor via Better Auth session.
- Authorize actor using D1 `campaign_memberships` for exact `campaignSlug` with `role = 'gm'`.
- Validate `campaignSlug`, `userId`, and request body.
- Request body must contain a valid campaign role: `member` or `gm`.
- Update existing memberships only.
- Do not create a new campaign membership from this endpoint.
- Return `updated` when role changes.
- Return `unchanged` when the existing role already matches.
- Return the refreshed campaign member DTO.
- Follow `CampaignMemberUpdateResponse` exactly.
- Keep global admin/provider/session/password capabilities out of this endpoint.

If the OpenAPI contract is missing required behavior, the contract-owning project should update or clarify the contract. This repo should not invent divergent behavior.

## Public-Site Acceptance Criteria

- The front-end calls the documented external `PUT` endpoint.
- The front-end does not import D1 membership repositories to mutate campaign members.
- The front-end does not send Cloudflare Access headers.
- Success messages and errors are rendered from the API response shape.
- No local route implementation is added for this endpoint.

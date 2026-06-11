# Campaign Member Role Update Implementation Plan

## Goal

Implement the OpenAPI-defined campaign member role update capability for the public-site campaign admin surface.

This work must follow the OpenAPI contract as the source of truth. Do not invent alternative routes, payloads, outcomes, or authorization semantics. If implementation discovers that the OpenAPI contract is missing a required behavior, stop and request a contract/spec update from the owning API/API-contract project before adding unspecced behavior.

## Context

The current working tree adds campaign member add-by-email support through:

- `POST /api/v1/campaigns/{campaignSlug}/members`
- `src/pages/campaigns/[campaign]/admin.astro`
- `CampaignMembershipRepo.createCampaignMember()`
- `CampaignMembershipRepo.findUserByExactEmail()`
- `CampaignMembershipRepo.getCampaignMember()`

The OpenAPI contract also defines:

- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}`
- `CampaignMemberUpdateResponse`

The implementation currently has repo-level update/upsert functionality in `CampaignMembershipRepo.upsertCampaignMember()`, but there is no route exposing the OpenAPI-defined PUT capability.

## Non-negotiable constraints

1. Use Better Auth for authentication.
2. Use D1 `campaign_memberships` for authorization.
3. Authorize only exact campaign GMs: `campaign_slug = {campaignSlug}` and `role = 'gm'`.
4. Do not use Cloudflare Access.
5. Do not add global admin semantics.
6. Do not expose global user search, provider data, session data, password state, invitations, or access-request workflows.
7. Follow the OpenAPI route and response schemas exactly.
8. The PUT endpoint must be update-only; it must not create campaign memberships.

## Implementation tasks

### 1. Confirm OpenAPI details

Read `docs/contracts/user-account-management-api.openapi.yaml` and confirm the exact contract for:

- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}`
- request body schema
- success response schema
- error responses
- `CampaignMemberUpdateResponse`
- `CampaignRole`

If the spec does not define something needed for safe implementation, do not guess. Document the gap and request a spec clarification/change.

### 2. Add the route

Create:

```text
src/pages/api/v1/campaigns/[campaignSlug]/members/[userId].ts
```

Implement `PUT` only if that matches the OpenAPI contract.

Expected flow:

1. Validate `campaignSlug` using existing campaign admin API utilities.
2. Validate `userId` according to the OpenAPI contract.
3. Parse JSON request body.
4. Validate `role` is exactly `member` or `gm`.
5. Authenticate with `getRequestSession()` through existing campaign admin context helpers where practical.
6. Confirm campaign exists.
7. Confirm actor is GM for the exact campaign.
8. Update the target user's existing membership role.
9. Return the refreshed member DTO joined to Better Auth `user` row.
10. Return `updated` or `unchanged` according to the contract.

### 3. Use update-only repository behavior

Do not use create-on-conflict semantics for the PUT endpoint.

Preferred repo shape:

```ts
updateCampaignMemberRole(
  campaignSlug: string,
  userId: string,
  role: 'member' | 'gm',
): Promise<'updated' | 'unchanged' | 'not_found'>
```

This should:

- Read the existing membership for exact `campaignSlug` and `userId`.
- Return `not_found` if no membership exists.
- Return `unchanged` if the role already matches.
- Update `role` and `updated_at` only when the role changes.
- Never insert.

If keeping `upsertCampaignMember()`, ensure the PUT route does not use it in a way that can create rows. Rename/refactor if needed to make update-only behavior explicit.

### 4. Add request parsing helpers if useful

Extend `src/utils/campaign-admin-api.ts` only as needed for contract-backed behavior, for example:

- `parseCampaignMemberRoleUpdateRequest()`
- `validateUserId()` if the OpenAPI contract defines user-id constraints

Keep helpers small and route-focused. Do not introduce broad service/adaptor layers.

### 5. Update dashboard only if supported by the contract

If the current admin UI is expected to expose role changes in this slice:

- Add role-change controls to `src/pages/campaigns/[campaign]/admin.astro`.
- Use `fetch()` against the OpenAPI-defined PUT endpoint.
- Update the row and GM count only after a successful response.
- Do not implement revoke/demotion/last-GM protections unless the OpenAPI contract defines them for this endpoint.

If UI role changing is not in scope, implement and test the API route only.

### 6. Tests

Add focused tests for repository and route behavior.

Repository tests:

- missing membership returns `not_found`
- same role returns `unchanged` without writing
- changed role updates and returns `updated`
- update path never inserts

Route/API tests if the project has route-test patterns available:

- unauthenticated request returns `401`
- signed-in non-GM returns `403`
- invalid campaign slug returns `400`
- invalid user id returns contract-defined error
- invalid role returns `400`
- missing existing membership returns contract-defined failure
- same role returns `unchanged`
- changed role returns `updated`
- response matches `CampaignMemberUpdateResponse`

### 7. Verification

Run the relevant checks with `pnpm` only:

```sh
pnpm test
```

If there are narrower test commands for campaign membership repo/API code, run those first, then run the broader test command if feasible.

## Handoff/request for API/API-contract owning project

If the PUT capability is owned by another project/team rather than this repo, send this request:

```md
# Campaign Member Role Update Capability Request

## Source of truth

The public site follows the OpenAPI contract as authoritative. Implementation must not invent behavior outside the contract.

## Required capability

Implement or confirm ownership for:

PUT /api/v1/campaigns/{campaignSlug}/members/{userId}

## Purpose

Allow a campaign GM to change an existing campaign member's role between `member` and `gm`.

## Required behavior

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

## OpenAPI alignment

If this endpoint is already in the OpenAPI contract, implementation should match it exactly.

If this endpoint is not intended to exist, the OpenAPI contract must be changed before implementation proceeds.

## Public-site dependency

The campaign admin dashboard can add existing users by exact email through POST today, but full role management requires this PUT capability.
```

## Acceptance criteria

- The OpenAPI-defined PUT member update capability is implemented or formally handed off to the owning API project/team.
- No unspecced route or divergent behavior is introduced.
- PUT role update is update-only and cannot create campaign memberships.
- Authorization remains Better Auth session plus exact campaign GM membership.
- Tests cover unchanged, updated, and missing-membership behavior.

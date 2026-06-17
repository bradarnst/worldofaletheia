# Campaign Management UX Next Steps Plan

## Status

Superseded as an in-repo API implementation plan. Keep as a front-end UX reference only.

## Summary

Build the campaign management UX as a campaign-scoped front end for the OpenAPI contract in `docs/contracts/user-account-management-api.openapi.yaml`, not as a global admin dashboard, not as direct browser-to-D1 behavior, and not as in-repo campaign API endpoint implementation.

The campaign management endpoints are external API calls:

- `GET /api/v1/campaigns/{campaignSlug}/admin-capability`
- `GET /api/v1/campaigns/{campaignSlug}/members`
- `POST /api/v1/campaigns/{campaignSlug}/members` for add-by-exact-email create-only membership creation
- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}` for role changes on existing memberships
- `DELETE /api/v1/campaigns/{campaignSlug}/members/{userId}`

This repo owns the public-site front-end client and display behavior that consume those endpoints. It does not own endpoint business logic or D1 membership mutations for campaign management.

## Direction

Use the current v1 contract and front-end guide as the source of truth:

- `docs/contracts/user-account-management-api.openapi.yaml`
- `docs/integrations/woa-admin-campaign-user-management-front-end-guide.md`
- `docs/handoff/woa-admin-user-account-management-handoff.md`

Respect these accepted boundaries:

- `campaign_memberships` is the canonical membership and role authority, but mutation authority is external to this repo.
- `campaign_memberships.role = 'gm'` grants campaign `user-admin` capability for v1, as evaluated by the external API.
- The public campaign UI must not include global user search, provider account data, password reset, session management, soft delete, deprovisioning, invitations, access requests, or notification flows.
- Admin/operator workflows under `/api/v1/admin/*` remain separate from campaign-scoped public UI.
- Use Astro-native pages and vanilla TypeScript for bounded client interactivity.
- Do not add local `src/pages/api/v1/campaigns/**` route handlers for member-management behavior in this repo unless a later ADR explicitly changes ownership.

## Front-End Owned Work

Front-end implementation targets:

- Keep `/campaigns/[campaign]/admin.astro` as the campaign-scoped management UI.
- Use a small front-end API client for the documented external `/api/v1/campaigns/**` paths.
- Rely on same-origin Better Auth session participation as expected by the deployed API boundary.
- Show explicit states for loading, unauthenticated, forbidden, unavailable, empty members, success, and error responses.
- Render member list rows/cards with display name, email, role, joined time, and updated time from external API DTOs.
- Support add/update/revoke controls only by calling the external API and applying returned DTOs.
- Do not pre-load or mutate member-management state directly through D1 for this UI.

## External API Owned Work

External API/API-contract owners are responsible for:

- endpoint implementation for all `/api/v1/campaigns/**` member-management routes
- Better Auth session validation at the API boundary
- D1 `campaign_memberships` authorization and mutation
- last-GM, self-action, audit, rate-limit, and write-safety policies
- OpenAPI contract changes or clarifications
- durable operator/admin concerns outside this public-site repo

## Non-Goals For This Repo

- No local campaign API route implementation.
- No direct campaign membership mutation through `CampaignMembershipRepo` from the admin UI.
- No Cloudflare Access checks or headers.
- No `/api/v1/admin/**` calls.
- No global admin/operator semantics.
- No global user lookup.
- No password/session/account actions from the campaign admin UI.
- No invitation-by-email UI unless the external contract adds it later.

## Verification For Front-End Changes

Use `pnpm` only.

Checks:

```bash
pnpm test
pnpm build
```

Manual front-end test cases when an external API environment is available:

- Anonymous actor opening `/campaigns/{campaign}/admin` gets sign-in/restricted state.
- Signed-in non-member cannot administer.
- Signed-in `member` cannot administer.
- Signed-in `gm` can view member list.
- Role filter and pagination behave according to contract.
- Successful role update returns a refreshed member DTO and confirmation message.
- Successful revoke removes the row from the front-end state after the external API confirms success.
- Browser/network calls target only documented `/api/v1/campaigns/**` paths and never `/api/v1/admin/**`.
- Browser/network calls do not send Cloudflare Access headers.

## Recommended Next In-Repo Slice

No backend/API slice is recommended in this repo.

If campaign management is revisited here, the next slice should be front-end-only hardening:

1. Verify current UI behavior against the external API in an environment where those routes are available.
2. Tighten user-facing empty/error/success states if gaps are found.
3. Keep any endpoint behavior, write safety, and contract changes with the external API/API-contract owner.

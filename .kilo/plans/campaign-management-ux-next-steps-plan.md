# Campaign Management UX Next Steps Plan

## Summary

Build the campaign management UX as a campaign-scoped front end for the existing OpenAPI contract in `docs/contracts/user-account-management-api.openapi.yaml`, not as a global admin dashboard and not as direct browser-to-D1 behavior.

The main prerequisite before the richer UX is implementing or exposing the contract-backed campaign API surface:

- `GET /api/v1/campaigns/{campaignSlug}/admin-capability`
- `GET /api/v1/campaigns/{campaignSlug}/members`
- `POST /api/v1/campaigns/{campaignSlug}/members` for add-by-exact-email create-only membership creation
- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}` for role changes on existing memberships
- `DELETE /api/v1/campaigns/{campaignSlug}/members/{userId}`

This should come before a full dashboard because the repo currently has Better Auth, D1 membership checks, and account membership display, but does not yet expose these versioned campaign management endpoints.

## Direction

Use the current v1 contract and front-end guide as the source of truth:

- `docs/contracts/user-account-management-api.openapi.yaml`
- `docs/integrations/woa-admin-campaign-user-management-front-end-guide.md`
- `docs/handoff/woa-admin-user-account-management-handoff.md`

Respect these accepted boundaries:

- `campaign_memberships` is the canonical membership and role authority.
- `campaign_memberships.role = 'gm'` grants campaign `user-admin` capability for v1.
- The public campaign UI must not include global user search, provider account data, password reset, session management, soft delete, deprovisioning, invitations, access requests, or notification flows.
- Admin/operator workflows under `/api/v1/admin/*` remain separate from campaign-scoped public UI.
- Use Astro-native pages and vanilla TypeScript for bounded client interactivity.

## Phase 0: Contract And Routing Check

Goal: confirm the exact API ownership path before implementation.

Tasks:

- Decide whether this repo will implement same-origin `/api/v1/campaigns/*` routes directly or proxy those routes to `woa-admin`.
- If proxying to `woa-admin`, identify the environment variable for the API origin and cookie/session forwarding behavior.
- If implementing directly here first, keep the route handlers small and contract-shaped so they can later move behind `woa-admin` without changing the UI.
- Confirm whether v1 writes are allowed before audit storage exists. Recommended: read-only dashboard first, then role/revoke writes after explicit safety checks are implemented.

Recommendation: implement same-origin contract-compatible campaign routes in this repo only if `woa-admin` is not ready to serve them. The UI should still consume the contract paths and DTOs so it can later switch to `woa-admin` or a proxy boundary.

## Phase 1: API Groundwork

Goal: provide the minimum contract-backed API needed by a campaign management screen.

Implementation targets:

- Add campaign API route files under `src/pages/api/v1/campaigns/[campaignSlug]/...` using Astro `APIRoute` handlers.
- Add small contract DTO and validation utilities near the API code or under a focused utility module; do not introduce broad service/adaptor layers.
- Extend `CampaignMembershipRepo` with contract-oriented methods:
  - list campaign members joined to Better Auth `user` rows
  - get one campaign member
  - upsert member role for exact `(campaignSlug, userId)`
  - revoke exact membership
  - count campaign GMs for last-GM protection
- Keep response shapes secret-safe and aligned with OpenAPI: `CampaignMemberPage`, `CampaignMemberMutationResponse`, `CampaignMemberRevokeResponse`, `CampaignAdminCapability`, and `ErrorResponse`.

Authorization rules:

- Resolve the current actor through `getRequestSession()`.
- Return `401` when no Better Auth session exists.
- Return `403` when the actor is not a GM for the exact campaign.
- Treat only `gm` as `user-admin` in v1.
- Accept exact email only for create-only `POST /members`; existing membership role changes require exact `userId` through `PUT /members/{userId}`.
- Validate `campaignSlug`, `userId`, role, limit, cursor, and request bodies before touching D1.

Write safety rules:

- Prevent revoking or demoting the last GM for a campaign.
- Consider blocking self-demotion/self-revocation in v1 unless explicitly approved.
- Verify mutation postconditions and return the refreshed contract DTO.
- Log safe operational events, but do not log cookies, session tokens, password state, OAuth tokens, or unrelated account data.

## Phase 2: Read-Only UX

Goal: give GMs a useful dashboard without enabling mutation risk yet.

Implementation targets:

- Add route `src/pages/campaigns/[campaign]/admin.astro`.
- Server-render the campaign shell with `CampaignsLayout` and `robots="noindex,nofollow"`.
- Resolve campaign title/slug through existing campaign content helpers.
- Fetch or call the capability endpoint for the exact campaign.
- If unauthenticated, show a sign-in path with `next` back to the admin route.
- If authenticated but not authorized, show a campaign-scoped permission message or restricted state consistent with existing campaign pages.
- If authorized, render member list with display name, email, role, joined time, and updated time.
- Add entry links from campaign detail pages only when the actor has `user-admin`; avoid exposing admin controls to non-GMs.

UX scope:

- Overview card: campaign title, actor, capability source, member count, GM count.
- Members table/cards: display name, email, role, joined/updated timestamps.
- Error states: unauthenticated, forbidden, not found, unavailable.
- No update/revoke controls in the first read-only pass.

## Phase 3: Membership Mutations

Goal: enable contract-supported membership management once read-only behavior is validated.

Implementation targets:

- Add a small vanilla TypeScript client island or inline module for form submission and pending state.
- Add explicit controls for changing role between `member` and `gm`.
- Add explicit revoke flow with typed or button confirmation showing target user and campaign.
- Disable controls during requests and show `confirmationMessage` from API responses.
- Re-fetch the member list after successful mutation or update local state from the response DTO.

Non-goals in this phase:

- No invitation-by-email UI; exact-email add only resolves already-registered accounts.
- No access-request UI.
- No global user lookup.
- No password/session/account actions.

Important product boundary:

- `POST /members` adds an already-registered account by exact email and must return `409` if that user is already a campaign member. `PUT /members/{userId}` is reserved for modifying existing memberships and does not create rows.

## Phase 4: Add-Member UX Decision

Goal: decide how campaign GMs add members without violating the v1 non-goals.

Options:

- Option A, accepted for v1: exact-email add form for already-registered users, with create-only POST semantics and no global search/autocomplete.
- Option B: add invitations or access requests in a later contract revision.

Recommendation: ship exact-email add for new campaign memberships first, then add role/revoke controls through the explicit `PUT`/`DELETE` member routes.

## Phase 5: Verification

Use `pnpm` only.

Checks:

- `pnpm test`
- `pnpm build`
- `pnpm dev:cf:auth` for local Cloudflare/D1/auth parity testing
- Read-only local D1 verification of `campaign_memberships` and `user` joins where needed
- Staging validation before production writes are enabled

Manual test cases:

- Anonymous actor opening `/campaigns/{campaign}/admin` gets sign-in/restricted state.
- Signed-in non-member cannot administer.
- Signed-in `member` cannot administer.
- Signed-in `gm` can view member list.
- Role filter and pagination behave according to contract.
- Last-GM demotion/revoke is blocked.
- Successful role update returns a refreshed member DTO and confirmation message.
- Successful revoke removes only the exact campaign membership.

## Risks And Open Decisions

- API ownership is the main sequencing question: direct same-origin implementation here versus proxy/consume from `woa-admin`.
- Add-member UX is under-specified because v1 forbids global search and does not include invitations.
- Production writes should not ship until last-GM/self-action safety rules are settled.
- Audit storage is not present in the v1 contract; safe logs are acceptable for local/staging, but a durable audit policy may be needed before broader production use.
- If campaign management grows into app-dominant or real-time tooling, revisit the vanilla TypeScript island policy and campaign extraction boundary.

## Recommended Next Implementation Slice

1. Implement `GET /api/v1/campaigns/{campaignSlug}/admin-capability`.
2. Implement `GET /api/v1/campaigns/{campaignSlug}/members`.
3. Build `/campaigns/[campaign]/admin` as a read-only GM dashboard consuming those endpoints.
4. Validate locally with `pnpm dev:cf:auth`, then staging.
5. Add role update and revoke after read-only behavior is stable and last-GM policy is implemented.

# Campaign Member Add-by-Email HLD Handoff

## Status

Ready for Code handoff.

## Purpose

Revise the campaign management contract and UX so a campaign GM can add an existing registered user to a campaign by entering that user's exact email address, without exposing global user search, user lists, provider data, session data, password state, invitations, or access-request workflows.

This corrects the current read-only campaign admin dashboard limitation: a member overview is not operationally useful unless a GM can add members through a human-friendly identifier.

## Architectural Position

This is a campaign-scoped public-site workflow, not a global admin console.

Relevant accepted decisions:

- `plans/adrs/0019-campaign-membership-role-unification.md`
  - `campaign_memberships` is canonical.
  - `role = gm` grants GM authority and implies member access.
- `plans/adrs/0021-external-admin-capability-boundary.md`
  - Global admin/provider/password/session/account workflows remain external.
  - This exception is allowed because it is campaign-scoped public-site membership management, not broad privileged user administration.
- `plans/adrs/0007-astro-islands-vanilla-typescript-first-policy.md`
  - Use Astro + vanilla TypeScript for the dashboard interaction.
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
  - Keep route/API implementation small and direct. Do not introduce broad service/adaptor layers.

## Current State

Already implemented in the current working tree from the previous slice:

- `GET /api/v1/campaigns/{campaignSlug}/admin-capability`
- `GET /api/v1/campaigns/{campaignSlug}/members`
- `src/pages/campaigns/[campaign]/admin.astro` read-only dashboard
- `CampaignMembershipRepo.listCampaignMembers()` joined to Better Auth `"user"` rows
- `CampaignMembershipRepo.countCampaignGms()`
- GM-only dashboard entry link from campaign detail pages

The current dashboard is read-only and therefore insufficient for practical use.

## Product Decision

Campaign GMs must be able to add an existing registered user by exact email address.

Do **not** add:

- global user search
- browseable user picker
- autocomplete over users
- invitation-by-email workflow
- access request workflow
- account creation from the campaign dashboard
- provider/session/password/admin account controls

## Contract Revision

Revise `docs/contracts/user-account-management-api.openapi.yaml` to add a campaign-scoped add-by-email endpoint.

### New Endpoint

```http
POST /api/v1/campaigns/{campaignSlug}/members
Content-Type: application/json
```

Suggested `operationId`:

```text
addCampaignMember
```

Suggested request schema:

```yaml
AddCampaignMemberRequest:
  type: object
  additionalProperties: false
  required:
    - email
    - role
  properties:
    email:
      type: string
      format: email
      maxLength: 254
      description: Exact email address for an existing registered user. The API resolves this internally using canonical email matching.
    role:
      $ref: '#/components/schemas/CampaignRole'
```

Suggested success response:

- `201` with `CampaignMemberCreateResponse`
- `outcome` is always `created`

Recommended failure responses:

- `400` invalid email, role, campaign slug, or body
- `401` unauthenticated
- `403` actor is not GM for the exact campaign
- `404` campaign not found or eligible user not found
- `409` when the resolved user is already a campaign member or the create-only postcondition fails
- `503` D1/auth dependency unavailable

### Enumeration-Safe Failure Copy

For email lookup failure, return a generic campaign-scoped message such as:

```json
{
  "error": "not_found",
  "message": "No eligible existing account was found for that email address.",
  "requestId": "req_..."
}
```

Do not distinguish between:

- email does not exist
- email exists but is not eligible
- canonical email mismatch
- account is not usable for membership

## API Behavior

### Authorization

For `POST /api/v1/campaigns/{campaignSlug}/members`:

1. Validate `campaignSlug` before D1 lookup.
2. Resolve actor using `getRequestSession(request, locals)`.
3. Return `401` if no Better Auth session exists.
4. Confirm the campaign exists through Astro content collection lookup.
5. Confirm actor has `campaign_memberships.role = 'gm'` for exact `campaignSlug`.
6. Return `403` if actor is not a GM.
7. Do not allow global admin semantics in this endpoint unless a later ADR/contract revision explicitly adds that capability.

### Email Resolution

Resolve exact email server-side only:

1. Normalize input email:
   - trim whitespace
   - require valid email shape
   - lower-case for normalized lookup
2. Match only against Better Auth `"user".email`, which stores `trim(lower(email))`.
3. Query should return at most one user.
4. If multiple normalized matches are ever found, fail closed with `409` or `503` and log a secret-safe diagnostic.
5. Response must never expose any user data unless a new membership is successfully created for that exact campaign.

### Membership Mutation

After resolving target user ID:

1. Create a new `campaign_memberships` row by unique `(user_id, campaign_slug)`.
2. Role must be `member` or `gm`.
3. `gm` implies member access per ADR-0019.
4. Set `created_at` only on insert.
5. Set `updated_at` on insert.
6. Return refreshed `CampaignMember` DTO joined to Better Auth `"user"` row.
7. Return `outcome: created` only.
8. Return `409 Conflict` if the resolved user already has any membership for the campaign. Role changes for existing memberships are reserved for `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}`.

### Safety Rules

For add-by-email:

- Last-GM protection is not directly relevant because this endpoint only creates new memberships and never demotes or revokes.
- Self-add is allowed by policy but normally redundant; if the actor already exists in the campaign, return `409` like any other existing member.
- Adding as `gm` is allowed for campaign GMs in v1 unless product chooses to limit initial UI to `member` only.
- Recommended v1 UI default: role defaults to `member`, with optional GM role selection if role update controls are also being shipped.

## Repository/DB Implementation Notes

Extend `src/lib/campaign-membership-repo.ts` with focused methods only; do not introduce broad service layers.

Suggested methods:

```ts
findUserByExactEmail(email: string): Promise<{ userId: string; displayName: string | null; email: string } | null>
createCampaignMember(campaignSlug: string, userId: string, role: 'member' | 'gm'): Promise<'created' | 'already_exists'>
```

Or a combined method if simpler:

```ts
addCampaignMemberByEmail(input: {
  campaignSlug: string;
  email: string;
  role: 'member' | 'gm';
}): Promise<{ member: CampaignMemberIdentity; outcome: 'created' } | 'already_exists' | null>
```

Keep DTO mapping explicit:

- D1 `user_id` -> DTO `userId`
- D1 `campaign_slug` -> DTO `campaignSlug`
- D1 `created_at` -> DTO `joinedAt`
- D1 `updated_at` -> DTO `updatedAt`
- Better Auth `"user".name` -> DTO `displayName`

## UX Implementation

Update `src/pages/campaigns/[campaign]/admin.astro` from read-only to practical v1 management.

### Add Existing User Form

Render only for authorized GMs.

Fields:

- Email address
- Role (`member` default; optionally `gm`)
- Submit button: `Add member`

Behavior:

- Use vanilla TypeScript/fetch; no framework dependency.
- POST to `/api/v1/campaigns/${campaignSlug}/members`.
- Disable controls while pending.
- Show success using `confirmationMessage`.
- On success, refresh member list from `GET /members` or update local table from response DTO.
- On failure, show safe user-facing API `message`.

### Copy Requirements

Make the boundary clear:

- “Add an existing World of Aletheia account by exact email address.”
- “This does not invite new users or search all users.”
- “If the person has not created an account yet, have them sign up first.”

### Non-Goals

Do not implement in this slice:

- user picker
- global user search
- email invitation
- automatic account creation
- access request queue
- email notification
- revocation/demotion unless explicitly included as a separate follow-up

## Optional Follow-Up After Add-by-Email

After add-by-email is working, implement role update/revoke for existing members:

- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}`
- `DELETE /api/v1/campaigns/{campaignSlug}/members/{userId}`

These require last-GM protection:

- Block demoting the only GM to member.
- Block revoking the only GM.
- Prefer blocking self-demotion/self-revocation in v1.

## Verification Plan

Use `pnpm` only.

Required checks:

```bash
pnpm test
pnpm build
```

Local parity testing:

```bash
pnpm dev:cf:auth
```

Manual cases:

1. Anonymous actor cannot add member.
2. Signed-in non-member cannot add member.
3. Signed-in `member` cannot add member.
4. Signed-in `gm` can add an existing user by exact email.
5. Email lookup is case-insensitive through canonical email.
6. Unknown email returns generic not-found copy and does not reveal account state.
7. Existing member with same role returns `409 Conflict`.
8. Existing member with different role returns `409 Conflict`; role changes use `PUT /members/{userId}`.
9. New campaign membership returns `201` with `outcome: created`.
10. Member list refresh shows the added user.
11. Logs contain campaign slug, actor user ID, and safe outcome only; no cookies, tokens, passwords, hashes, OAuth data, or unrelated account data.

## Acceptance Criteria

- OpenAPI contract includes campaign-scoped add-by-email endpoint.
- API does not expose global user search/listing.
- API only returns target user identity after successful campaign membership mutation.
- GM-only authorization is enforced for the exact campaign.
- Dashboard lets a GM add an existing account by exact email.
- Dashboard remains noindex/nofollow.
- No new dependencies are added.
- `pnpm test` and `pnpm build` pass.

## Open Decisions

No blocking decisions remain.

Implementation may choose whether the v1 UI allows adding a user directly as `gm` or only as `member`. Recommended default: allow role selection because the contract already supports `CampaignRole`, but default the select to `member`.

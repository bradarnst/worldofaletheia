# Campaign Admin Dashboard HLD

## Status

- Date: 2026-06-03
- Status: Proposed / pending approval
- Scope: Initial internal feature description, requirements, use cases, and high-level design for a campaign-scoped admin dashboard in this repository.
- Related handoff: `docs/handoff/woa-admin-user-account-management-handoff.md`
- Related ADRs:
  - `plans/adrs/0019-campaign-membership-role-unification.md`
  - `plans/adrs/0021-external-admin-capability-boundary.md`
  - `plans/adrs/0007-astro-islands-vanilla-typescript-first-policy.md`

## Summary

This feature adds an in-site campaign admin dashboard for campaign-scoped user administration. It is not a global user/account admin UI. It allows authorized campaign administrators to manage access for their own campaign without exposing all users/accounts in D1.

The first dashboard should be built in this repo because the immediate UX belongs near campaign pages and uses the current Better Auth session plus `campaign_memberships` authorization model. However, the implementation should remain loosely coupled because campaign administration may later move to `woa-admin` or another external service.

## Goals

1. Provide campaign GMs a safe dashboard for managing people in their own campaign.
2. Introduce a campaign-scoped `user-admin` capability, defaulting to campaign GMs.
3. Support member list, invitation, removal, and limited role/capability changes.
4. Avoid global user/account search or enumeration from campaign-scoped UX.
5. Define API contracts that can later be consumed by `woa-admin` or extracted into a separate service.
6. Document API contracts with OpenAPI before or alongside implementation.

## Non-goals

- No global user/account dashboard in this repo.
- No global user search for campaign admins.
- No password reset UI in the campaign dashboard.
- No account deletion/deprovisioning UI in the campaign dashboard.
- No broad admin permission model for all site operations.
- No bidirectional content sync or content-frontmatter based user management.

## Current model and constraints

- Auth uses Better Auth backed by Cloudflare D1.
- `user.id` is the stable identity key.
- `campaign_memberships` is the campaign entitlement source of truth.
- `campaign_memberships.role` currently allows `member | gm`.
- `gm` implies member access and should also imply `user-admin` capability by default.
- If non-GM campaign user administrators are needed, the current schema cannot represent that explicitly without an additional capability model or migration.
- Public campaign content remains static-first; this dashboard is a Campaigns-domain interactive feature and is allowed to use a scoped Astro island when client-side state is genuinely useful.

## Proposed authorization model

### Capability: `user-admin`

A signed-in user has `user-admin` capability for a campaign when:

1. They have `campaign_memberships.role = 'gm'` for that `campaign_slug`; or
2. A future explicit campaign capability grant says they have `user-admin` for that campaign.

Initial implementation should use rule 1 only unless a separate schema decision is approved.

### Scope boundary

A campaign `user-admin` may:

- View members of campaigns they administer.
- Invite a known email address to a campaign they administer.
- Remove a member from campaigns they administer, subject to safety rules.
- Change allowed campaign-scoped roles/capabilities for campaigns they administer.

A campaign `user-admin` may not:

- Browse all users.
- Search all users by partial email/name.
- View provider accounts, sessions, password state, or global account metadata.
- Reset passwords.
- Delete/deprovision users.
- Manage other campaigns.

## UX requirements

### Dashboard entry point

Potential route:

```text
/campaigns/[campaign]/admin
```

Visibility:

- Only signed-in users with `user-admin` capability for the campaign should see admin controls.
- Unauthorized users should receive a not-found or restricted campaign response consistent with existing campaign access behavior.

### Screens/sections

1. **Overview**
   - Campaign slug/title.
   - Current actor role/capability.
   - Basic counts: members, GMs, pending invitations, pending access requests.

2. **Members**
   - List existing campaign members.
   - Show only campaign-relevant identity fields: display name, email if policy permits, role, joined/updated time.
   - Actions: remove, change role/capability where allowed.

3. **Invite by email**
   - Form for known email address.
   - Requested role defaults to `member`.
   - Generic success message that does not reveal whether the email already has an account unless policy explicitly allows.

4. **Access requests**
   - List users who requested to join this campaign.
   - Approve/reject controls.
   - Approval creates membership with default role `member` unless a higher role is explicitly allowed.

5. **Audit/activity summary**
   - Initial version can be read-only recent actions if audit storage exists.
   - If no audit storage exists, include this as a placeholder requirement for the API contract.

## Requirements

### Functional requirements

- FR-01: A signed-in campaign GM can open the campaign admin dashboard for that campaign.
- FR-02: A signed-in non-GM member cannot open admin controls unless explicitly granted future `user-admin` capability.
- FR-03: A campaign admin can list members for only their campaign.
- FR-04: A campaign admin can invite a known email address without global account lookup.
- FR-05: A campaign admin can remove a campaign member, subject to last-GM and self-removal safety rules.
- FR-06: A campaign admin can update allowed campaign role/capability values.
- FR-07: A signed-in user can request access to a campaign if the campaign supports requests.
- FR-08: A campaign admin can approve or reject pending requests for only their campaign.
- FR-09: All write operations verify postconditions and return safe response shapes.
- FR-10: API contracts must be documented in OpenAPI before they are treated as external-facing.

### Security and privacy requirements

- SEC-01: Authorize every API mutation server-side using the signed-in Better Auth session.
- SEC-02: Check `user-admin` capability against the exact `campaign_slug` in the route.
- SEC-03: Do not expose global user search, account provider rows, sessions, or password state.
- SEC-04: Invitation responses must avoid user/account enumeration.
- SEC-05: Access-request review must show only users who requested that campaign.
- SEC-06: Prevent campaign admins from accidentally removing or demoting the last GM unless an approved override exists.
- SEC-07: Rate-limit invitation and access-request endpoints.
- SEC-08: Audit membership changes, invitations, approvals, rejections, and revocations.
- SEC-09: Mark dashboard pages and API responses `noindex,nofollow`; do not treat robots as security.

### Deploy safety requirements

- DS-01: Start with read-only member list before enabling writes.
- DS-02: Validate locally in Cloudflare parity lane and staging before production.
- DS-03: Prefer additive tables for invitations/access requests; do not mutate historical memberships broadly.
- DS-04: All deletes/updates must target exact `campaign_slug` and target user/invitation/request id.
- DS-05: Use transactions/batches for multi-step accept/approve flows when they write more than one table.

### Coupling requirements

- CPL-01: Keep page components and API contracts separate.
- CPL-02: Define transport DTOs that are not raw D1 rows.
- CPL-03: Put authorization checks in server-side API handlers/utilities, not only in client UI.
- CPL-04: Document external-facing API contracts in OpenAPI so `woa-admin` can consume them later.
- CPL-05: Avoid importing `woa-admin` concepts directly into content collections or static campaign content.

## Use cases

### UC-01: GM opens campaign admin dashboard

Actor: Campaign GM.

Flow:

1. User signs in.
2. User navigates to `/campaigns/{campaignSlug}/admin`.
3. Server resolves session and checks `campaign_memberships.role = 'gm'` for the slug.
4. Dashboard renders member-management sections for that campaign only.

### UC-02: Campaign admin invites a known email

Actor: Campaign `user-admin`.

Flow:

1. Admin opens Invite section.
2. Admin enters known email and requested role, normally `member`.
3. API normalizes email and records invitation.
4. API returns generic success.
5. Invited person authenticates and accepts invitation.
6. API creates membership for the authenticated `user.id`.

### UC-03: Signed-in user requests access

Actor: Signed-in user.

Flow:

1. User opens campaign request-access UI.
2. User submits request.
3. API records pending request for `campaign_slug` and `user.id`.
4. Campaign `user-admin` sees request in dashboard.
5. Campaign `user-admin` approves or rejects.
6. Approval creates `member` membership.

### UC-04: Campaign admin removes a member

Actor: Campaign `user-admin`.

Flow:

1. Admin opens member list.
2. Admin selects a member to remove.
3. UI shows confirmation with campaign and target identity.
4. API checks actor's `user-admin` capability.
5. API checks last-GM/self-removal safety policy.
6. API deletes exact membership row and returns refreshed member state.

### UC-05: Campaign admin changes member role

Actor: Campaign `user-admin`.

Flow:

1. Admin opens member list.
2. Admin changes member role or capability.
3. API validates target role/capability and actor's authority to grant it.
4. API updates exact row/grant.
5. API returns before/after state.

## Initial HLD

### Route and page shape

Proposed route:

```text
src/pages/campaigns/[campaign]/admin.astro
```

Page responsibilities:

- Resolve signed-in session server-side.
- Check campaign-scoped `user-admin` capability.
- Render static shell and initial data from server where practical.
- Use a small client island only for forms, pending state, optimistic refresh, and modal confirmations.

Potential island:

```text
src/components/campaign-admin/CampaignAdminPanel.ts
```

Use vanilla TypeScript first per ADR-0007 unless a later interaction scope justifies a framework island.

### Server-side helpers

Initial helpers can stay small and Astro-native:

- `getCampaignUserAdminAccess(userId, campaignSlug)`
- `listCampaignAdminMembers(campaignSlug)`
- `assertCampaignUserAdmin(actorUserId, campaignSlug)`

Do not introduce broad service layers unless implementation meets ADR-0004 triggers. A real external API contract for `woa-admin` is an abstraction trigger, so API DTO/schema documentation is appropriate.

### Data model additions likely needed

Membership listing and direct role updates can use existing `campaign_memberships`.

Invitation and application flows likely need new tables. Proposed conceptual tables, pending approval:

```text
campaign_invitations
- id
- campaign_slug
- email_canonical
- invited_role
- status: pending | accepted | revoked | expired
- invited_by_user_id
- accepted_by_user_id
- expires_at
- created_at
- updated_at

campaign_access_requests
- id
- campaign_slug
- requester_user_id
- status: pending | approved | rejected | cancelled
- reviewed_by_user_id
- reviewed_at
- created_at
- updated_at
```

If explicit non-GM `user-admin` grants are required:

```text
campaign_user_capabilities
- id
- campaign_slug
- user_id
- capability: user-admin
- granted_by_user_id
- created_at
- updated_at
- UNIQUE(campaign_slug, user_id, capability)
```

These schema changes require separate approval/migration planning.

### API contract groups

Internal route prefix can be decided during implementation. Use stable contract names and OpenAPI docs even if the initial implementation lives under `/api/campaigns/...`.

Required for first dashboard version:

- list members
- update member role
- revoke member
- create invitation
- list invitations
- revoke invitation

Required for application/request flow:

- create access request
- list access requests
- approve access request
- reject access request

Required for future extraction:

- OpenAPI spec file describing these endpoints and DTOs.
- No raw D1 rows in response contracts.
- Error codes that distinguish unauthorized, forbidden, not found, validation error, conflict, and rate limit without leaking global user existence.

## External-facing APIs for `woa-admin`

The following API capabilities should be reflected in `docs/handoff/woa-admin-user-account-management-handoff.md` because they are likely to be reused externally:

1. Campaign member list scoped by campaign slug.
2. Campaign membership role update scoped by campaign slug and target user id.
3. Campaign membership revoke scoped by campaign slug and target user id.
4. Campaign invitation create/list/revoke scoped by campaign slug.
5. Campaign access request create/list/approve/reject scoped by campaign slug.
6. Capability check endpoint or response field indicating whether the current actor has campaign `user-admin` capability.

## Open decisions

1. Should the dashboard route be `/campaigns/[campaign]/admin` or nested under another campaign settings route?
2. Are GMs allowed to grant `gm`, or only invite/add `member`?
3. Can a GM remove/demote themselves?
4. How do we prevent removal/demotion of the last GM?
5. Should invitations be email-only, account-only, or both?
6. Should invitation acceptance create accounts or require existing Better Auth sign-in/sign-up first?
7. Should explicit non-GM `user-admin` grants be supported in the first release?
8. Where should audit logs live?
9. What is the OpenAPI file location and publication process?
10. Which endpoints are internal-only initially and which are intentionally supported for external `woa-admin` use?

## Proposed rollout phases

### Phase 1: Read-only dashboard

- Route shell.
- Server-side authz.
- Member list for campaign GMs.
- No writes.

### Phase 2: Membership writes

- Remove member.
- Change role within approved policy.
- Audit events if audit storage exists; otherwise log minimal safe operational event and track audit table as blocker for production writes.

### Phase 3: Invitations

- Create/list/revoke invitations.
- Email delivery or invite-link mechanics as a separate decision.
- Acceptance flow.

### Phase 4: Access requests

- User request access.
- Campaign admin approve/reject.

### Phase 5: External contract hardening

- OpenAPI finalized.
- `woa-admin` consumes the same campaign-scoped contracts or a compatible admin gateway.

# Main Site Campaign API Refactor Guide

This guide covers the recent `woa-admin` user-account-management API contract changes that affect the main/public World of Aletheia site campaign-management integration.

The public site should use only the non-admin campaign endpoints:

- `GET /api/v1/campaigns/{campaignSlug}/admin-capability`
- `GET /api/v1/campaigns/{campaignSlug}/members`
- `POST /api/v1/campaigns/{campaignSlug}/members`
- `PUT /api/v1/campaigns/{campaignSlug}/members/{userId}`
- `DELETE /api/v1/campaigns/{campaignSlug}/members/{userId}`

Do not use the `/api/v1/admin/campaigns/*` endpoints from the main site. Those routes are for Cloudflare Access-protected admin-console support workflows only.

## Auth boundary

Public campaign endpoints remain Better Auth session only.

Expected OpenAPI security:

```yaml
security:
  - BetterAuthSession: []
```

Main-site requests should rely on the signed-in Better Auth user session/cookie.

Do not send or depend on:

- Cloudflare Access headers
- `CF-Access-Jwt-Assertion`
- admin/operator identity headers
- global admin assumptions

## Campaign authorization model

The public campaign endpoints are campaign-scoped. The current Better Auth actor must have campaign user-admin capability for the exact campaign.

By default, `campaign_memberships.role = "gm"` grants campaign user-admin capability.

A GM can administer users only within campaigns where they have that capability.

## Endpoint summary

### Check current actor capability

```http
GET /api/v1/campaigns/{campaignSlug}/admin-capability
```

Use this before rendering campaign member management controls.

Example response:

```json
{
  "campaignSlug": "crownfall",
  "actor": {
    "userId": "user_01hy6m7bq0example000000000",
    "displayName": "Mira Stone"
  },
  "canAdministerUsers": true,
  "capabilities": ["user-admin"],
  "source": "campaign-gm"
}
```

If `canAdministerUsers` is false, hide or disable member-management UI.

### List campaign members

```http
GET /api/v1/campaigns/{campaignSlug}/members
```

Optional query parameters:

- `role=gm|member`
- `limit=1..100`
- `cursor=<opaque cursor>`

Example response:

```json
{
  "campaignSlug": "crownfall",
  "items": [
    {
      "userId": "user_01hy6m7bq0example000000000",
      "displayName": "Mira Stone",
      "email": "mira@example.invalid",
      "role": "gm",
      "joinedAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-06-03T15:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### Add campaign member by exact email

```http
POST /api/v1/campaigns/{campaignSlug}/members
```

Request:

```json
{
  "email": "tamsin@example.invalid",
  "role": "member"
}
```

Important behavior:

- The API normalizes submitted email with `trim(lower(email))`.
- Lookup is performed against normalized `user.email`.
- The user must already exist.
- This creates a membership only.
- It does not invite users.
- It does not create accounts.
- It does not send membership emails.
- It returns `409` if the user is already a member, even if the requested role differs.

Success response:

```json
{
  "member": {
    "userId": "user_01hy6m7bq0example000000002",
    "displayName": "Tamsin Reed",
    "email": "tamsin@example.invalid",
    "role": "member",
    "joinedAt": "2026-06-03T15:15:00.000Z",
    "updatedAt": "2026-06-03T15:15:00.000Z"
  },
  "outcome": "created",
  "confirmationMessage": "Campaign membership created."
}
```

### Update member role

```http
PUT /api/v1/campaigns/{campaignSlug}/members/{userId}
```

Request:

```json
{
  "role": "gm",
  "reason": "Promoted to campaign GM."
}
```

Behavior:

- Updates only an existing membership.
- Does not create memberships.
- Returns `404` if the exact `(campaignSlug, userId)` membership does not exist.
- May reject unsafe role-change policy cases, such as self-demotion.

Success response:

```json
{
  "member": {
    "userId": "user_01hy6m7bq0example000000000",
    "displayName": "Mira Stone",
    "email": "mira@example.invalid",
    "role": "gm",
    "joinedAt": "2026-05-25T10:00:00.000Z",
    "updatedAt": "2026-06-03T15:15:00.000Z"
  },
  "outcome": "updated",
  "confirmationMessage": "Campaign membership updated."
}
```

`outcome` may be `updated` or `unchanged`.

### Revoke campaign member

```http
DELETE /api/v1/campaigns/{campaignSlug}/members/{userId}
```

Optional request body:

```json
{
  "reason": "Player left the table."
}
```

Success response:

```json
{
  "revokedMembership": {
    "userId": "user_01hy6m7bq0example000000000",
    "campaignSlug": "crownfall",
    "role": "member",
    "grantedAt": "2026-05-25T10:00:00.000Z",
    "updatedAt": "2026-05-25T10:00:00.000Z"
  },
  "outcome": "revoked",
  "confirmationMessage": "Campaign membership revoked."
}
```

## TypeScript DTOs

Recommended main-site types:

```ts
type CampaignRole = 'member' | 'gm';

type CampaignMember = {
  userId: string;
  displayName: string | null;
  email: string;
  role: CampaignRole;
  joinedAt?: string | null;
  updatedAt?: string | null;
};

type CampaignMemberPage = {
  campaignSlug: string;
  items: CampaignMember[];
  nextCursor: string | null;
};

type CampaignAdminCapability = {
  campaignSlug: string;
  actor: {
    userId: string;
    displayName: string | null;
  };
  canAdministerUsers: boolean;
  capabilities: Array<'user-admin'>;
  source: 'campaign-gm' | 'global-admin' | 'none';
};

type AddCampaignMemberRequest = {
  email: string;
  role: CampaignRole;
};

type MembershipRoleRequest = {
  role: CampaignRole;
  reason?: string | null;
};

type CampaignMemberCreateResponse = {
  member: CampaignMember;
  outcome: 'created';
  confirmationMessage: string;
};

type CampaignMemberUpdateResponse = {
  member: CampaignMember;
  outcome: 'updated' | 'unchanged';
  confirmationMessage: string;
};

type CampaignMembershipSummary = {
  campaignSlug: string;
  userId: string;
  role: CampaignRole;
  grantedAt?: string | null;
  updatedAt?: string | null;
};

type CampaignMemberRevokeResponse = {
  revokedMembership: CampaignMembershipSummary;
  outcome: 'revoked';
  confirmationMessage: string;
};

type ApiError = {
  error: string;
  message: string;
  requestId?: string;
};
```

## Refactor checklist

Main-site code should verify these points:

1. Public campaign endpoints are still under `/api/v1/campaigns/{campaignSlug}`.
2. Do not switch public campaign calls to `/api/v1/admin/campaigns/{campaignSlug}`.
3. Do not add Cloudflare Access auth handling to public campaign API calls.
4. Add-member email resolution now explicitly uses normalized `user.email`.
5. Do not reference `emailCanonical` in request or response types.
6. Use `email` everywhere in UI and DTOs.
7. Treat `POST /members` as create-only.
8. Use `PUT /members/{userId}` for role changes.
9. Continue displaying `confirmationMessage` after successful mutations.

## Error handling

Expected statuses:

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body, role, slug, user id, limit, or cursor. |
| `401` | Better Auth session missing/invalid. Trigger sign-in. |
| `403` | Actor lacks campaign user-admin capability. Hide controls. |
| `404` | Campaign, exact user email, or exact membership not found. |
| `409` | Already a member, unsafe role change, or mutation postcondition failed. |
| `429` | Rate limited. Disable repeated submissions and retry later. |
| `503` | Service unavailable. Keep local state unchanged and allow retry. |

Example error:

```json
{
  "error": "not_found",
  "message": "User not found for exact email.",
  "requestId": "req_01hzexample00000000000000"
}
```

## Recommended UI flow

1. Load campaign page with known `campaignSlug`.
2. Call `GET /api/v1/campaigns/{campaignSlug}/admin-capability`.
3. If `canAdministerUsers` is false, hide member-management controls.
4. If true, call `GET /api/v1/campaigns/{campaignSlug}/members`.
5. For add-member:
   - Submit exact user email.
   - Show `404` as “No existing account found for that email.”
   - Show `409` as “This user is already a campaign member.”
6. For role update:
   - Submit exact `userId`.
   - Use `PUT`, not `POST`.
7. For revoke:
   - Submit exact `userId`.
8. After mutation:
   - Show `confirmationMessage`.
   - Re-fetch members or update local state from the response.

## Non-goals for main-site refactor

Do not add UI or client behavior for:

- global user search
- admin-console user browsing
- provider/account management
- password reset workflows
- session revocation
- soft delete or deprovisioning
- invitations
- pending memberships
- access requests
- membership notification emails
- direct D1 writes
- Cloudflare Access operator workflows

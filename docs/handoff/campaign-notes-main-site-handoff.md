# Campaign Notes main-site handoff

## Source of truth

Use [`campaign-notes-api.openapi.yaml`](../contracts/campaign-notes-api.openapi.yaml) as the authoritative contract for:

- endpoint paths;
- query parameters;
- authentication headers;
- response schemas;
- visibility semantics;
- status codes and error bodies.

This handoff note is a consumer guide for `worldofaletheia.com`. If this note and the OpenAPI spec disagree, use the OpenAPI spec and update this note.

## Intended consumer shape

`worldofaletheia.com` should consume authenticated Campaign Notes reads through a server-side adapter/client.

The sister-site remains responsible for Better Auth authentication and authorization on its own routes. After that gate succeeds, the sister-site server-side adapter signs a runtime actor assertion for `woa-admin` so `woa-admin` can apply Campaign Notes visibility rules for the exact user, campaign, role, and operation.

Do not expose the Campaign Notes runtime assertion secret to browsers. Do not treat browser-direct member/GM reads as the normal integration path.

Anonymous requests with no runtime actor headers are valid only for public-note reads.

## Base endpoints

- List notes: `GET /api/v1/campaigns/{campaignSlug}/notes/documents`
- Read one note: `GET /api/v1/campaigns/{campaignSlug}/notes/documents/{documentId}`

Use the deployed API base from the OpenAPI/deployment configuration. The main site should not invent bucket names, R2 object keys, or storage paths.

## Query/filter reminders

List filters narrow the already-authorized result set. They never expand access.

Supported list query parameters:

- `title` — case-insensitive title search
- `author` — exact canonical Better Auth user id
- `type` — `session-note`, `campaign-note`, `gm-note`, `recap`, or `downtime-note`
- `sessionSlug`
- `sessionDate`
- `limit` — `1..100`, default `50`
- `cursor` — opaque pagination cursor from `nextCursor`

## Authenticated request pattern

For member/GM reads, the sister-site server-side adapter sends both headers:

```http
x-woa-runtime-actor: <base64url-json-runtime-actor-payload>
x-woa-runtime-signature: <base64url-hmac-sha256-signature>
```

The payload is JSON before base64url encoding:

```json
{
  "aud": "woa-admin:campaign-notes:v1",
  "exp": 1780000000,
  "campaignSlug": "the-weight-of-sun-and-soil",
  "userId": "better-auth-user-id",
  "role": "member",
  "operation": "notes:read"
}
```

Important constraints from the OpenAPI contract:

- `campaignSlug` must exactly match the path parameter.
- `operation` is `notes:read` for these read endpoints.
- `role` is `member` or `gm` and must still match `campaign_memberships` in `woa-admin`.
- `exp` must be in the future.
- The signature is HMAC-SHA256 over the exact `x-woa-runtime-actor` header value.
- Preview and production use separate runtime assertion secrets.

The sister-site should mint short-lived assertions server-side after its own Better Auth checks. It should not forward Better Auth cookies to `woa-admin` expecting these endpoints to authenticate them directly.

## Visibility scenarios

| Caller shape | Headers | Readable visibility |
| --- | --- | --- |
| Anonymous visitor | none | `public` only |
| Authenticated campaign member | signed runtime actor with `role: member` | `public`, `campaignMembers` |
| Authenticated campaign GM | signed runtime actor with `role: gm` | `public`, `campaignMembers`, `gm` |

Production reads expose notes with `publication: publish` only. Preview reads expose `publication: preview` and `publication: publish`.

## Response handling reminders

Prefer generated types from the OpenAPI spec where possible. The essential response shapes are:

- list: `{ campaignSlug, items, nextCursor }`
- list item: note metadata without Markdown body
- detail: note metadata plus `body`

Handle OpenAPI-defined errors per operation:

- `400` invalid request
- `401` missing or invalid runtime actor assertion when one is attempted
- `403` authenticated actor is not allowed
- `404` note not found or not readable
- `429` rate limited where documented by the operation
- `503` D1, R2, assertion-secret, or dependent service unavailable

Do not infer hidden visibility state from a `404`; the contract intentionally permits “not found or not readable”.

## Suggested adapter boundary

Keep the Campaign Notes integration behind one server-side module on the sister-site, for example:

```ts
type RuntimeActor = {
  campaignSlug: string;
  userId: string;
  role: 'member' | 'gm';
};

type ListCampaignNotesInput = {
  campaignSlug: string;
  actor?: RuntimeActor;
  title?: string;
  type?: 'session-note' | 'campaign-note' | 'gm-note' | 'recap' | 'downtime-note';
  cursor?: string;
  limit?: number;
};
```

The adapter should be the only place that knows how to sign runtime actor assertions. Route/page code should pass already-authorized actor context into the adapter and render the OpenAPI response.

## Rollout recommendation, not contract behavior

Campaign Notes are currently the first Campaign Content collection exposed through the new per-campaign Campaign Content Bucket and read API path. Other campaign article types are expected to move to the same model very soon.

`woa-admin` considers it 95%+ likely that the rest of the campaign article cutover will be ready within a few days. The sister-site should factor that into its rollout plan.

Recommended options for the sister-site team:

1. Feature-flag Campaign Notes endpoint adoption so the partial cutover can be enabled, disabled, or limited by campaign.
2. Delay production deployment if supporting split routing would create short-lived technical debt: Campaign Notes through the new endpoints while most other campaign article routes still use the older R2/content path.
3. Proceed immediately only if the adapter boundary is small enough that the near-term broader Campaign Content cutover will not require meaningful rework.

This rollout guidance is advisory. It is not part of the OpenAPI contract and does not change endpoint behavior.

## Recommended companion docs

Keep these alongside this handoff note:

- [`campaign-notes-api.openapi.yaml`](../contracts/campaign-notes-api.openapi.yaml) — source-of-truth API contract
- `campaign-notes-deployment-guide.md` — runtime assertion secret and deployment setup
- `campaign-notes-vault-sync-runbook.md` — sync/indexing lifecycle and content-source constraints

# Campaign Access (local/dev fallback)

This runbook describes the local/dev fallback gate for campaign content.

Primary Phase 2.1 operational flow now lives in [`docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`](docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md).

Auth/session testing should use the Cloudflare parity lane documented in that runbook (`pnpm dev:cf:auth`).
Plain `pnpm dev` is the fast lane for UI/content iteration and is not authoritative for Better Auth runtime behavior.

## Scope

- Applies only to Campaign domain routes:
  - `/campaigns/[campaign]` (Campaign Content `pages/index`)
  - `/campaigns/[campaign]/about` (Campaign Content `pages/about`)
  - `/campaigns/[campaign]/notes`
  - `/campaigns/[campaign]/notes/[documentId]`
  - `/campaigns/[campaign]/assets/[...path]`
- Non-campaign domains stay public-by-default and do not use this gate.

## Model (fallback only)

- `visibility: public` → visible to everyone
- `visibility: campaignMembers` → requires local/dev session + membership-role mapping (`member` or `gm`)
- `visibility: gm` → requires local/dev session + membership-role mapping with `role = 'gm'`

This path is intended for localhost-only fallback behavior when real auth/session/D1 integration is unavailable.
Better Auth remains the authoritative auth/session boundary outside this localhost-only fallback lane.

## Configuration

Set `CAMPAIGN_MEMBERSHIPS` as JSON in your environment:

```json
{
  "dev123": { "campaigns": { "brad": "gm", "barry": "member" } },
  "dev999": { "campaigns": { "barry": "member" } }
}
```

The gate reads cookie `aletheia-dev-session=<sessionId>` and checks the configured role for that campaign slug.

Compatibility note:

- legacy array form is still accepted and normalizes to `member`:

```json
{
  "dev123": { "campaigns": ["brad", "barry"] }
}
```

If you rename a campaign slug, update any private local `CAMPAIGN_MEMBERSHIPS` fixture values to match the new slug. Tracked campaign-access config files are no longer used for membership management.

## Example (local)

1. Set env:

```bash
export CAMPAIGN_MEMBERSHIPS='{"dev123":{"campaigns":{"brad":"gm","barry":"member"}}}'
```

2. Add browser cookie for local site:

```text
aletheia-dev-session=dev123
```

3. Open the campaign root, about, notes, or asset routes. `campaignMembers` Campaign Content is visible only when the mapping matches.

## Current replacement status

Phase 2.1 has replaced primary resolver internals with Better Auth session + D1 membership-role checks. The local cookie map path remains only as an explicit development fallback in `src/utils/campaign-access.ts`; production and staging membership mutations belong to `woa-admin`.

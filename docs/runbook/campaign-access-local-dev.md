# Campaign Access (local/dev fallback)

This runbook describes the legacy local/dev fallback gate for campaign content.

Primary Phase 2.1 operational flow now lives in [`docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md`](docs/runbook/phase-2-1-auth-google-d1-mailjet-email.md).

Auth/session testing should use the Cloudflare parity lane documented in that runbook (`pnpm dev:cf:auth`).
Plain `pnpm dev` is the fast lane for UI/content iteration and is not authoritative for Better Auth runtime behavior.

## Scope

- Applies only to Campaign domain routes:
  - [`/campaigns/[...slug]`](src/pages/campaigns/[...slug].astro)
  - [`/campaigns/[campaign]/sessions`](src/pages/campaigns/[campaign]/sessions/index.astro)
  - [`/campaigns/[campaign]/sessions/[...slug]`](src/pages/campaigns/[campaign]/sessions/[...slug].astro)
  - [`/campaigns/[campaign]/[family]`](src/pages/campaigns/[campaign]/[family]/index.astro)
  - [`/campaigns/[campaign]/[family]/[...slug]`](src/pages/campaigns/[campaign]/[family]/[...slug].astro)
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
  "dev123": { "campaigns": { "brad": "gm", "sample-campaign": "member" } },
  "dev999": { "campaigns": { "barry": "member" } }
}
```

The gate reads cookie `aletheia-dev-session=<sessionId>` and checks the configured role for that campaign slug.

Legacy compatibility note:

- legacy array form is still accepted during transition and normalizes to `member`:

```json
{
  "dev123": { "campaigns": ["brad", "sample-campaign"] }
}
```

If you rename a campaign slug, update local membership config to match the new slug or use the rename helper documented in [`docs/runbook/campaign-authoring-and-rename.md`](docs/runbook/campaign-authoring-and-rename.md).

Campaign visibility defaults are now maintained in [`config/campaign-access.config.json`](config/campaign-access.config.json).

- This file is validated at runtime through [`normalizeCampaignAccessConfig()`](src/utils/campaign-access-config.ts:18).
- Safe default is empty config (no overrides).
- Existing frontmatter `visibility` remains the source of truth when no valid campaign override exists.
- Security precedence is fail-safe: config may tighten to `campaignMembers`, but never downgrade `campaignMembers` content to `public`.

Config format:

```json
{
  "campaigns": {
    "brad": { "visibility": "campaignMembers" },
    "barry": { "visibility": "public" },
    "sample-campaign": { "visibility": "public" }
  }
}
```

## Example (local)

1. Set env:

```bash
export CAMPAIGN_MEMBERSHIPS='{"dev123":{"campaigns":{"brad":"gm","sample-campaign":"member"}}}'
```

2. Add browser cookie for local site:

```text
aletheia-dev-session=dev123
```

3. Open campaign/session routes. `campaignMembers` content is visible only when mapping matches.

## Current replacement status

Phase 2.1 has replaced primary resolver internals with Better Auth session + D1 membership-role checks. The local cookie map path remains only as an explicit development fallback in `src/utils/campaign-access.ts`.

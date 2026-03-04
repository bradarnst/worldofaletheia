# Campaign Access (legacy local/dev fallback)

This runbook describes the legacy local/dev fallback gate for campaign content.

Primary Phase 2.1 operational flow now lives in [`docs/runbook/phase-2-1-auth-google-d1-cloudflare-email.md`](docs/runbook/phase-2-1-auth-google-d1-cloudflare-email.md).

## Scope

- Applies only to Campaign domain routes:
  - [`/campaigns/[...slug]`](src/pages/campaigns/[...slug].astro)
  - [`/campaigns/[campaign]/sessions`](src/pages/campaigns/[campaign]/sessions/index.astro)
  - [`/campaigns/[campaign]/sessions/[...slug]`](src/pages/campaigns/[campaign]/sessions/[...slug].astro)
- Non-campaign domains stay public-by-default and do not use this gate.

## Model (fallback only)

- `visibility: public` → visible to everyone
- `visibility: campaignMembers` → requires local/dev session + membership mapping

This path is intended for localhost-only fallback behavior when real auth/session/D1 integration is unavailable.

## Configuration

Set `CAMPAIGN_MEMBERSHIPS` as JSON in your environment:

```json
{
  "dev123": { "campaigns": ["brad", "sample-campaign"] },
  "dev999": { "campaigns": ["barry"] }
}
```

The gate reads cookie `aletheia-dev-session=<sessionId>` and checks if that session id is mapped to the campaign slug.

Campaign visibility defaults are now maintained in [`src/content/campaigns/access.config.json`](src/content/campaigns/access.config.json).

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
export CAMPAIGN_MEMBERSHIPS='{"dev123":{"campaigns":["brad","sample-campaign"]}}'
```

2. Add browser cookie for local site:

```text
aletheia-dev-session=dev123
```

3. Open campaign/session routes. `campaignMembers` content is visible only when mapping matches.

## Current replacement status

Phase 2.1 has replaced primary resolver internals with Better Auth session + D1 membership checks. The local cookie map path remains only as an explicit development fallback in [`createCampaignAccessResolverFromRequest()`](src/utils/campaign-access.ts:154).

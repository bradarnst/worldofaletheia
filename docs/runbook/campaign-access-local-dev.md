# Campaign Access (Phase 2 local/dev gate)

This runbook describes the temporary Phase 2 local/dev access gate for campaign content.

## Scope

- Applies only to Campaign domain routes:
  - [`/campaigns/[...slug]`](src/pages/campaigns/[...slug].astro)
  - [`/campaigns/[campaign]/sessions`](src/pages/campaigns/[campaign]/sessions/index.astro)
  - [`/campaigns/[campaign]/sessions/[...slug]`](src/pages/campaigns/[campaign]/sessions/[...slug].astro)
- Non-campaign domains stay public-by-default and do not use this gate.

## Model

- `visibility: public` → visible to everyone
- `visibility: campaignMembers` → requires local/dev session + membership mapping

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

## Future replacement

The gate is intentionally isolated in [`campaign-access.ts`](src/utils/campaign-access.ts) so Better Auth + D1 can replace resolver internals without changing campaign route authorization calls.

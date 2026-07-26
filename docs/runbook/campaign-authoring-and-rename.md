# Runbook: Campaign Content Authoring and Slug Changes

This runbook documents the active Campaign Content surfaces consumed by this site. The previous local Campaigns collection and repo-side campaign rename workflow are not publication paths for live Campaign Content.

## Source of truth

- `woa-admin` owns Campaign Content records, assets, campaign metadata, and persistence.
- This repo is a read-only runtime consumer through the server-to-server Campaign Content source boundary.
- The exact campaign slug is shared by Campaign Content, the Campaign Gate, and D1 `campaign_memberships`.
- Do not publish Campaign Content by adding files under `src/content/campaigns` or by adding a campaign mapping to `scripts/content-sync/`.

## Live content shape

The active V1 collection keys are `pages` and `notes`. Document IDs are one path segment.

| Purpose | Campaign Content identity | Public website path |
| --- | --- | --- |
| Campaign root | `pages/index` | `/campaigns/<campaign-slug>` |
| About page | `pages/about` | `/campaigns/<campaign-slug>/about` |
| Notes index | `notes` collection | `/campaigns/<campaign-slug>/notes` |
| Note detail | `notes/<document-id>` | `/campaigns/<campaign-slug>/notes/<document-id>` |
| Asset | bucket-relative `assets/<path>` | `/campaigns/<campaign-slug>/assets/<path>` |

The website evaluates the Campaign Gate before fetching protected content. It then sends only the viewer's membership-derived visibility scope to `woa-admin`. Campaign Content asset references are rewritten to the website asset path so browser HTML does not expose or call the `woa-admin` origin.

## Adding or changing content

1. Create or edit the campaign and its Campaign Content through the approved `woa-admin` operator or authoring workflow.
2. Ensure the campaign has a root item with collection key `pages` and document ID `index`.
3. Add the optional about item as `pages/about`.
4. Add notes to the generic `notes` collection with one-segment document IDs.
5. Store referenced assets under the campaign's `assets/` source prefix and use `assets/<path>` references in Markdown.
6. Set each item's Content Visibility to `public`, `campaignMembers`, or `gm` as intended.
7. Confirm the Campaign Gate and `campaign_memberships` use the same exact campaign slug.

Repo `pnpm content:sync` commands do not publish these records.

## Changing a campaign slug

A campaign slug change is a coordinated service and data migration. This repo has no supported campaign rename command for live Campaign Content.

1. Change the canonical campaign identity through the owning `woa-admin` workflow.
2. Migrate Campaign Content records and assets to the new slug in the owning service.
3. Update the Campaign Gate entry and D1 `campaign_memberships` through their approved operator workflows.
4. Review durable links and decide explicitly whether redirects are required.
5. Verify the new website paths below and confirm the old slug fails safely.

Do not use the retired repo-side campaign folder rename script as a substitute for this migration; it cannot update the authoritative service data, assets, gate, or memberships.

## Verification checklist

- Campaign root resolves at `/campaigns/<campaign-slug>` from `pages/index`.
- About resolves at `/campaigns/<campaign-slug>/about` from `pages/about` when present and readable.
- Notes list at `/campaigns/<campaign-slug>/notes` contains only readable items from the generic `notes` collection.
- Note detail resolves at `/campaigns/<campaign-slug>/notes/<document-id>`.
- Asset references resolve through `/campaigns/<campaign-slug>/assets/<path>` and do not expose the source origin.
- Anonymous, member, and GM access matches the Campaign Gate plus Content Visibility.
- Source failures and unreadable records fail closed without leaking source details.

## Related docs

- `docs/content-ingestion-user-guide.md`
- `docs/runbook/campaign-access-local-dev.md`
- `docs/runbook/campaign-content-source-boundary.md`

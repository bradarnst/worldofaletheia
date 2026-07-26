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

## Retired main-site Campaign Notes table cleanup

The main-site `campaign_note_documents` table is retired and must remain empty. Migration `0015_campaign_note_documents.sql` is retained only as historical and recovery documentation; active migration plans skip it. Migration `0016_drop_legacy_campaign_note_documents.sql` removes the table from databases where an earlier plan created it.

Apply this setup in every World of Aletheia D1 environment after deploying this change.

1. Check whether the table exists:

   ```bash
   pnpm wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_note_documents';"
   pnpm wrangler d1 execute DB --remote --env staging --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_note_documents';"
   pnpm wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'campaign_note_documents';"
   ```

2. If any command returns the table name, confirm it has no rows before continuing:

   ```bash
   pnpm wrangler d1 execute DB --local --command "SELECT COUNT(*) AS legacy_note_count FROM campaign_note_documents;"
   pnpm wrangler d1 execute DB --remote --env staging --command "SELECT COUNT(*) AS legacy_note_count FROM campaign_note_documents;"
   pnpm wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS legacy_note_count FROM campaign_note_documents;"
   ```

   The expected count is `0`. Stop and export unexpected rows before applying the cleanup; this ticket intentionally provides no data migration into live Campaign Content.

3. Preview and apply the ordered migration plan:

   ```bash
   pnpm db:migrate:plan:local:dry-run
   pnpm db:migrate:plan:local
   pnpm db:migrate:plan:staging:dry-run
   pnpm db:migrate:plan:staging
   pnpm db:migrate:plan:prod:dry-run
   pnpm db:migrate:plan:prod
   ```

4. Repeat the table-existence commands from step 1. Successful cleanup returns no rows.

No application rollback is required because active code does not read this table. If operator recovery is necessary, recreate the empty historical schema in the affected environment:

```bash
pnpm wrangler d1 execute DB --local --file ./migrations/0015_campaign_note_documents.sql
pnpm wrangler d1 execute DB --remote --env staging --file ./migrations/0015_campaign_note_documents.sql
pnpm wrangler d1 execute DB --remote --file ./migrations/0015_campaign_note_documents.sql
```

Restore exported rows only for investigation; do not reconnect application behavior to this table.

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
- [`campaign-content-source-boundary.md`](campaign-content-source-boundary.md)

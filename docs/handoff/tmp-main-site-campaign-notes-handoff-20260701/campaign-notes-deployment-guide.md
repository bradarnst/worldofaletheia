# Campaign Notes deployment guide

This guide covers the required operator steps for the Campaign Notes V1 API/service in `woa-admin`.

## Why setup is required

Campaign Notes adds new Cloudflare resources and D1 tables:

- R2 buckets for Markdown bodies.
- D1 tables from `migrations/spells/0005_campaign_notes.sql`.
- Runtime assertion secrets used by the new API auth boundary.

The application can build before these exist, but the Campaign Notes routes require them at runtime.

## One-time Cloudflare resource setup

Create the R2 buckets declared in `wrangler.jsonc`:

```bash
pnpm r2:create:campaign-notes:preview
pnpm r2:create:campaign-notes:prod
```

If a bucket already exists, Wrangler will report that instead of creating a duplicate. Verify with:

```bash
pnpm wrangler r2 bucket list
```

## Secrets

These secrets must be created before Campaign Notes routes can authenticate runtime callers. Set them separately for preview and production. Do not commit the values.

First generate two independent high-entropy values for each environment. One practical local
option is:

```bash
node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
```

Generate separate values for:

- preview runtime assertion signing
- production runtime assertion signing

Use the interactive Wrangler prompt so the secret value is not written to shell history.

Preview:

```bash
pnpm wrangler secret put CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET --env preview
```

Production:

```bash
pnpm wrangler secret put CAMPAIGN_NOTES_RUNTIME_ASSERTION_SECRET
```

Verify that the secret names exist without printing values:

```bash
pnpm wrangler secret list --env preview
pnpm wrangler secret list
```

The main-site runtime caller must use the matching environment's secret to HMAC-sign its assertion payloads. Preview callers must not use production secrets, and production callers must not use preview secrets.

`CAMPAIGN_NOTES_ENVIRONMENT` is a non-secret Wrangler var in `wrangler.jsonc`:

- preview: `preview`
- production: `production`

## Preview rollout order

1. Create the preview R2 bucket if it does not exist.
2. Set preview Campaign Notes secrets.
3. Validate locally:

   ```bash
   pnpm test
   pnpm check
   pnpm build
   ```

4. Inspect pending preview migrations:

   ```bash
   pnpm db:migrations:list:preview
   ```

   If `0004_current_state_spell_schema.sql` appears as pending but the preview database already
   has the current spell schema, do not rerun that spell cutover migration. This can happen when a
   database was initialized by an older migration name such as `0003_reset_final_spell_schema.sql`.
   Confirm the database is already current-state first:

   ```bash
   pnpm wrangler d1 execute DB --remote --env preview --command "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'spell_dataset_state'"
   pnpm wrangler d1 execute DB --remote --env preview --command "PRAGMA table_info(spells)"
   ```

   If `spell_dataset_state` is absent and `spells` has no `dataset_version` column, baseline the
   superseded migration name in Wrangler's migration table, then re-list migrations:

   ```bash
   pnpm wrangler d1 execute DB --remote --env preview --command "INSERT INTO d1_migrations (name) SELECT '0004_current_state_spell_schema.sql' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '0004_current_state_spell_schema.sql')"
   pnpm db:migrations:list:preview
   ```

   Only use that baseline step after confirming the current-state spell schema. Do not use it on a
   legacy spell database that still has `spell_dataset_state` and `dataset_version` columns.

   If applying `0005_campaign_notes.sql` fails with `no such column: archived_at`, the database has
   an older experimental `campaign_note_documents` table from the superseded direct-storage plan.
   Confirm it has no rows before dropping it:

   ```bash
   pnpm wrangler d1 execute DB --remote --env preview --command "PRAGMA table_info(campaign_note_documents)"
   pnpm wrangler d1 execute DB --remote --env preview --command "SELECT COUNT(*) AS count FROM campaign_note_documents"
   ```

   If the table has `r2_key`, `content_hash`, and `created_by_user_id` columns and `count` is `0`,
   remove that empty legacy table and rerun the migration:

   ```bash
   pnpm wrangler d1 execute DB --remote --env preview --command "DROP TABLE campaign_note_documents"
   pnpm db:migrate:campaign-notes:preview
   ```

   If the table has rows, do not drop it. Preserve/export it and migrate useful content through a separately approved operator migration or by placing valid Markdown at the stable R2 source paths for scanner reconciliation.

5. Apply preview D1 migrations:

   ```bash
   pnpm db:migrate:campaign-notes:preview
   ```

6. Deploy preview:

   ```bash
   pnpm deploy:preview
   ```

7. Smoke-test preview Campaign Notes routes.

8. Configure and verify the Campaign Notes scanner/reconciler for preview. The scanner is internal
    service behavior, not a V1 HTTP endpoint: it should run on the configured schedule/operator task
    for every campaign slug whose R2 prefix `campaigns/{campaignSlug}/` should be indexed. Confirm
    scanner runs insert/update valid Markdown notes, record scan errors for invalid files, and
    soft-archive previously indexed notes when their stable R2 source object is missing.

9. Configure and verify Campaign Notes cleanup for preview. The cleanup task is internal service
   behavior, not a V1 HTTP endpoint: it should call the expired write-session cleanup with a
   conservative per-run limit for each configured campaign slug. Confirm it transitions expired
   `checkedOut` sessions to `expired`, deletes only abandoned create-session objects that have no
   current D1 document, and preserves stable source objects for finalized/current documents.

## Production rollout order

1. Create the production R2 bucket if it does not exist.
2. Set production Campaign Notes secrets.
3. Take a production D1 backup/export before applying schema changes.
4. Inspect pending production migrations:

   ```bash
   pnpm db:migrations:list:prod
   ```

5. Apply production D1 migrations:

   ```bash
   pnpm db:migrate:campaign-notes:prod
   ```

6. Deploy production:

   ```bash
   pnpm deploy
   ```

7. Enable the production scanner/reconciler schedule/operator task for the configured campaign
    slugs. Keep the cadence conservative at rollout, monitor scan-run and scan-error rows, then tune
    based on expected Obsidian/R2 sync latency. V1 intentionally does not expose a public or runtime
    scanner-trigger HTTP endpoint.

8. Enable the production expired-session cleanup schedule/operator task for the configured campaign
   slugs. Keep the per-run limit conservative at rollout and monitor system audit events for
   abandoned upload deletions. V1 intentionally does not expose a public or runtime cleanup-trigger
   HTTP endpoint.

## Ordering notes

- Build does not require R2 buckets or D1 migrations.
- Deploying before the migration is risky: existing pages can still work, but Campaign Notes endpoints will fail until the new tables exist.
- Applying the migration before deploy is safe because existing code ignores the new tables.
- Preview and production use separate D1 databases and R2 buckets; do not reuse secrets between environments.
- Direct R2 sync is not visible to Campaign Notes readers until the internal scanner validates and
  reconciles the Markdown into D1 current state.
- Cleanup is deliberately conservative because runtime uploads target stable source paths: it should
  never delete objects attached to current/finalized D1 documents.

# Content Index P0 Root Cause (2026-03-24)

## Outcome

- `content_index` now exists in both remote D1 databases and both environments are populated.
- Verified row count after remediation: `77` in staging and `77` in production.

## Root Cause

1. Operator runs of `pnpm content:sync` defaulted to local D1 because `CONTENT_INDEX_SYNC_MODE` / `CONTENT_INDEX_SYNC_ENV` were not set.
2. Even when the remote target was set explicitly, remote index sync failed because `scripts/content-sync/content-index-writer.mjs` wrapped the SQL file in `BEGIN TRANSACTION` / `COMMIT`, which `wrangler d1 execute --remote --file ...` rejects.
3. `scripts/content-sync/apply-sync.mjs` catches index-sync failures and continues, so the overall sync still finished as a nominal success after cloud writes and validation.

## Evidence

- Before remediation, both remotes returned no `content_index` table or `idx_content_index_*` indexes.
- Shell env check showed `R2_ACCESS_KEY_ID=true`, `R2_SECRET_ACCESS_KEY=true`, `CONTENT_INDEX_SYNC_MODE=false`, `CONTENT_INDEX_SYNC_ENV=false`.
- Repository CI inspection found no GitHub Actions sync workflow under `.github/`; no CI sync path exists yet, so the verified execution path is operator-run local sync.
- `pnpm db:migrate:plan:staging:dry-run` produced a false `schema_object_conflict` because the script's fallback numeric parsing was polluted by Wrangler's staging config warning output.
- First explicit remote sync attempt failed with: `To execute a transaction, please use the state.storage.transaction() ... instead of the SQL BEGIN TRANSACTION ... statements.`
- After applying `migrations/0006_content_index.sql`, removing SQL transaction wrappers, and re-running remote sync, both remotes reported:
  - table `content_index`
  - indexes `idx_content_index_collection_slug`, `idx_content_index_collection_type_subtype`, `idx_content_index_source_etag`, `idx_content_index_visibility_campaign`
  - `SELECT COUNT(*) FROM content_index;` => `77`

## Commands Used

```bash
pnpm db:migrate:plan:staging:dry-run
pnpm db:migrate:plan:prod:dry-run
pnpm exec wrangler d1 execute DB --remote --env staging --command "SELECT type, name, tbl_name FROM sqlite_master WHERE name = 'content_index' OR name LIKE 'idx_content_index%';"
pnpm exec wrangler d1 execute DB --remote --command "SELECT type, name, tbl_name FROM sqlite_master WHERE name = 'content_index' OR name LIKE 'idx_content_index%';"
bash -lc 'source .envrc >/dev/null 2>&1 || true; node -e "const keys=[\"R2_ACCESS_KEY_ID\",\"R2_SECRET_ACCESS_KEY\",\"CONTENT_INDEX_SYNC_MODE\",\"CONTENT_INDEX_SYNC_ENV\"]; console.log(JSON.stringify(Object.fromEntries(keys.map((k)=>[k, Boolean(process.env[k])]))));"'
pnpm exec wrangler d1 execute DB --remote --env staging --file "./migrations/0006_content_index.sql"
pnpm exec wrangler d1 execute DB --remote --file "./migrations/0006_content_index.sql"
bash -lc 'source .envrc >/dev/null 2>&1 || true; CONTENT_INDEX_SYNC_MODE=remote CONTENT_INDEX_SYNC_ENV=staging pnpm content:sync:dry-run'
bash -lc 'source .envrc >/dev/null 2>&1 || true; CONTENT_INDEX_SYNC_MODE=remote pnpm content:sync:dry-run'
pnpm exec vitest run scripts/content-sync/content-index-writer.test.mjs
bash -lc 'source .envrc >/dev/null 2>&1 || true; CONTENT_INDEX_SYNC_MODE=remote CONTENT_INDEX_SYNC_ENV=staging pnpm content:sync && CONTENT_INDEX_SYNC_MODE=remote pnpm content:sync'
pnpm exec wrangler d1 execute DB --remote --env staging --command "SELECT COUNT(*) AS total_rows FROM content_index; SELECT collection, COUNT(*) AS row_count FROM content_index GROUP BY collection ORDER BY collection;"
pnpm exec wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS total_rows FROM content_index; SELECT collection, COUNT(*) AS row_count FROM content_index GROUP BY collection ORDER BY collection;"
```

## Follow-Up

- Added explicit helper scripts: `pnpm content:sync:staging`, `pnpm content:sync:prod`, and matching dry-run variants.
- Staging still emits a Wrangler config warning because `wrangler.jsonc` does not repeat `r2_buckets` under `env.staging`; this did not block D1 remediation, but it remains environment-config debt.
- The staging migration dry-run parser remains brittle until `scripts/db-migrate-auth-plan.mjs` is hardened against Wrangler warning noise.

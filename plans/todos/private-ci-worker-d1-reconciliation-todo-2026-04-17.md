# Private CI → Worker D1 Reconciliation Todo

## Status

- Date: 2026-04-17
- Status: In progress

## Current temporary state (2026-04-18)

- Local/Wrangler reconciliation now uses **one SQL file per managed collection**.
- Each collection file runs in its own `BEGIN IMMEDIATE` / `COMMIT` transaction so
  `content_search` and `content_index` stay aligned **within that collection**.
- Empty managed collections must still emit delete-only reconciliation SQL so stale
  rows are removed from both tables.
- This is intentional short-term tech debt while deploy-time reconciliation still
  depends on `wrangler d1 execute --file ...`.
- Site-wide atomic reconciliation across all collections is still deferred to the
  private CI → Worker D1 write path below.

## Why

The current content sync path uses `wrangler d1 execute --file ...` to reconcile `content_index` and `content_search`.
This now runs per-collection transactional files as a temporary compromise, but it is still constrained by Wrangler/D1 file execution behavior and cannot provide one atomic commit for the entire site sync.

The preferred cloud path is a private deploy-time reconciliation endpoint, invoked only from CI/CD, that writes to D1 using Worker bindings instead of generated SQL files.

## Target shape

1. CI builds the canonical `content_index` and `content_search` payloads.
2. CI sends authenticated chunked requests to a private Worker endpoint.
3. The Worker writes to D1 using bindings (`prepare`, `bind`, `batch`).
4. `content_search` remains the write surface for search rows.
5. `content_search_fts` remains trigger-maintained.

## Constraints

- Endpoint must not be public.
- Intended callers are GitHub Actions or equivalent CI only.
- Use Cloudflare Access service tokens or equivalent strong request authentication.
- Keep writes idempotent and chunked.
- Do not introduce unnecessary adapter/service abstraction beyond the concrete deployment boundary.

## Tasks

- Define private auth mechanism for CI → Worker requests.
- Design payload contract for collection-scoped reconciliation batches.
- Implement Worker handler for content discovery reconciliation.
- Add retry-safe upsert/delete semantics per collection chunk.
- Replace temporary per-collection Wrangler transactions with a true cloud write path that can preserve whole-sync atomicity when needed.
- Add operational logging/reporting for chunk failures.
- Update deploy scripts to call the private reconciliation endpoint instead of `wrangler d1 execute --file` for cloud environments.
- Keep local Wrangler SQL-file sync available as a developer fallback unless/until a better local path exists.

## Success criteria

- Staging/prod content sync no longer depends on generated SQL files.
- Large content bodies do not risk SQL size/file execution failures.
- Search/index reconciliation remains idempotent.
- Temporary Wrangler fallback remains collection-atomic until the private endpoint replaces it.
- Existing FTS trigger behavior is preserved.

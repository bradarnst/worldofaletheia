# D1 as Canonical Cloud Content Index and R2 as Blob Storage

## Status

- Date: 2026-04-05
- Status: Accepted
- Deciders: Brad
- Implementation status: Implemented in repository on 2026-04-05

## Context and Problem Statement

The project introduced R2 manifests as part of the earlier cloud-content rollout, but that mechanism was not part of the intended long-term architecture.

Current repository state shows the runtime has already moved away from manifest-backed lookup:

- `src/lib/r2-content-loader.mjs` resolves collection entries from D1 lookup rows.
- `src/lib/content-index-loader.mjs` reads `id`, `slug`, `r2_key`, `visibility`, and `campaign_slug` from `content_index`.
- `scripts/content-sync/apply-sync.mjs` publishes R2 objects and then reconciles D1 `content_index` rows.
- `scripts/content-sync/manifests.mjs` no longer exists in the repository.

What remains is architectural drift in plans and docs, plus one important hardening gap: `content_index` still uses a global primary key on `id`, even though content identity is collection-local in Astro and can collide across collections.

The project needs an explicit decision that removes any remaining ambiguity:

1. R2 is for object storage only.
2. D1 is the sole cloud lookup and discovery index.
3. Recovery from drift is rerun-sync or rebuild-index-from-source, not manifest fallback.

## Decision Drivers

- Remove accidental complexity that was introduced without product intent.
- Align architecture with the already-implemented runtime path.
- Keep Cloudflare-native responsibilities clear: D1 indexes, R2 stores blobs.
- Preserve Astro-native content loading without adding service/adaptor layers.
- Eliminate split-brain risk between D1 rows and a second lookup contract in R2.
- Harden cloud lookup identity before D1 becomes the only supported source of truth.

## Considered Options

### Option 1: Keep D1 and R2 manifests in parallel

Use D1 for discovery/search while retaining manifests as a secondary body lookup and recovery contract.

**Pros**

- Extra fallback artifact in R2.
- Easier manual inspection of bucket state.

**Cons**

- Maintains duplicate lookup contracts.
- Increases sync and doc complexity.
- Reintroduces drift risk between D1 and manifests.
- Solves an operational preference the project owner has explicitly rejected.

### Option 2: Make D1 the sole cloud lookup/index and keep R2 for blobs only (Chosen)

Use `content_index` as the canonical source for cloud content discovery and `collection + id/slug -> r2_key` resolution. R2 stores markdown and media objects only.

**Pros**

- Single source of truth for cloud lookup and discovery.
- Simpler sync, runtime, and runbook model.
- Strong fit with planned D1-backed discovery/search strategy.
- Removes manifest-specific maintenance and drift risk.

**Cons**

- No R2-only fallback path when D1 is stale or unavailable.
- Requires stronger D1 schema/identity guarantees.
- Requires doc cleanup across older planning material.

### Option 3: Remove D1 lookup and derive R2 keys deterministically at runtime

Use a deterministic object-key convention and keep D1 only for metadata discovery.

**Pros**

- Reduces stored lookup fields in D1.
- Avoids one column of index state.

**Cons**

- Re-splits body lookup from discovery.
- Couples runtime fetch semantics tightly to object-key naming conventions.
- Weakens future flexibility for path/key migration.

## Decision Outcome

Chosen option: Option 2 - D1 is the canonical cloud content index and R2 is blob storage only.

### Policy

1. Cloud runtime lookup must resolve through D1 `content_index`; manifests are not part of the supported contract.
2. `content_index` owns cloud lookup fields required for body retrieval and discovery, including at minimum:
   - `collection`
   - `id`
   - `slug`
   - `r2_key`
   - `visibility`
   - `campaign_slug`
   - freshness metadata such as `source_etag`, `source_last_modified`, and `indexed_at`
3. R2 stores markdown/media objects and variants only; it does not store authoritative entry-manifest contracts.
4. Sync recovery is source-driven:
   - rerun sync, or
   - rebuild the D1 index from source content and current object-key derivation rules.
5. `content_index` identity must be hardened so collection-local Astro IDs cannot collide across collections.
6. Older manifest-based planning documents are historical only and must be updated or superseded in active runbooks/handoffs.

### Consequences

#### Positive

- Runtime and sync architecture now match product intent.
- One canonical cloud lookup contract reduces accidental complexity.
- D1 discovery/search and D1 body lookup can evolve together.
- Operator recovery story is simpler and source-of-truth aligned.

#### Negative

- D1 outages or stale rows have no manifest fallback lane.
- Table migration work is required to correct `content_index` identity semantics.
- Historical docs referencing manifests can mislead until cleaned up.

#### Neutral

- Obsidian remains the source of truth under ADR-0001.
- Astro-native loaders remain the application read model.
- This decision does not require new repository/service/adapter layers under ADR-0004.


## Implementation Update

Implementation is now complete in the repository for the intended scope of this decision.

Implemented artifacts:

- `migrations/0008_content_index_collection_scoped_identity.sql` rebuilds `content_index` around `PRIMARY KEY (collection, id)`.
- `scripts/content-sync/content-index-writer.mjs` now upserts on `ON CONFLICT(collection, id)` and sorts rows by `collection + id`.
- `scripts/db-migrate-auth-plan.mjs` includes the new migration and safely handles already-applied lookup-schema steps.
- `src/lib/content-index-loader.test.mjs` covers collection-local ID handling under the D1-only lookup contract.
- `src/lib/content-index-repo.ts` and `src/lib/content-index-repo.test.ts` were updated so index queries remain correct under collection-scoped identity.
- Active manifest-era planning and ingestion docs were updated or marked historical so they no longer describe manifests as current architecture.

Validation status at implementation time:

- `pnpm test`: passed
- `pnpm build`: passed
- `pnpm db:migrate:plan:local`: passed
- local D1 schema verification: `content_index` now reports `collection` PK position `1` and `id` PK position `2`
- Cloudflare parity lane: blocked in this environment by Wrangler authentication (`pnpm dev:cf:build` could not run remote mode without login)

## Links

- `plans/adrs/0010-global-content-source-mode-cloud-default.md`
- `plans/adrs/0011-discovery-navigation-and-search-index-strategy.md`
- `plans/adrs/0012-content-producer-extraction-strategy.md`
- `plans/d1-manifest-removal-and-d1-index-hardening-handoff-to-code-2026-04-05.md`

# Site-Wide Search Architecture and FTS5 Delivery Plan

## Status

- Date: 2026-04-17
- Status: Active implementation plan
- Required phase order: `S1 -> S3 -> S2`

## Goal

Deliver site-wide search on the canonical D1 content index, ending in mandatory D1 FTS5 body-text search while preserving fail-closed campaign visibility rules.

## Constraints

1. Astro-native first; no new service/adapter/contract layer.
2. D1 remains the canonical lookup and discovery index.
3. R2 remains blob storage only.
4. Protected campaign content must never leak when auth/session context is missing or ambiguous.
5. `/search` and `/api/search` remain `noindex, nofollow`.

## Stable Search API Contract

The existing response envelope remains stable across all phases:

```json
{
  "ok": true,
  "query": "string",
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  },
  "items": []
}
```

S1 may extend the success payload with additive metadata, but must not remove or rename `ok`, `query`, `pagination`, or `items`.

## Visibility/Authz Policy

### Search Scope Matrix

| Viewer state | Included content |
| --- | --- |
| No valid session | Public content only |
| Authenticated, no campaign memberships | Public content only |
| Authenticated campaign member | Public content + `campaignMembers` content for campaigns they can access |
| Authenticated GM | Public content + `campaignMembers` + `gm` content for campaigns they GM |
| Authz lookup failure | Public content only (deny-by-default for protected rows) |

### Phase S1 Contract Additions

S1 adds additive scope metadata so the UI can explain which visibility lane was applied without exposing protected campaign identifiers.

Recommended success payload extension:

```json
{
  "scope": {
    "isAuthenticated": true,
    "visibility": "campaignMembers",
    "reason": "authenticated_member_access",
    "campaignAccess": {
      "membershipCount": 2,
      "gmCount": 0
    }
  }
}
```

## Delivery Phases

### S1 — Contract and Authz Foundation

1. Preserve the current `/api/search` success envelope.
2. Add request-aware visibility resolution using the authenticated session plus D1 campaign memberships.
3. Keep deny-by-default behavior when auth resolution or membership lookup is unavailable.
4. Return additive scope metadata for visibility-aware UI messaging.
5. Keep current metadata-only search query path and ordering unchanged.

### S3 — Mandatory D1 FTS5 Search

1. Add D1 FTS5 storage for title/body search.
2. Extend sync/indexing to keep FTS rows aligned with canonical content index rows.
3. Switch search query execution to the FTS path while preserving the S1 API envelope and authz rules.
4. Keep rollback available by retaining the metadata query path until parity is verified.

### S2 — Post-FTS Relevance and UX Tuning

1. Add weighting/ranking adjustments.
2. Add snippets/highlighting where useful.
3. Refine empty-state and search guidance messaging.
4. Tune pagination and result presentation without changing the stable contract keys.

## Query and Rollback Notes

### S1 Query Path

- Continue using `content_index` metadata search (`title`, `summary`, `slug`, `type`, `subtype`, `tags_json`).
- Apply visibility/authz constraints before term matching.
- Preserve ordering: `updated_at DESC, slug ASC`.

Rollback: remove scope metadata and revert visibility filtering to public-only.

### S3 Query Path

- FTS5 returns candidate row ids.
- Canonical row shaping still comes from `content_index`.
- Visibility/authz filtering remains authoritative in the canonical query layer.

Rollback: keep the metadata search path callable until FTS validation is complete.

## Verification Gates

### Gate A — After S1

1. `pnpm test`
2. `pnpm build`
3. Report files changed, authz decisions, and verification results.
4. Pause for explicit approval.

### Gate B — After S3

1. `pnpm test`
2. `pnpm build`
3. Report migration/schema/query-path changes and rollback notes.
4. Pause for explicit approval.

### Gate C — After S2

1. `pnpm test`
2. `pnpm build`
3. Report final delivery and closure state.

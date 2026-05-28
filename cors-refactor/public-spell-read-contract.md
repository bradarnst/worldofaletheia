# Public spell read contract

## Status

- Date: 2026-05-16
- Status: Workstream B contract complete and publicly exposed
- Scope: public, read-only spell data consumed by the main site and other public HTTP clients
- Source of truth: [`public-spell-read-api.openapi.yaml`](./public-spell-read-api.openapi.yaml)
- Related handoff: [Public Spell API Handoff Notes](./public-spell-read-handoff.md)
- Related plan: [D1-Backed Spell Platform Plan](../plans/d1-backed-spell-platform-plan-2026-05-11.md)
- Related HLD: [D1-Backed Spell Platform High-Level Design](../plans/d1-backed-spell-platform-hld-2026-05-11.md)
- Related ADRs: [ADR-0002](../adrs/0002-use-a-d1-backed-public-spell-read-contract-for-the-main-site-and-keep-exports-temporarily-during-migration.md), [ADR-0004](../adrs/0004-remove-json-and-migration-artifacts.md)

## Purpose

This document is the short companion to the authoritative OpenAPI contract at `docs/contracts/public-spell-read-api.openapi.yaml`.

Use the OpenAPI file for route shapes, schemas, parameters, response codes, operation IDs, examples, normalization semantics, and public error behavior. Keep this Markdown file limited to orientation, implementation status, deployment/topology notes, and rollout guidance so the contract does not drift across two detailed formats.

Use [`public-spell-read-handoff.md`](./public-spell-read-handoff.md) for concise consumer-facing query examples that mirror the admin dashboard filter model.

For the current browser-hydration addition, the OpenAPI file is also the source of truth for spell-detail CORS headers and the `OPTIONS /api/v1/spells/{spell_id}` preflight operation. Consumers should treat those headers and preflight semantics as part of the public contract for cross-origin detail reads.

## Why OpenAPI 3.1.2

- OpenAPI is the source of truth for this public HTTP contract.
- `openapi: 3.1.2` is used because current tooling support is more mature than 3.2.x and this contract does not need 3.2-only features.
- The OpenAPI authoring step did not add generator or validator dependencies to this repo.

## Boundary

- **Producer:** admin repo for the first implementation, backed by canonical D1 spell tables.
- **Consumer:** main-site adapter code and any other public HTTP client that conforms to the contract.
- **Access path:** the canonical deployed public namespace is `https://worldofaletheia.com/api/v1/*`. Browsers and server-side clients may call the API, but browsers must never receive D1 credentials or direct D1 access.
- **Write behavior:** none. This contract is read-only.
- **Excluded:** admin APIs, admin-only delete behavior, operator edit metadata, auth/session design, and direct reuse of admin CRUD handlers.

## Contract summary

The v1 public API defines five read-only operations:

- `GET /api/v1/spell-types`
- `GET /api/v1/source-spell-types`
- `GET /api/v1/spells`
- `GET /api/v1/spells/{spell_id}`
- `GET /api/v1/spell-suggestions`

The public response model preserves snake_case field names and exposes the current spell schema: `spell_id`, `spell_name`, `spell_types`, `keywords` (`string[]`), `full_cost`, `casting_roll`, `range`, `duration`, `description`, `statistics`, `archmagisters_counsel`, and `source_lineage`.

The OpenAPI contract also documents standard public error behavior for current rollout expectations:

- `400` for invalid `spell_id` on detail lookup
- `404` when a spell is not found
- `429` for rate limiting
- `503` for temporary service unavailability

The `GET /api/v1/spells/{spell_id}` contract now also documents browser-facing CORS behavior for approved World of Aletheia origins:

- successful `200` detail responses include the documented CORS headers
- `400`, `404`, and `503` responses from the application include the same CORS policy
- `429` remains part of the public contract, but if rate limiting is enforced at the Cloudflare edge then edge configuration must preserve the same CORS headers for browser clients to read the response normally
- `OPTIONS /api/v1/spells/{spell_id}` is now part of the documented public contract for preflight handling

## B2 implementation status

Workstream B2 is implemented in this repo, and the canonical public deployment boundary has now been exposed under the main site URL space and approved outside this repo.

Shipped pieces:

- public query functions in `src/lib/server/spells/database.ts`
  - `listSpellTypes`
  - `listSourceSpellTypes`
  - `listSpells`
  - `getSpellById`
  - `suggestSpells`
- read-only HTTP handlers under `src/routes/api/v1/**/+server.ts`
- contract coverage in `tests/contract/public-spell-read-api.spec.ts`

Validated behavior includes:

- full public field shape for list/detail responses
- stable `spell_id` lookup and UUIDv7 validation/normalization
- spell detail CORS headers for approved origins on `200`, `400`, `404`, and `503`
- spell detail `OPTIONS` preflight handling
- canonical spell type ordering
- canonical source spell type metadata availability
- full-text list search across `spell_name`, `description`, and `archmagisters_counsel`
- spell-name-specific prefix filtering through `name`
- literal wildcard escaping for `%`, `_`, and `\` on prefix filters
- case-insensitive exact type filtering
- source spell name prefix filtering
- source spell type filtering through `sourceType`
- pagination normalization and page clamping
- suggestion semantics, including empty-query behavior
- maximum page-size behavior without exceeding the D1 bound-parameter limit used by the implementation

## Compatibility rules

- Public consumers must treat `spell_id` as the stable identifier. `spell_name` is display text and may change.
- Additive changes require OpenAPI and contract test updates.
- Removing fields, changing field meaning, or changing query semantics is a breaking change.

## Implementation shape

Workstream B2 implements the OpenAPI contract as a thin public query layer over the active canonical D1 tables, with read-only HTTP handlers matching the documented operation IDs and schemas. The implementation intentionally remains in the private admin repo for near-term velocity, with a later extraction to a dedicated public service/repo treated as a bounded structural refactor rather than a redesign.

Why this shape was chosen:

- the active canonical tables already contain the v1 public fields
- the active canonical tables and indexes now support name-prefix, source-lineage-prefix, type-filter, and ordered list behavior
- a thin query layer keeps a clear public boundary without introducing projection drift too early

Projection tables or views remain valid later options if contract tests become hard to maintain or measured query behavior shows the thin layer is no longer sufficient.

## Public exposure status

The canonical public spell routes are now exposed at `https://worldofaletheia.com/api/v1/*` and were tested and approved outside this repo. The routes remain **public and unauthenticated** at the HTTP layer.

Chosen topology:

- the canonical public route namespace should be `https://worldofaletheia.com/api/v1/*`
- `/api/v1/*` should be reachable there without application-level authentication
- `https://woa-admin.worldofaletheia.com` remains an admin-only hostname and must not become the long-term public consumer base URL
- the admin dashboard must remain protected separately behind Cloudflare Access
- Cloudflare should handle rate limiting and similar edge protections for the public spell routes
- main-site browser code should still call main-site-local endpoints or page loads rather than hard-coding a service origin into frontend code

Deployment note:

- If the same Worker codebase serves both admin and public spell routes, edge/routing configuration must present the public API under `https://worldofaletheia.com/api/v1/*` while keeping admin surfaces private.
- An implementation detail such as a separate Worker, route-level policy, or origin mapping is acceptable as long as the public contract stays anchored under the main site URL space.

## Rollout defaults

The first main-site adapter should assume:

- **Access pattern:** main-site-local endpoints or server-side page loads delegate to the documented `/api/v1/*` routes
- **Authentication:** none for the current public spell routes
- **Caching:** none initially; add cache only after real usage or latency shows a need
- **Failure behavior:** surface standard HTTP contract errors directly in the client boundary, especially `429` and `503`, rather than switching to a second data source
- **Cross-origin spell detail:** approved browser origins may call `GET /api/v1/spells/{spell_id}` directly using the documented CORS headers; if a browser client sends preflight, `OPTIONS /api/v1/spells/{spell_id}` is part of the supported contract
- **Rollback shape:** normal deployment rollback or a fix-forward release is sufficient
- **Migration scope:** migrate spell list, filters, and detail first; leave type-ahead and suggestions for a later slice

## Spell detail CORS addition

This contract addition is intentionally narrow. The public API was already in use; this update documents and exposes the extra browser-consumption behavior needed for saved spell-list hydration on the main site.

What changed in the contract:

- the OpenAPI spec now documents CORS response headers on `GET /api/v1/spells/{spell_id}` for `200`, `400`, `404`, `429`, and `503`
- the OpenAPI spec now includes `OPTIONS /api/v1/spells/{spell_id}`
- the allowlist is documented in the OpenAPI header definitions rather than duplicated as a separate source of truth here

How consumers should read the OpenAPI update:

- `Access-Control-Allow-Origin` is returned only for approved origins
- `Vary: Origin` is part of the contract and matters for caches
- `Access-Control-Allow-Methods` is `GET, OPTIONS`
- `Access-Control-Allow-Headers` is `Accept, Content-Type`
- no credentials are part of this contract; this remains public read-only access

Why the OpenAPI file matters here:

- it defines which spell-detail responses are expected to be browser-readable cross-origin
- it defines `OPTIONS` as a supported operation rather than an implementation accident
- it keeps main-site adapter behavior anchored to the same source of truth as server-side consumers

These are rollout defaults, not long-term guarantees of the contract itself.

## Non-goals and unresolved questions

- Admin APIs are out of scope and should be reviewed separately if needed later.
- Main-site implementation details remain out of scope for this repo.
- The exact Cloudflare edge/origin configuration that maps `https://worldofaletheia.com/api/v1/*` to the implementation lives outside this contract doc.
- Slugs, stable spell-type IDs, faceted counts, and redirect behavior for renamed or deleted spells remain unresolved.

## Backlog context for future public APIs

Future contract work is more likely to expand **public** APIs than admin APIs. The main backlog themes called out during planning are:

- search/findability beyond the initial prefix-and-type contract
- campaign-facing public read APIs

These are context notes only, not implementation tasks for Workstream B or the first Workstream C slice.

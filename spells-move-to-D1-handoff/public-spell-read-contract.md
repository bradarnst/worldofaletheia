# Public spell read contract

## Status

- Date: 2026-05-16
- Status: Workstream B contract and public rollout handoff
- Scope: public, read-only spell data consumed by the main site and other public HTTP clients
- Source of truth: [`public-spell-read-api.openapi.yaml`](./public-spell-read-api.openapi.yaml)
- Related plan: [D1-Backed Spell Platform Plan](../plans/d1-backed-spell-platform-plan-2026-05-11.md)
- Related HLD: [D1-Backed Spell Platform High-Level Design](../plans/d1-backed-spell-platform-hld-2026-05-11.md)
- Related ADRs: [ADR-0002](../adrs/0002-use-a-d1-backed-public-spell-read-contract-for-the-main-site-and-keep-exports-temporarily-during-migration.md), [ADR-0004](../adrs/0004-remove-json-and-migration-artifacts.md)

## Purpose

This document is the short companion to the authoritative OpenAPI contract at `docs/contracts/public-spell-read-api.openapi.yaml`.

Use the OpenAPI file for route shapes, schemas, parameters, response codes, operation IDs, examples, normalization semantics, and public error behavior. Keep this Markdown file limited to orientation, implementation status, deployment/topology notes, and rollout guidance so the contract does not drift across two detailed formats.

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

The v1 public API defines four read-only operations:

- `GET /api/v1/spell-types`
- `GET /api/v1/spells`
- `GET /api/v1/spells/{spell_id}`
- `GET /api/v1/spell-suggestions`

The public response model preserves snake_case field names and exposes the current spell schema: `spell_id`, `spell_name`, `spell_types`, `keywords` (`string[]`), `full_cost`, `casting_roll`, `range`, `duration`, `description`, `statistics`, `archmagisters_counsel`, and `source_lineage`.

The OpenAPI contract also documents standard public error behavior for current rollout expectations:

- `400` for invalid `spell_id` on detail lookup
- `404` when a spell is not found
- `429` for rate limiting
- `503` for temporary service unavailability

## B2 implementation status

Workstream B2 is implemented in this repo, but the canonical public deployment boundary still needs to be exposed under the main site URL space before Workstream C begins.

Shipped pieces:

- public query functions in `src/lib/server/spells/database.ts`
  - `listSpellTypes`
  - `listSpells`
  - `getSpellById`
  - `suggestSpells`
- read-only HTTP handlers under `src/routes/api/v1/**/+server.ts`
- contract coverage in `tests/contract/public-spell-read-api.spec.ts`

Validated behavior includes:

- full public field shape for list/detail responses
- stable `spell_id` lookup and UUIDv7 validation/normalization
- canonical spell type ordering
- case-insensitive prefix search
- literal wildcard escaping for `%`, `_`, and `\`
- case-insensitive exact type filtering
- source spell name prefix filtering
- source spell type filtering
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

## First-rollout exposure decision

For the first main-site rollout, the spell routes in this contract are intended to be **public and unauthenticated**.

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

- **Precondition:** do not begin main-site/client-side implementation against this contract until the canonical deployed public routes at `https://worldofaletheia.com/api/v1/*` are reachable and verified
- **Access pattern:** main-site-local endpoints or server-side page loads delegate to the documented `/api/v1/*` routes
- **Authentication:** none for the current public spell routes
- **Caching:** none initially; add cache only after real usage or latency shows a need
- **Failure behavior:** surface standard HTTP contract errors directly in the client boundary, especially `429` and `503`, rather than switching to a second data source
- **Rollback shape:** normal deployment rollback or a fix-forward release is sufficient
- **Migration scope:** migrate spell list, filters, and detail first; leave type-ahead and suggestions for a later slice

These are rollout defaults, not long-term guarantees of the contract itself.

## Non-goals and unresolved questions

- Admin APIs are out of scope and should be reviewed separately if needed later.
- Main-site implementation details remain out of scope for this repo.
- The exact Cloudflare edge/origin configuration that maps `https://worldofaletheia.com/api/v1/*` to the implementation lives outside this contract doc.
- Full-text search, slugs, stable spell-type IDs, faceted counts, and redirect behavior for renamed or deleted spells remain unresolved.

## Backlog context for future public APIs

Future contract work is more likely to expand **public** APIs than admin APIs. The main backlog themes called out during planning are:

- search/findability beyond the initial prefix-and-type contract
- campaign-facing public read APIs

These are context notes only, not implementation tasks for Workstream B or the first Workstream C slice.

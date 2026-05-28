# Public spell API handoff notes

## Source of truth

Use [`public-spell-read-api.openapi.yaml`](./public-spell-read-api.openapi.yaml) as the only contract source of truth for:

- endpoints
- query parameters
- response schemas
- normalization behavior
- examples
- public error behavior
- spell-detail CORS headers and `OPTIONS` preflight behavior

This handoff note is only a usage guide for common query combinations.

For the current contract addition, the OpenAPI spec is the authoritative place to read the new browser-consumption behavior for `GET /api/v1/spells/{spell_id}`. This Markdown file only explains how to apply that part of the spec.

## Base routes

- List spells: `GET /api/v1/spells`
- Type-ahead suggestions: `GET /api/v1/spell-suggestions`
- Spell types (active classification facet): `GET /api/v1/spell-types`
- Source spell types (source-lineage facet): `GET /api/v1/source-spell-types`
- Spell detail: `GET /api/v1/spells/{spell_id}`

## Filter mapping

These query parameters correspond to the admin dashboard filter model:

- full-text search → `q`
- spell name prefix → `name`
- source spell prefix → `sourceName`
- active spell type dropdown → `type`
- source spell type dropdown → `sourceType`

## Semantics to remember

- `q` is full-text search over `spell_name`, `description`, and `archmagisters_counsel`.
- `name` is a spell-name prefix filter.
- `sourceName` is a source spell-name prefix filter.
- `type` is an exact spell type label filter.
- `sourceType` is an exact source spell type label filter.
- Filters are combinable on `GET /api/v1/spells`.
- Prefix filters are case-insensitive and treat `%`, `_`, and `\` literally.
- Type-ahead suggestions remain prefix-based and still use `GET /api/v1/spell-suggestions?q=...`.
- `GET /api/v1/spells/{spell_id}` now supports cross-origin browser reads for approved origins through the OpenAPI-documented CORS headers.
- `OPTIONS /api/v1/spells/{spell_id}` is now a supported preflight operation in the public contract.

## Spell detail CORS addition

This is a contract addition for an API surface that is already in use. The goal is to let the main site hydrate saved spell details directly from the public detail endpoint without requiring a same-origin proxy.

Read this in the OpenAPI spec first:

- the `GET /api/v1/spells/{spell_id}` operation description
- the response headers documented for `200`, `400`, `404`, `429`, and `503`
- the `OPTIONS /api/v1/spells/{spell_id}` operation
- the shared header definitions under `components.headers`

What the new contract support means:

- browser clients from approved origins may call spell detail directly
- successful detail reads and normal application error responses use the same spell-detail CORS policy
- if the browser sends preflight, `OPTIONS /api/v1/spells/{spell_id}` is the supported path
- no credentials are involved; this remains public read-only access

Headers to expect on supported spell-detail CORS responses:

```http
Access-Control-Allow-Origin: <approved requesting origin>
Vary: Origin
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Accept, Content-Type
```

Implementation note for consumers:

- `429` is part of the contract, but if rate limiting is generated at the Cloudflare edge then that edge response must preserve the same CORS policy for browser code to read the rate-limit payload normally.

## Query examples

Spell detail read:

```text
GET /api/v1/spells/019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46
```

Spell detail CORS preflight:

```text
OPTIONS /api/v1/spells/019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46
Origin: https://worldofaletheia.com
Access-Control-Request-Method: GET
```

Full-text only:

```text
GET /api/v1/spells?q=hidden steel
```

Spell name prefix only:

```text
GET /api/v1/spells?name=Abs
```

Source spell prefix only:

```text
GET /api/v1/spells?sourceName=Absorb
```

Filter by active spell type:

```text
GET /api/v1/spells?type=Adventurer%20Spells
```

Filter by source spell type:

```text
GET /api/v1/spells?sourceType=Adventurer%20Spells
```

Use the admin-style filter set together:

```text
GET /api/v1/spells?q=hidden steel&name=Abs&sourceName=Absorb&type=Adventurer%20Spells&sourceType=Adventurer%20Spells
```

Add pagination when needed:

```text
GET /api/v1/spells?q=ward&page=1&pageSize=50
```

Type-ahead suggestions:

```text
GET /api/v1/spell-suggestions?q=Abs
```

Type-ahead suggestions with the same narrowing filters:

```text
GET /api/v1/spell-suggestions?q=Abs&type=Adventurer%20Spells&sourceName=Absorb&sourceType=Adventurer%20Spells
```

## Recommended companion docs

Keep these alongside the OpenAPI file:

- [`public-spell-read-contract.md`](./public-spell-read-contract.md) for rollout status, topology, and compatibility rules
- this handoff note for concise usage examples

No additional contract document is needed beyond those two Markdown companions and the OpenAPI file.

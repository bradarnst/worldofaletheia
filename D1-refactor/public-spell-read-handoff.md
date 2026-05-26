# Public spell API handoff notes

## Source of truth

Use [`public-spell-read-api.openapi.yaml`](./public-spell-read-api.openapi.yaml) as the only contract source of truth for:

- endpoints
- query parameters
- response schemas
- normalization behavior
- examples
- public error behavior

This handoff note is only a usage guide for common query combinations.

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

## Query examples

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

# Proposed OpenAPI change: source spell type metadata

## Purpose

The main-site spell browser currently consumes `GET /api/v1/spell-types` for the active spell type dropdown, but `sourceType` remains backed by a hard-coded list in this repo because the public contract does not expose authoritative source spell type metadata.

If `sourceType` is a first-class public filter, the contract should expose an authoritative list for that facet so consumers do not need to hard-code options or risk drift from the underlying dataset.

## Recommended contract change

Add a new read-only endpoint:

- `GET /api/v1/source-spell-types`

Recommended semantics:

- returns the authoritative ordered list of distinct public `source_lineage.source_spell_types` labels
- includes only values that can legitimately be used with the existing `sourceType` query parameter
- preserves canonical casing in responses
- returns an empty array when no active dataset is initialized
- remains public and unauthenticated like the other spell read endpoints

## Suggested OpenAPI patch

```yaml
paths:
  /api/v1/source-spell-types:
    get:
      operationId: listSourceSpellTypes
      tags:
        - Public Spells
      summary: List active source spell types
      description: >-
        Returns active public source spell type labels ordered by canonical source
        spell type sort order. Only labels that may be used with the `sourceType`
        filter are returned. If no active dataset is initialized, the response is
        an empty array. No authentication is required for this route in the
        current public rollout.
      responses:
        '200':
          description: Ordered active source spell type labels.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/PublicSpellType'
              examples:
                default:
                  value:
                    - Adventurer Spells
                    - Air Spells
                    - Body Control Spells
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'
```

## Companion contract updates

If this endpoint is added, the following companion updates should ship with it:

1. Add `GET /api/v1/source-spell-types` to the contract summary and handoff docs.
2. Clarify that `GET /api/v1/spell-types` is for active spell classification filters, while `GET /api/v1/source-spell-types` is for the source-lineage facet.
3. Add contract tests covering:
   - ordered distinct values
   - canonical casing preservation
   - empty-array behavior when no active dataset is initialized
   - exclusion of labels that are not valid for the `sourceType` filter

## Main-site follow-up after service support exists

Once the producer implements this endpoint, the main site should:

1. add a `listSourceSpellTypes()` adapter function
2. replace `src/data/spells/source-spell-type-filter-options.ts`
3. render the `sourceType` dropdown from API-provided metadata instead of a hard-coded list

This keeps the public contract authoritative for both type facets and removes metadata drift from the consumer.

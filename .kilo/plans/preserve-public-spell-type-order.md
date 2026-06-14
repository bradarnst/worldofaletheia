# Preserve Public Spell Type API Order

## Goal

Refactor the Sorcerer Spells UI so active spell type labels from `GET /api/v1/spell-types` preserve the externally owned public API contract order instead of being re-sorted in this repo.

## Context

`docs/contracts/public-spell-read-api.openapi.yaml` states that `/api/v1/spell-types` returns active public spell type labels ordered by current spell type sort order. Current page code calls `sortSpellTypeLabels()` on `listSpellTypes()` results, which discards that canonical ordering.

Do not edit files under `docs/contracts/`.

## Implementation Steps

1. Update active spell type handling in:
   - `src/pages/systems/gurps/resources/sorcerer-spells/index.astro`
   - `src/pages/systems/gurps/resources/sorcerer-spells/all/index.astro`
   - `src/pages/systems/gurps/resources/sorcerer-spells/all/[page].astro`
2. Remove `sortSpellTypeLabels()` usage for `listSpellTypes()` results only.
3. Keep `listSourceSpellTypes()` behavior unchanged unless implementation review finds a specific contract-order requirement for source spell types.
4. Remove now-unused imports if `sortSpellTypeLabels()` is no longer needed in any touched file.

## Validation

Run:

```bash
pnpm test src/adapters/public-spell-api.test.ts src/utils/spell-list-storage.test.ts
pnpm build
```

## Acceptance Criteria

- Active spell type dropdowns and browse chips render in API-provided order.
- Source spell type filtering behavior is not unintentionally changed.
- No changes are made to `docs/contracts/`.
- Targeted tests and build pass.

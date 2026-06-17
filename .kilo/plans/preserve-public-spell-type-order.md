# Preserve Public Spell Type API Order

## Status

Complete / front-end-display-only reference as of 2026-06-17.

## Boundary

Spell data, spell types, spell type canonical ordering, spell counts, and spell API contract behavior are external. This repo does not own those backend/data semantics.

This repo may only own front-end display choices, such as whether a list returned by an external API should be preserved as-is or sorted for a specific user-facing presentation.

Do not edit files under `docs/contracts/`.

## Outcome

The intended front-end display outcome is:

- active spell type labels from `GET /api/v1/spell-types` are displayed in the external API-provided order
- source spell type labels may still be sorted by the front end when that is only a presentation decision
- no in-repo task exists for changing spell type data, spell type ordering authority, or spell API behavior

## Historical Goal

The original goal was to refactor the Sorcerer Spells UI so active spell type labels from `GET /api/v1/spell-types` preserve the externally owned public API contract order instead of being re-sorted in this repo.

## Validation Notes

If this area is touched again, validate only front-end presentation behavior:

```bash
pnpm test src/adapters/public-spell-api.test.ts src/utils/spell-list-storage.test.ts
pnpm build
```

Acceptance remains front-end-only:

- Active spell type dropdowns and browse chips render in API-provided order.
- Source spell type filtering behavior is not unintentionally changed.
- No changes are made to `docs/contracts/`.
- No spell data/API/backend task is created in this repo.

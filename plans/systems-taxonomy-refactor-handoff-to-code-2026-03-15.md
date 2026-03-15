# Systems Taxonomy Refactor Handoff to Code (2026-03-15)

## Scope

Implement the Systems collection taxonomy correction defined in ADR-0008:

- `type` => system family (`general`, `gurps`, future families)
- `subtype` => topic domain (`magic`, `combat`, `skill`, etc.)

This handoff covers the immediate refactor items only:

1. schema update,
2. content migration,
3. subtype enum correction (`equipment`).

## Constraints

- Keep Astro-native content patterns intact (no new service/adaptor layers).
- Do not change route structure in this refactor (`/systems/*` remains as-is).
- Keep changes limited to taxonomy correctness and compatibility updates.

## Must-Implement Refactor Tasks

### 1) Update Systems schema in `src/content.config.ts`

Current issue:

- `systems.type` is topic-based (`magic`, `combat`, `skill`, etc.), which conflicts with intended hierarchy.

Required change:

- Replace Systems schema with explicit two-axis taxonomy:
  - `type`: system family enum
  - `subtype`: topic enum

Target baseline:

- `type`: `general | gurps`
- `subtype`: `magic | combat | skill | language | character | economy | social | equipment`

Notes:

- Keep `subtype` required for now to force canonical categorization.
- Do not add a separate `systemName`/`ttrpg` field.

### 2) Migrate existing Systems content frontmatter in `src/content/systems/**`

Current issue:

- Entries store topic in `type` and some entries carry `ttrpg: gurps` as ad hoc system-family metadata.

Required migration rules:

1. For all `src/content/systems/gurps/*.md` entries:
   - set `type: gurps`
   - set `subtype` to previous topic value
2. Remove `ttrpg` field where present (taxonomy now canonical in `type`).
3. Ensure all entries have valid `subtype` according to enum.

Observed files to include immediately:

- `src/content/systems/gurps/Aletheia Language Rules and Mechanics.md`
- `src/content/systems/gurps/Character Ideas.md`
- `src/content/systems/gurps/Using GURPS Equipment Price Lists for Aletheia.md`

Example migration pattern:

- Before: `type: language`, `subtype:`, `ttrpg: gurps`
- After: `type: gurps`, `subtype: language`

### 3) Add `equipment` to allowed Systems subtype values

Current issue:

- Existing content already uses `type: equipment` semantics, but schema enum does not include `equipment`.

Required change:

- Ensure `equipment` is present in Systems `subtype` enum.

## Compatibility and Validation

After implementation, Code should validate:

1. `pnpm build` passes with no collection-schema validation errors.
2. Systems pages still render:
   - `src/pages/systems/index.astro`
   - `src/pages/systems/[...slug].astro`
3. Any filtering/grouping logic that assumed topic-in-`type` is updated to read `subtype` where topic behavior is intended.

## Out of Scope (for this handoff)

- New system families beyond `general` and `gurps`
- UX redesign of systems listing/navigation
- New search/filter UI controls
- Route hierarchy changes or new dynamic route segments

## Acceptance Criteria

1. Systems schema encodes family/topic split (`type` + `subtype`).
2. Existing gurps content validates under new schema with no ad hoc `ttrpg` dependency.
3. `equipment` is a valid topic classification.
4. Build succeeds and systems pages continue to resolve entries correctly.

## References

- ADR: `plans/adrs/0008-systems-taxonomy-type-subtype-model.md`
- Schema: `src/content.config.ts`
- Content root: `src/content/systems/`

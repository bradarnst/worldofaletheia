# Sorcerer Spell List Client UX Plan

## Status

- Date: 2026-05-08
- Status: Planning only
- Scope: public-repo implementation plan for client-side Sorcerer spell-list UX in this repository only
- Audience: implementation agent and future maintainers

## Purpose

This plan covers the Sorcerer Spells client-side spell-list feature work that will happen in this repository.

The feature is intentionally bounded to public-site consumption and visitor-side convenience behavior:

- consume exported spell data
- let a visitor build a temporary spell list locally
- support add/remove actions from spell views
- provide a print-friendly spell-list page

This plan does not cover private admin authoring or canonical spell-data management. That work belongs in the separate private admin repository.

## Scope

In scope:

- consuming exported spell data records that include stable `spell_id`
- localStorage-backed temporary spell-list state in the browser
- add/remove actions from spell detail or spell-listing views
- a print-friendly spell-list route/page
- concise user messaging about the temporary/local persistence boundary
- acceptance and verification steps for implementation

Out of scope:

- breadcrumbs
- D1-backed persistence
- search implementation work beyond any minimal existing spell browsing surface needs
- cross-device sync
- account-linked saved spell lists
- multiple named spell lists
- advanced spell-list sharing/import/export

Breadcrumbs are explicitly out of scope for this plan and are tracked separately in `plans/todos/breadcrumb-restoration-navigation-ux-2026-05-08.md`.

D1/search/persistent saved spell lists are explicitly deferred and should not be pulled into this implementation slice.

## Architectural Constraints

- Astro-native first
- static by default
- no unnecessary abstraction layers
- vanilla TypeScript for client-side interactivity
- keep data access straightforward and local to the relevant public-site routes/components

This feature should align with the repo’s existing direction:

- build-time data consumption for spell content where possible
- bounded client-side enhancement only where local visitor state is required
- no new generalized service/adapter layer for a single feature slice

## Data Contract Expectations

The public spell dataset consumed by this repo must include a stable `spell_id` per spell.

Requirements:

- `spell_id` is the storage key used by the client spell list
- `spell_id` must be treated as stable across exports
- the client spell list should persist IDs, not large copied spell objects, where practical
- spell details shown in the spell-list page should be resolved from the current exported dataset during page/runtime rendering

Rationale:

- ID-based storage reduces local duplication
- stable IDs make downstream exports compatible with temporary local lists across normal site revisits
- this keeps the public repo’s responsibility focused on consumption rather than record authority

## UX Direction

The UX should be simple, explicit, and low-friction.

Core behaviors:

- visitors can add a spell to their temporary spell list from spell surfaces
- visitors can remove a spell from the same surfaces or from the spell-list page
- the spell-list page shows the currently selected spells in a print-friendly format
- messaging should clarify that the list is stored only on the current browser/device

Recommended user messaging:

- short inline note near spell-list controls or page intro
- example tone: "Your spell list is stored only in this browser on this device."
- if storage is cleared or the browser/device changes, the list should be expected to disappear

Do not overexplain. This is a convenience feature, not an account-backed library.

## Implementation Shape

Recommended implementation elements in this repo:

- exported spell dataset consumption in the relevant spell pages/routes
- a small vanilla TypeScript client module responsible for:
  - reading/writing the localStorage key
  - toggling `spell_id` membership
  - broadcasting or updating UI state on the current page
- add/remove UI affordances on spell views
- a dedicated spell-list route/page that:
  - hydrates the selected IDs from localStorage
  - resolves them against the exported spell dataset
  - renders a print-friendly presentation

Keep the implementation thin. This does not need a generalized state management solution.

## Print-Friendly Page Requirements

The spell-list page should prioritize legibility and practical tabletop use.

Requirements:

- readable on screen and when printed
- avoids unnecessary navigation chrome in print mode
- presents spell entries in a stable, scan-friendly order
- supports remove actions on screen without polluting printed output
- handles the empty state clearly

Recommended empty-state behavior:

- explain that no spells are currently saved to the temporary list
- direct the visitor back to spell browsing/add actions

## Phase Plan

## Phase 1 - Data Consumption and Client State Foundation

Goal:

- establish stable exported spell consumption and temporary client-side storage keyed by `spell_id`

Tasks:

1. confirm/export contract includes stable `spell_id`
2. add minimal client storage utility for local spell-list IDs
3. define storage key and duplicate-handling behavior
4. ensure missing/unknown IDs fail gracefully if an export changes

Gate:

- list state can be added/removed locally
- page reload preserves the temporary list in the same browser
- unknown IDs do not break the page

## Phase 2 - Add/Remove Actions on Spell Views

Goal:

- make spell-list interaction available where users actually browse spells

Tasks:

1. add action controls to relevant spell views
2. reflect current added/removed state in the UI
3. keep messaging concise about browser-local persistence only

Gate:

- user can add and remove from the main spell browsing/detail surfaces
- duplicate adds are prevented or collapse to idempotent behavior
- no server dependency is introduced

## Phase 3 - Spell-List Page and Print Treatment

Goal:

- deliver a dedicated page for reviewing and printing the temporary spell list

Tasks:

1. implement spell-list route/page
2. resolve saved `spell_id` values against the current exported dataset
3. render readable on-screen layout and print-specific treatment
4. provide empty-state and stale-ID handling

Gate:

- page works with zero, one, or many selected spells
- print preview is readable and omits unnecessary UI chrome
- stale or missing IDs are handled without breaking rendering

## Phase 4 - Acceptance Hardening

Goal:

- verify the feature works as a bounded static-site enhancement

Tasks:

1. test add/remove flows
2. test reload persistence
3. test empty-state behavior
4. test print preview behavior
5. test graceful handling of malformed or missing localStorage entries
6. run `pnpm build`

Gate:

- build passes
- no hydration/runtime errors in normal usage paths
- persistence limitations are communicated clearly and accurately

## Verification Checklist

Minimum verification:

1. add a spell from a spell surface
2. reload the page and confirm the spell remains in the temporary list
3. remove the spell and confirm the UI updates immediately
4. navigate to the spell-list page and confirm the selected spells render correctly
5. open print preview and confirm the page remains readable and focused
6. clear localStorage or simulate missing entries and confirm graceful recovery
7. run `pnpm build`

## Non-Goals

- no breadcrumb restoration work in this slice
- no D1-backed server persistence
- no search/discovery overhaul as part of this feature
- no account-backed saved spell libraries
- no named list management
- no admin editing capability in this repo

## Success Criteria

- this repo can consume exported spell data with stable `spell_id`
- visitors can build a temporary spell list locally with add/remove actions
- the list survives reloads in the same browser via localStorage
- the dedicated spell-list page is usable and print-friendly
- the UX states the persistence limitation clearly without adding complexity
- the implementation remains Astro-native, static-first, and minimally abstracted

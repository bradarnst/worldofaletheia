# UI Revamp and Daisy Extraction Plan (Draft for Review)

## Status

- Date: 2026-04-11
- Status: Draft
- Owner: Brad
- Scope: Front-end presentation layer only
- Architectural mode: read-only planning; no `src/` implementation in this document
- Primary goal: move from DaisyUI-shaped presentation toward Astro + Tailwind-owned UI primitives without disrupting the current Astro-native architecture

---

## 1) Why This Plan Exists

Current UI feedback is consistent across several visible surfaces:

- dark themes are not carrying readability reliably,
- tab-style navigation feels clunky,
- cards, badges, and buttons feel heavier than desired,
- DaisyUI sped up initial delivery but is now shaping too much of the visual language,
- the current styling layer has drifted into a mixed system of Daisy component classes, Tailwind utilities, custom theme overrides, and legacy utility CSS.

This plan is designed to answer two questions at the same time:

1. how to slowly pick DaisyUI apart without destabilizing the site, and
2. when and how to start defining the actual new look and feel instead of doing only technical cleanup.

---

## 2) Guiding Direction

### Product and architecture constraints

This plan must stay aligned with the current project architecture:

- Astro-native first
- static-first rendering by default
- no framework migration implied by UI revamp
- no change to content model, routing model, or deployment model
- no speculative service/adapter/contract layers

### UI direction

The target is not “Tailwind instead of Daisy” as an end in itself.

The target is:

- site-owned tokens,
- site-owned Astro components,
- lighter, more deliberate navigation and controls,
- theme quality driven by readability first,
- a more editorial and atmospheric visual identity that still feels practical for reference use.

### Replacement philosophy

Replace Daisy by owning the primitives, not by swapping to another opinionated component library.

Target primitives:

- `Button`
- `Card`
- `Badge`
- `Field`
- `Select`
- `SectionNav`
- `TopNav`
- `Pagination`
- `Panel`
- `EmptyState`

---

## 3) Current State Summary

### DaisyUI is active and meaningful

- DaisyUI is installed and enabled in the active stylesheet.
- Usage is broad across navigation, cards, badges, buttons, filters, forms, and some modal flows.
- The heaviest Daisy usage is on high-visibility pages such as homepage, discovery, login, calendar, timeline, GURPS resource pages, and navigation components.

### The deepest coupling is not just class names

The strongest current coupling is a combination of:

1. Daisy component classes in markup (`btn`, `card`, `badge`, `tabs`, `menu`, `input`, `select`)
2. Daisy semantic theme tokens (`bg-base-100`, `border-base-300`, `btn-primary`, etc.)
3. Daisy theme plugin blocks in `src/styles/global.css`
4. project-specific overrides that are already compensating for Daisy defaults

### Current UI debt that should be cleaned before visual expansion

1. **Theme quality debt**
   - dark themes need contrast and surface hierarchy redesign, not just patching

2. **Navigation pattern debt**
   - tab-based sub-navigation feels too heavy for the information architecture

3. **Primitive inconsistency debt**
   - button/card/badge shapes are pulled between Daisy defaults and custom overrides

4. **Stylesheet drift**
   - utility classes such as `reading-prose`, `meta-muted`, and `tag-chip` exist outside the active imported stylesheet path and should be normalized first

---

## 4) Decision Framing

### Recommended strategic decision

Adopt a phased Daisy extraction strategy rather than a one-shot rewrite.

### What this is not

- not a full visual redesign before any cleanup
- not a big-bang CSS rewrite
- not a switch to another component framework/library
- not an ADR-worthy architecture change at this stage

### What this is

- a front-end system migration,
- a design-token reset,
- a component ownership transition,
- a phased visual revamp delivered through visible checkpoints.

---

## 5) Key Question: When Does the New Look Actually Start?

The new look should begin early, not after Daisy is fully removed.

### Proposed answer

The first visible style work starts in **Phase 1B and Phase 2**, not at the very end.

- **Phase 1A** establishes token and CSS hygiene so later work is stable.
- **Phase 1B** starts visible design direction with theme reconstruction and navigation prototypes.
- **Phase 2** introduces the first fully owned visible primitives: buttons, cards, badges, and sub-navigation.

This means the project does not need to wait until Daisy is gone before the site starts looking different.

---

## 6) Recommended Execution Plan

## Phase 0 — Visual Direction Brief

### Goal

Lock a design direction before rebuilding primitives.

### Why first

Without a style brief, Daisy extraction turns into technical churn without a clear visual target.

### Outputs

1. short design brief covering:
   - desired tone
   - what should feel lighter/heavier
   - preferred nav feel
   - preferred card feel
   - preferred button feel
   - dark-theme mood and readability rules
2. reference set of 3-6 visual examples
3. “avoid” list of styles you do not want

### Notes

If you want to provide example sites or screenshots, this phase is where they matter most.
They are not required for the migration structure, but they would materially improve the look/style direction.

### Approval gate

- one-paragraph visual direction approved
- examples gathered if available

---

## Phase 1 — Foundations Before Replacement

## Phase 1A — CSS and Token Hygiene

### Goal

Create one reliable styling foundation before swapping components.

### Tasks

1. normalize stylesheet ownership
   - remove split-brain between active `src/styles/global.css` and root-level legacy utility definitions
2. inventory and classify tokens into:
   - surface
   - text
   - border
   - accent
   - status
   - focus
3. define new project-owned semantic tokens that do not depend on Daisy naming
4. keep temporary compatibility aliases where needed during migration

### Deliverables

- canonical style entrypoint
- token map
- migration note for old Daisy semantic usage

### Acceptance criteria

- one active source of truth for shared UI utilities and tokens
- no ambiguity about where global component styling lives

---

## Phase 1B — Theme Reconstruction

### Goal

Rebuild theme logic around readability and surface hierarchy instead of Daisy theme defaults.

### Tasks

1. reduce theme count pressure if needed during redesign exploration
   - temporary two-theme working lane is acceptable during design iteration
2. define explicit contrast rules for:
   - body text
   - metadata
   - links
   - hover/focus states
   - cards on page background
   - nav on page background
3. redesign dark themes from first principles
   - do not treat dark themes as inverted light themes
4. define surface ladder for each theme
   - page background
   - section surface
   - card surface
   - active/interactive surface

### Deliverables

- new theme token spec
- contrast checklist
- light and dark theme reference screenshots/mockups

### Acceptance criteria

- dark themes are legible without component-by-component emergency overrides
- card/nav/form surfaces have clear depth and contrast

---

## Phase 2 — Replace the Most Painful Visible Primitives First

## Phase 2A — Navigation Redesign

### Goal

Remove clunky tab-style navigation and establish lighter wayfinding patterns.

### Priority reason

Navigation is one of the most visible current friction points and will immediately change the feel of the site.

### Tasks

1. replace Daisy `tabs`-style section navs with a lighter owned pattern
   - likely options: understated pill row, inline segmented link row, or editorial section rail
2. redesign top nav as a site-owned component
3. review mobile nav separately rather than inheriting desktop pattern blindly
4. keep four-layer IA clear: Canon, Using Aletheia, Reference, Campaigns

### Target files first

- `src/components/GlobalNavigation.astro`
- `src/components/WorldAletheiaNav.astro`
- `src/components/UsingAletheiaNav.astro`
- `src/components/ReferenceNav.astro`
- `src/components/CampaignsNav.astro`

### Acceptance criteria

- no Daisy `tabs` pattern remains in primary or section navigation
- nav feels lighter and more intentional on desktop and mobile

---

## Phase 2B — Button, Card, Badge Primitive Ownership

### Goal

Take ownership of the three primitives currently shaping most of the site’s tactile feel.

### Tasks

1. create owned button variants
   - primary
   - secondary/quiet
   - subtle outline or ghost
   - destructive/warning only if needed
2. create owned card variants
   - content card
   - panel card
   - discovery card
   - compact metadata card
3. create owned badge/chip variants
   - tag chip
   - metadata chip
   - status/visibility chip
   - relationship hint chip
4. convert homepage and discovery surfaces first so the new language becomes visible quickly

### Target files first

- `src/components/ContentCard.astro`
- `src/components/RelatedContent.astro`
- `src/pages/index.astro`
- `src/components/DiscoveryCollectionView.astro`
- `src/components/PaginationNav.astro`

### Acceptance criteria

- homepage no longer reads as Daisy-shaped
- content cards, badges, and pagination feel visually related and lighter

---

## Phase 3 — Form and Data-Dense Surface Replacement

### Goal

Replace Daisy form controls and dense utility layouts once the new primitives are stable.

### Why after Phase 2

Forms should inherit the new visual language rather than define it.

### Tasks

1. build owned `Field`, `Input`, `Select`, and grouped control patterns
2. migrate login/account flows
3. migrate discovery filters
4. migrate calendar/timeline controls carefully
5. replace modal styling in GURPS resource pages only after new dialog/panel treatment is defined

### Target files first

- `src/pages/login.astro`
- `src/components/DiscoveryCollectionView.astro`
- `src/pages/references/calendar/index.astro`
- `src/pages/references/timeline/index.astro`
- `src/pages/systems/gurps/resources/sorcerer-spells/*.astro`

### Acceptance criteria

- forms read clearly in all supported themes
- dense reference tools feel integrated with the new UI language rather than default admin-style controls

---

## Phase 4 — Reading and Editorial Polish

### Goal

Bring article pages and long-form reading surfaces into the same owned system.

### Tasks

1. finalize typography system for body, headings, UI text
2. tune article rhythm, spacing, and measure
3. unify relationship panels, content headers, and metadata presentation
4. remove remaining hardcoded visual leftovers that clash with token system

### Target files first

- `src/layouts/WorldAletheiaContentLayout.astro`
- `src/layouts/UsingAletheiaContentLayout.astro`
- `src/components/WorldAletheiaContentHeader.astro`
- `src/components/UsingAletheiaContentHeader.astro`
- `src/components/CampaignsContentHeader.astro`

### Acceptance criteria

- reading surfaces feel intentional, not merely functional
- article headers, relationship UI, and tags share one visual system

---

## Phase 5 — DaisyUI Decommissioning

### Goal

Remove DaisyUI only after the site no longer materially depends on it.

### Tasks

1. audit for remaining Daisy class usage
2. remove temporary compatibility aliases
3. remove Daisy plugin/theme configuration
4. remove Daisy dependency from `package.json`
5. run full visual regression and theme pass

### Acceptance criteria

- Daisy classes no longer shape production UI
- Daisy dependency can be removed without fallback regressions

---

## 7) Order of Visible Wins

If the goal is to feel progress early, the recommended visible rollout order is:

1. navigation redesign
2. homepage cards/buttons/badges
3. discovery/listing surfaces
4. login and filter controls
5. calendar/timeline dense controls
6. reading/layout polish

This order gives the site a visibly new identity before full Daisy removal is complete.

---

## 8) Suggested Component Migration Matrix

### Replace first

- nav tabs
- buttons
- content cards
- badges/chips
- pagination

### Replace second

- fields
- selects
- panel wrappers
- empty states

### Replace third

- modal styling
- any remaining Daisy utility wrappers

### Keep stable while migration is active

- Astro image pipeline (`HeroImage` / `RandomHeroImage`)
- routing/layout boundaries
- content APIs and collection logic

---

## 9) Risks and Controls

### Risk 1 — Endless redesign drift

**Control**
- require a small Phase 0 visual brief and a shortlist of approved references

### Risk 2 — Mixed system persists longer than intended

**Control**
- migrate by primitive family, not by random page edits

### Risk 3 — Theme regression during migration

**Control**
- rebuild theme tokens before broad component migration
- validate each phase in at least one light and one dark theme

### Risk 4 — Over-engineering component abstractions

**Control**
- keep Astro components thin and presentation-focused
- do not invent a large variant API unless repetition is proven

### Risk 5 — High-effort pages stall progress

**Control**
- leave calendar and modal-heavy pages until primitives are stable

---

## 10) Validation Protocol Per Phase

For each phase:

1. `pnpm build` passes
2. route checks cover:
   - `/`
   - representative Canon page
   - representative Using page
   - `/references/calendar`
   - `/references/timeline`
   - `/campaigns`
   - `/login`
3. theme checks cover at minimum:
   - one light theme
   - one dark theme
4. keyboard focus-visible remains obvious on primary controls
5. mobile and desktop both verified

---

## 11) Approval Questions for This Draft

This draft needs approval on these points before implementation planning should narrow further:

1. Is phased Daisy extraction the preferred strategy over a one-shot redesign?
2. Do you want the first visible implementation work to start with navigation, as recommended here?
3. Do you want to keep four themes as a fixed requirement during revamp, or allow temporary reduction while the new token system is stabilized?
4. Do you want a visual-reference phase with example sites/screenshots before implementation planning moves into component specs?

---

## 12) Recommended Next Document After Approval

Once this plan is approved, the next planning artifact should be a **UI Direction Brief** with:

- visual references,
- approved adjectives for tone,
- nav pattern choice,
- button/card/badge style targets,
- light/dark theme intent,
- typography shortlist.

That should be followed by a small **component spec pack** for nav, button, card, badge, and field primitives before code changes begin.

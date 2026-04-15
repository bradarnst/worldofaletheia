# UI Implementation Handoff Plan

## Status

- Date: 2026-04-14
- Updated: 2026-04-15
- Status: Approved handoff baseline with wireframe capture
- Purpose: consolidate the revamp plan, direction specs, decision register, and page-surface rules into an implementation-facing plan
- Primary audience: implementation agent / future coding pass
- Scope: homepage, navigation, collection pages, article pages, footer, tokens, icon system, and phased Daisy extraction
- Wireframe status: approved wireframes are frozen; `plans/ui-component-and-shell-spec-2026-04-15.md` is the layout source of truth for shell structure

## Source Documents

This plan synthesizes and depends on:

- `plans/ui-revamp-and-daisy-extraction-plan-2026-04-11.md`
- `plans/ui-direction-spec-baseline-2026-04-13.md`
- `plans/ui-direction-spec-refinement-2026-04-13.md`
- `plans/ui-direction-spec-homepage-revision-2026-04-14.md`
- `plans/ui-direction-decision-register-2026-04-14.md`
- `plans/ui-collection-and-article-surface-spec-2026-04-14.md`
- `plans/ui-component-and-shell-spec-2026-04-15.md`
- `src/lib/content-types.ts`

---

## 1) Executive Readiness Assessment

The project now has enough direction to begin implementation.

More specifically:

- **Ready now**: token cleanup, theme reconstruction, global header/nav, homepage hero shell, homepage support sections, collection landing shell, standard collection cards, article header/context block, compact footer, and search/filter bar structure.
- **Ready with placeholders**: icon/glyph placements, exact collection background assignments, some article context visual nuance, and later chip styling.
- **Not ready to finalize**: full custom SVG set for every enumerated type, final blur/tint numeric values, campaign-specific sidebar shell, map-based hero, and final homepage featured-content policy.

Practical conclusion:

- the plan is good enough to hand off for implementation of **Phases 1 through early 4**,
- provided the implementer treats unresolved visual values as controlled prototype decisions rather than permanent final styling.

Wireframe approval update:

- homepage, navigation, collection landing, article shell, compact filter bar, and footer wireframes were approved on 2026-04-15
- the approved component-level details are captured in `plans/ui-component-and-shell-spec-2026-04-15.md`
- prototype routes were removed after approval so the next step can proceed directly on production components/routes

---

## 2) Non-Negotiable Design Constraints

These are settled and should not be reopened during implementation unless a later planning document supersedes them:

- Astro-native architecture remains unchanged.
- Tailwind remains the styling base.
- DaisyUI is being extracted incrementally.
- `Lora` and `Inter` remain the font families.
- Homepage uses a full-page or near-full-page hero.
- Homepage does not show random/latest articles in first pass.
- Global navigation is dropdown-based and atmospheric.
- Dropdown items behave like compact informational cards.
- Collection pages use image-first atmospheric backgrounds at the page level.
- Standard collection cards are opaque, scan-friendly, and image-free by default.
- No bento layout for normal collection listings.
- Standard article pages do not use top hero images.
- Article pages lead with breadcrumbs, title, summary, and world-context metadata.
- Footer is compact, restrained, and multi-column.
- Icon system target is custom SVG, not a third-party icon look.
- Authored summary is preferred; build/ingest fallback only when blank.

---

## 3) Implementation Strategy

Implementation should proceed in thin vertical slices, but the slices must respect dependency order.

Recommended strategy:

1. stabilize tokens and theme foundations first
2. replace header/nav and homepage shell next
3. establish collection shell and standard cards after nav
4. establish article header/context and prose surfaces after cards
5. replace dense controls/reference utilities later
6. remove Daisy only after new primitives are proven in production routes

Do not migrate page-by-page randomly.

Migrate by:

- tokens
- primitives
- page shells
- dense utilities
- cleanup/decommissioning

---

## 4) Phase Plan With Dependencies

## Phase 1 — Foundations and Token Reset

### Goal

Make the styling system safe for implementation by removing ambiguity around theme, token, and global CSS ownership.

### Implementation tasks

1. normalize global stylesheet ownership
2. inventory Daisy semantic usage and map it to project-owned tokens
3. define project token groups for:
   - page background
   - surface background
   - card background
   - border
   - primary text
   - secondary text
   - accent
   - focus
4. reconstruct light and dark theme ladders
5. introduce compatibility aliases only where necessary during migration

### Dependencies

- user approval of overall direction: done
- exact blur/tint/overlay values: not required to begin; can be prototyped

### User-owned dependencies

- none blocking for Phase 1

### Output

- stable token layer
- theme-ready global CSS foundation
- reduced Daisy theme coupling

### Ready to implement

- yes

---

## Phase 2 — Header, Navigation, and Homepage Shell

### Goal

Ship the most visible new identity: atmospheric header, rich dropdown nav, and full-height homepage hero structure.

### Implementation tasks

1. build new global header shell
2. build dropdown flyout structure
3. build compact card-like dropdown item component
4. implement full-page or near-full-page homepage hero shell
5. add homepage support sections below hero:
   - Canon
   - Using Aletheia
   - Campaigns
   - Reference
   - Contribute
   - About
6. add right-side header utility cluster with `Search`, icon-only theme switch, `Login`, and `Contribute`
7. keep `GitHub` in the footer only
8. remove tab-based section-nav styling where header/nav overlaps old patterns

### Dependencies

- Phase 1 token/theme layer complete
- top-level icon slots available in markup
- homepage copy can be placeholder as long as structure is correct

### User-owned dependencies

Needed soon, but placeholders are acceptable for first code pass:

1. custom SVGs for top-level domains and primary nav groups:
   - Canon
   - Using
   - Campaigns
   - Reference
2. branding direction if a logo/wordmark refinement is desired

### Placeholder policy

- implementation may use neutral temporary SVG placeholders or simple internal placeholders for spacing/alignment
- final visual approval depends on swapping to your custom SVG family later

### Approval checkpoint

- prototype wireframe approval: complete on 2026-04-15

### Output

- new global nav
- homepage shell
- header-over-hero behavior
- dropdown interaction pattern

### Ready to implement

- yes, with icon placeholders acceptable

---

## Phase 3 — Collection Landing Pages and Standard Discovery Cards

### Goal

Establish the scan-first collection experience with atmospheric page backgrounds and clean opaque cards.

### Implementation tasks

1. create collection intro shell
2. implement page-level collection background system
3. implement compact search + type + tag bar directly below the hero and visually tied to the listing section
4. implement standard collection card variant
5. migrate collection landing pages to the new shell
6. support optional per-collection icon/accent personality without changing layout structure
7. add pagination styling alignment

### Collection page rules to enforce

- image-first page background
- heavily blurred/tinted/softened background
- opaque cards
- no default thumbnails
- no bento layout
- gutters reveal atmosphere between cards

### Dependencies

- Phase 1 tokens complete
- Phase 2 header/nav complete or at least stable enough to reuse
- collection background images selected or temporarily assigned

### User-owned dependencies

Needed during Phase 3:

1. background image assignment strategy for each collection:
   - one fixed image or rotating pool
2. initial collection/domain SVGs if not already delivered:
   - Lore
   - Sentients
   - Places
   - Factions
   - Bestiary
   - Flora
   - Systems
   - Meta
   - Calendar
   - Timeline
   - Maps
   - Sessions
   - Characters
   - Scenes
   - Adventures
   - Hooks
3. approval of compact filter bar behavior after first prototype: complete on 2026-04-15

### Output

- standard collection shell
- standard collection card
- compact search/filter bar
- collection personality system

### Approval checkpoint

- collection landing and compact filter bar wireframes approved on 2026-04-15

### Ready to implement

- yes, but collection background assignment and icons will improve fidelity materially

---

## Phase 4 — Article Pages and Reading Surfaces

### Goal

Establish the long-form reading experience with subtle world-context metadata and strong prose hierarchy.

### Implementation tasks

1. build article header/context block with approved order:
   - breadcrumbs
   - title
   - summary
   - taxonomy
   - relationships/cross-links
   - tags last
2. implement prose/readability surface
3. implement subtle page-margin texture/motif for article surfaces
4. style relationship/context area as structured metadata, not dashboard badges
5. restyle related-content surfaces to match the new card language
6. integrate summary fallback behavior where needed

### Dependencies

- Phase 1 tokens and prose rules stable
- summary fallback rule available in content/build layer
- chip taxonomy can remain partially provisional as long as hierarchy is subtle

### User-owned dependencies

Needed during Phase 4:

1. approval of exact article context-block grouping after first prototype: complete on 2026-04-15
2. custom SVGs for common article/context meanings if desired
3. decision on whether certain collections get distinct subtle margin textures

### Output

- article page shell
- article world-context block
- consistent prose layout
- relationship-aware metadata treatment

### Approval checkpoint

- article shell and world-context block wireframes approved on 2026-04-15

### Ready to implement

- yes, with some context-block styling details still subject to prototype review

---

## Phase 5 — Dense Controls and Reference Utility Surfaces

### Goal

Migrate utility-heavy pages after the main language is stable.

### Implementation tasks

1. build owned input/select/filter primitives
2. restyle login and account-related flows
3. apply compact filter bar logic to discovery/reference where appropriate
4. prototype Reference sidebar, starting with Calendar
5. migrate calendar/timeline controls
6. defer campaign sidebar unless content pressure clearly requires it

### Dependencies

- Phases 1-4 stable enough that the utility controls can inherit the visual system
- decision to pilot sidebar in Reference remains approved

### User-owned dependencies

Needed during Phase 5:

1. approval of Reference sidebar wireframe after first prototype
2. any utility-specific icons if desired

### Output

- owned form controls
- Reference utility shell
- sidebar pilot

### Ready to implement

- mostly yes, but should come after earlier phases

---

## Phase 6 — Icon Expansion and Special Layouts

### Goal

Expand the flavor system and specialized content layouts after the core shells are stable.

### Implementation tasks

1. integrate the custom SVG family broadly
2. map icons to collections, domains, and type enums
3. build any special content cards/layouts for:
   - character sheets
   - GM content
   - player handouts
4. refine chips once real usage patterns are visible

### Dependencies

- custom SVG system delivered
- type inventory stabilized enough for mapping

### User-owned dependencies

Primary dependency for this phase:

- custom SVG delivery for the larger icon backlog

### Output

- consistent glyph family across the site
- enriched discovery metadata
- special/manual content layouts

### Ready to implement

- partially; icon backlog is a real dependency

---

## Phase 7 — DaisyUI Decommissioning and Cleanup

### Goal

Remove Daisy from the runtime styling path once the owned system is in place.

### Implementation tasks

1. audit remaining Daisy classes and theme references
2. remove compatibility aliases
3. remove Daisy plugin/theme config
4. remove Daisy dependency from `package.json`
5. perform final regression pass

### Dependencies

- all major user-facing routes migrated to owned primitives
- no essential component still depends on Daisy contract classes

### User-owned dependencies

- none blocking

### Output

- Daisy removed or functionally unused
- owned UI system in control

### Ready to implement

- later only

---

## 5) Dependency Register

## 5.1 User-owned dependencies

These are the main things you own or approve directly:

### Required soon

1. **Custom SVG top-level/domain set**
   - Needed for header/nav and collection shells
   - Placeholders are acceptable initially

2. **Collection background image assignment**
   - Needed for collection landing fidelity
   - One fixed image or rotating pool per collection

3. **Prototype approvals**
   - header/nav
   - homepage shell
   - collection shell
   - article context block
   - Reference sidebar pilot later

### Required later

4. **Expanded SVG icon map for content types**
   - derived from `src/lib/content-types.ts`
   - needed for deeper flavor and semantic consistency

5. **Optional brand/logo refinement**
   - only if you want header branding beyond text treatment

## 5.2 Implementation-owned dependencies

These can be handled in code without waiting on more design unless prototypes fail:

- token mapping and theme cleanup
- dropdown mechanics
- filter bar structure
- summary fallback implementation
- footer shell
- prose shell
- relationship metadata hierarchy

---

## 6) Icon Backlog Derived From `src/lib/content-types.ts`

This is the current known icon inventory that can be planned against.

## 6.1 Top-level/domain icons

- Canon
- Using
- Campaigns
- Reference
- Contribute
- About

## 6.2 Collection icons

- Lore
- Places
- Sentients
- Bestiary
- Flora
- Factions
- Systems
- Meta
- Sessions
- Characters
- Scenes
- Adventures
- Hooks
- Calendar
- Timeline
- Maps
- GURPS

## 6.3 Lore type icons

- cosmology
- religion
- economy
- history
- geography
- food_and_drink
- culture
- language
- warfare
- domestication
- magic
- technology
- structure
- other
- event

## 6.4 Places type icons

- location
- landmark
- dungeon
- settlement
- region
- polity
- adminDivision
- water
- biome

## 6.5 Sentients type icons

- race
- species
- culture
- organization
- deity

## 6.6 Bestiary type icons

- monster
- animal
- beast
- spirit
- construct
- elemental

## 6.7 Flora type icons

- tree
- flower
- fungus
- herb
- fruit
- plant
- crop

## 6.8 Factions type icons

- political
- guild
- criminal
- government
- religion
- military
- police
- school
- order

## 6.9 Systems / Meta / Session icons

- general
- gurps
- info
- technical
- content
- reference
- governance
- session
- encounter
- battle
- note

## 6.10 Campaign-specific type icons

### Campaign characters
- pc
- npc
- ally
- adversary
- patron
- creature
- group
- other

### Campaign scenes
- scene
- combat
- social
- travel
- downtime
- investigation
- flashback
- other

### Campaign adventures
- arc
- mission
- quest
- contract
- dungeon
- journey
- heist
- other

### Campaign hooks
- rumor
- lead
- job
- threat
- mystery
- opportunity
- other

Implementation note:

- top-level/domain and collection icons are needed first
- type-level icons can roll out progressively
- shared terms like `religion`, `culture`, `dungeon`, and `other` should reuse one glyph system-wide unless a later reason emerges not to

---

## 7) Approval Gates

## Gate A — Foundations

Approve after:

- token system compiles cleanly
- new light/dark theme ladder works
- no obvious contrast regressions

## Gate B — Header and Homepage

Approve after:

- header-over-hero behavior feels correct
- dropdown item density feels right
- homepage hero and below-the-fold sections feel intentional

## Gate C — Collection Pages

Approve after:

- collection background treatment reads atmospheric without harming readability
- compact filter bar feels usable
- standard cards scan cleanly

## Gate D — Article Pages

Approve after:

- article context block feels subtle but useful
- prose is comfortable
- tags/relationships do not feel dashboard-like

## Gate E — Reference Utility Surfaces

Approve after:

- filter controls and sidebar pilot feel integrated
- calendar/timeline are clearer than before

## Gate F — Daisy Removal

Approve after:

- no meaningful UI depends on Daisy
- final regression pass is clean

---

## 8) File/Area Handoff Targets

Implementation will likely touch these areas first:

### Global shell
- `src/styles/global.css`
- `src/layouts/BaseLayout.astro`
- `src/components/GlobalNavigation.astro`
- relevant domain nav components

### Homepage
- `src/pages/index.astro`
- homepage support components

### Collections and discovery
- collection `index.astro` pages
- `src/components/ContentCard.astro`
- `src/components/DiscoveryCollectionView.astro`
- `src/components/PaginationNav.astro`

### Article surfaces
- content layouts and content headers
- related-content components
- metadata/relationship display components

### Reference utilities
- `src/pages/references/calendar/index.astro`
- `src/pages/references/timeline/index.astro`
- Reference nav/sidebar-related components

### Supporting utilities
- summary fallback pipeline
- icon asset organization
- optional image derivative pipeline for collection backgrounds

---

## 9) What Is Still Missing Before Fully Final Handoff

This plan is implementation-ready for early phases. After wireframe approval, the remaining open items are narrower:

1. exact numeric blur/tint/overlay values for collection backgrounds
2. exact hero height values by breakpoint
3. final collection background image assignments
4. completed custom SVG backlog for all type enums

These are not blockers for beginning implementation, but they are real approval checkpoints.

---

## 10) Next Artifact Status

The lower-level component/shell artifact has now been completed:

- `plans/ui-component-and-shell-spec-2026-04-15.md`

That document captures the approved wireframe decisions for:

1. header shell
2. dropdown panel behavior/shape
3. homepage hero shell
4. collection landing shell
5. article header/context shell
6. compact filter bar
7. footer shell
8. prototype lifecycle and removal note

# UI UX Direction Brief and Reference Repo Critique (Draft)

## Status

- Date: 2026-04-13
- Status: Draft
- Input source: `https://github.com/bradarnst/Woauidesign`
- Scope: design critique and UI direction only
- Constraint: no direct reuse of mock-data page implementations; React/Radix components treated as reference, not source-of-truth implementation

---

## 1) Purpose

This document evaluates the external reference repo as a design input for the World of Aletheia revamp.

It answers four practical questions:

1. what is worth borrowing directly,
2. what should be adapted rather than copied,
3. what should not be carried into the Astro site,
4. how the reference should inform the phased Daisy extraction plan.

---

## 2) High-Level Verdict

The reference repo is useful and should be used.

Not as a component library to transplant, but as a design language source.

Its strongest value is in:

- token structure,
- color palette direction,
- dark-theme readability thinking,
- a cleaner global header direction,
- a more coherent page skeleton,
- a better separation between theme system and component system than the current Daisy-heavy site.

Its weakest value is in:

- over-specific React/Radix component machinery,
- some app-like interaction patterns that are heavier than this Astro site needs,
- a few visual choices that feel generic product UI rather than authored editorial fantasy UI,
- some hardcoded category colors that drift away from the Aletheia palette,
- heading typography that risks feeling too ornamental if applied everywhere.

---

## 3) What Is Strong and Worth Carrying Forward

## 3.1 Token-first theme structure

The strongest transferable asset is the token system in:

- `/tmp/Woauidesign-ref/src/styles/theme.css`
- `/tmp/Woauidesign-ref/COLOR_PALETTE_REFERENCE.md`
- `/tmp/Woauidesign-ref/CONTRAST_IMPROVEMENTS.md`

Why it is strong:

- it uses CSS variables cleanly,
- it maps well to Tailwind semantic utilities,
- it separates surface, text, accent, border, and sidebar concerns,
- it treats dark mode as a designed palette rather than a simple inversion,
- it explicitly documents contrast improvements.

This is exactly the kind of system the current site needs.

## 3.2 Dark-theme readability discipline

The reference repo is materially better than the current site in one important way: it documents the dark theme as a readability problem, not just a mood problem.

Strong inputs:

- `/tmp/Woauidesign-ref/CONTRAST_IMPROVEMENTS.md`
- `/tmp/Woauidesign-ref/COLOR_PALETTE_REFERENCE.md`

Most valuable lesson:

- text hierarchy must be defined by contrast targets first,
- accent colors should be reserved for emphasis,
- exotic hues are useful only if body and secondary text remain calm and legible.

This should directly influence Phase 1B of the revamp plan.

## 3.3 Global navigation direction

The global header direction is better than the current tab-heavy navigation.

Reference:

- `/tmp/Woauidesign-ref/src/app/components/Header.tsx`

What is good:

- top bar is cleaner than the current Daisy nav,
- grouping into Canon / Using Aletheia / Campaigns makes sense,
- dropdown-style navigation is more appropriate than tab rails for top-level grouping,
- mobile sheet navigation is directionally better than the current menu.

This is the clearest direct improvement over the current site.

## 3.4 Overall page skeleton

The general layout structure is solid:

- header,
- hero,
- content sections,
- footer.

Reference:

- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx`
- `/tmp/Woauidesign-ref/src/app/components/Footer.tsx`
- `/tmp/Woauidesign-ref/EXAMPLE_PAGES.md`

This is a better baseline than the current UI because the sections feel intentionally composed instead of accumulated from Daisy primitives.

---

## 4) What Should Be Adapted, Not Copied

## 4.1 React/Radix primitives

References:

- `/tmp/Woauidesign-ref/src/app/components/ui/button.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/card.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/badge.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/navigation-menu.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/sidebar.tsx`

These are useful as anatomy references only.

They should not be ported directly because:

- the current site does not need Radix-level component machinery for most surfaces,
- Astro-native static rendering should remain the default,
- most of the value is in spacing, states, and token usage, not in the React wrapper logic,
- importing shadcn/Radix patterns wholesale would recreate the same dependency-shaping problem Daisy caused.

Recommended adaptation rule:

- copy the class intent,
- not the component implementation model.

## 4.2 Example pages

References:

- `/tmp/Woauidesign-ref/EXAMPLE_PAGES.md`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx`
- `/tmp/Woauidesign-ref/src/app/pages/CollectionPage.tsx`
- `/tmp/Woauidesign-ref/src/app/pages/EntryPage.tsx`

These are useful for:

- visual rhythm,
- section ordering,
- card density,
- hero composition,
- filter bar structure,
- sidebar thinking.

They should not be copied directly because:

- they are built around mock data and generic content assumptions,
- current Astro routing and content APIs are different,
- the homepage ADR in this repo is story-first, not simply category-first,
- the current product has relationship metadata and domain boundaries that the mock pages do not fully represent.

---

## 5) What Should Not Be Carried Over As-Is

## 5.1 Hardcoded non-system category colors

In the landing page, category icon blocks use generic Tailwind colors like amber, blue, green, purple, red, indigo.

Reference:

- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:15`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:23`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:31`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:39`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:47`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:55`

This should not carry over.

Why:

- it weakens palette discipline,
- it makes the page feel more like a SaaS dashboard than a cohesive setting site,
- it fights the richer Aletheia-specific token system documented elsewhere in the repo.

## 5.2 Uniform use of Cinzel for headings

Reference:

- `/tmp/Woauidesign-ref/README.md:77`
- `/tmp/Woauidesign-ref/DESIGN_SYSTEM.md:90`

Cinzel is atmospheric, but I would not recommend it as the default heading face across the whole site.

Why:

- it can tip into theatrical fantasy too quickly,
- it works better for select hero or high-level display moments than for every heading level,
- the current product needs long-form readability and calm authority more than ornament.

Recommendation:

- keep it only if testing proves it works at limited display moments,
- otherwise use a more restrained serif for headings and reserve decorative tone for sparse moments.

## 5.3 Hover scale on cards

Reference:

- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:130`
- `/tmp/Woauidesign-ref/src/app/pages/LandingPage.tsx:168`
- `/tmp/Woauidesign-ref/src/app/pages/CollectionPage.tsx:121`
- `/tmp/Woauidesign-ref/src/app/pages/EntryPage.tsx:174`

The scale-on-hover pattern feels app-like and slightly promotional.

For World of Aletheia, a better hover language is:

- border emphasis,
- subtle shadow shift,
- title color shift,
- maybe a slight translate or surface lift,
- but not repeated zoom behavior on every card.

## 5.4 Over-ornamented dark-theme accents

Reference:

- `/tmp/Woauidesign-ref/DARK_JUNGLE_THEME.md`

The dark jungle palette is strong, but some of the wildlife/accent colors are too numerous for default UI use.

They are best treated as:

- highlight palette,
- category accents,
- rare-state accents,
- special illustration overlays,
- not default everyday interface colors.

---

## 6) Specific Critique by Surface

## 6.1 Header / global menu

Overall: good direction, should influence the new design.

What to keep conceptually:

- grouped dropdown global navigation,
- compact top bar,
- mobile sheet/dropdown approach,
- search slot reserved in header architecture even if search is not yet fully exposed.

What to improve:

- reduce dependence on Radix nav primitives,
- make branding more distinctive than generic icon + wordmark,
- give the dropdowns a stronger editorial rhythm and less generic product-menu feel,
- ensure the active-state language matches site IA rather than app-navigation conventions.

Recommended implementation approach for this repo:

- build a small Astro-owned dropdown/global-nav pattern with minimal JS,
- keep the structural idea, not the React component stack.

## 6.2 Hero

Overall: stronger than current site, but still somewhat generic.

What works:

- clear hero/content separation,
- strong CTA zone,
- controlled overlay,
- readable central title block.

What needs improvement:

- hero imagery should use your actual curated image governance, not broad stock-photo energy,
- overlay should be theme-aware rather than globally heavy,
- title treatment should feel more authored and less template-like,
- badge-above-headline can work, but only if used sparingly.

Recommendation:

- borrow the structure, not the exact visual treatment.

## 6.3 Cards

Overall: much better foundation than current Daisy cards, but still need adaptation.

What works:

- cleaner anatomy,
- clearer content hierarchy,
- better separation of title, badge, excerpt, and action cue.

What to change:

- reduce border thickness and visual weight,
- avoid universal hover scaling,
- make metadata feel quieter,
- use category accents carefully and through tokens,
- let relationship hints matter more than generic badges where relevant.

## 6.4 Badges and chips

Overall: direction is good, but current reference badges are still a little generic.

What works:

- token-driven variants,
- modest sizing,
- consistent pill logic.

What to improve:

- distinguish tag chips from status badges from taxonomy pills,
- avoid using the same badge anatomy for every meaning,
- keep relationship chips more understated than tags.

## 6.5 Footer

Overall: cleaner than current footer, but still generic.

What works:

- simple grid,
- restrained tone,
- good secondary navigation structure.

What to improve:

- make footer reflect the four-layer model more intentionally,
- remove or defer dead-end contribution links unless implemented,
- consider footer as IA reinforcement rather than just generic site boilerplate.

---

## 7) Sidebar Guidance

Your instinct is mostly right.

A sidebar should not become a default pattern across the site.

### Where a sidebar makes sense

1. Campaigns domain
   - campaign overviews
   - session navigation
   - adventure/scene navigation
   - campaign-specific metadata and quick links

2. Reference tools
   - filters
   - timeline/calendar controls
   - map layers or utility panels

3. Dense utility pages
   - only where the user benefits from persistent controls or structured context

### Where a sidebar does not make sense by default

1. Canon article pages
2. Using Aletheia long-form guides
3. story-first homepage
4. most collection index pages unless filters become materially denser

### Reason

A default sidebar works against the editorial reading mode that the static canon content needs.

In this project, sidebars should be treated as task-oriented utility scaffolding, not a universal layout pattern.

So yes: Campaigns is the strongest future fit, and perhaps some reference surfaces. I would not recommend broad sidebar rollout elsewhere right now.

---

## 8) What To Reuse Directly Versus Indirectly

## Reuse directly

- palette logic and token categories from `COLOR_PALETTE_REFERENCE.md`
- dark-theme readability strategy from `CONTRAST_IMPROVEMENTS.md`
- theme variable structure from `src/styles/theme.css`
- general layout proportions from `LandingPage.tsx`
- dropdown global menu concept from `Header.tsx`

## Reuse indirectly

- button/card/badge anatomy from the UI primitives
- collection and entry page structure from `EXAMPLE_PAGES.md`
- sidebar concept only for Campaigns/reference utility contexts
- Astro conversion guidance as conceptual pattern, not literal implementation source

## Do not reuse directly

- React/Radix implementation code
- mock-data page logic
- generic shadcn-style interaction complexity on static surfaces
- hardcoded category accent colors outside the token system
- hover-scale card behavior as a global default

---

## 9) How This Ties Into the Existing Revamp Phases

## Phase 0 — Visual Direction Brief

This repo should become one of the primary references for the phase.

Use it to define:

- preferred global menu direction,
- desired page skeleton,
- acceptable border weight,
- dark-theme contrast rules,
- which aspects of the tropical palette are core versus accent-only.

## Phase 1A — CSS and token hygiene

Directly informed by:

- `/tmp/Woauidesign-ref/src/styles/theme.css`
- `/tmp/Woauidesign-ref/COLOR_PALETTE_REFERENCE.md`

This is where we translate the palette structure into the Astro repo's owned tokens.

## Phase 1B — Theme reconstruction

Directly informed by:

- `/tmp/Woauidesign-ref/CONTRAST_IMPROVEMENTS.md`
- `/tmp/Woauidesign-ref/DARK_JUNGLE_THEME.md`

This is the strongest immediate payoff area.

## Phase 2A — Navigation redesign

Directly informed by:

- `/tmp/Woauidesign-ref/src/app/components/Header.tsx`

But implemented as a lighter Astro-owned pattern.

## Phase 2B — Button/card/badge replacement

Directly informed by:

- `/tmp/Woauidesign-ref/src/app/components/ui/button.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/card.tsx`
- `/tmp/Woauidesign-ref/src/app/components/ui/badge.tsx`
- `/tmp/Woauidesign-ref/EXAMPLE_PAGES.md`

But visually simplified and de-appified for editorial/reference use.

## Phase 3 — Forms and dense controls

Indirectly informed by:

- `/tmp/Woauidesign-ref/ASTRO_CONVERSION_GUIDE.md`
- form and filter examples in `EXAMPLE_PAGES.md`

## Phase 4 — Reading and editorial polish

This is where the reference repo should influence mood, spacing discipline, and compositional restraint, but typography should still be re-evaluated independently.

---

## 10) Recommended Design Decisions Emerging From This Critique

1. use the reference repo as a design system source, not a component import source
2. adopt its token strategy and dark-theme rigor
3. use its dropdown global nav direction as the replacement for current Daisy nav patterns
4. do not adopt its generic app-like card hover motion wholesale
5. do not adopt Cinzel as a universal heading face without testing
6. reserve sidebar patterns for Campaigns and utility-heavy reference surfaces
7. keep the current Astro-native approach and build site-owned primitives in `.astro`

---

## 11) Immediate Next Design Doc Work

The next document should refine these into implementation-facing design choices.

Recommended follow-up artifact:

- `UI Direction Spec` with:
  - approved light/dark palette subset,
  - heading/body/UI type shortlist,
  - top-nav pattern decision,
  - section-nav pattern decision,
  - card anatomy decision,
  - chip taxonomy decision,
  - sidebar usage rule.

---

## 12) Draft Direction Statement

World of Aletheia should move toward an editorial, atmospheric, token-driven Astro + Tailwind interface that borrows the reference repo's palette discipline, dark-theme readability work, and dropdown navigation direction, while avoiding generic app behaviors, heavy component frameworks, and overly ornamental styling. The UI should feel quieter, lighter, and more intentional than both the current Daisy-based site and the raw React prototype.

# UI Direction Spec Baseline (Draft)

## Status

- Date: 2026-04-13
- Status: Draft baseline
- Depends on: `plans/ui-revamp-and-daisy-extraction-plan-2026-04-11.md`
- Informed by: `plans/ui-ux-direction-brief-and-reference-repo-critique-2026-04-13.md`
- Scope: visual direction and component behavior baseline for the Astro + Tailwind revamp

---

## 1) Purpose

This document establishes the baseline UI direction that has already been agreed in principle.

It is not the final visual spec.

It is the working design contract for:

- theme direction,
- typography,
- global layout behavior,
- navigation direction,
- hero treatment,
- chip taxonomy,
- sidebar policy,
- component replacement priorities.

It is intended to reduce ambiguity before detailed component specs are written.

---

## 2) Direction Statement

World of Aletheia should move toward an editorial, atmospheric, Astro-native interface built with Tailwind and project-owned tokens/components. The site should feel lighter, clearer, and more intentional than the current Daisy-driven UI while preserving strong readability, curated imagery, and a grounded fantasy tone.

Primary visual goals:

- clearer reading hierarchy,
- lighter navigation,
- calmer but more intentional cards and controls,
- dark mode designed for readability first,
- stronger semantic distinction between UI elements with different meanings,
- less generic product-page feel.

---

## 3) Confirmed Baseline Decisions

## 3.1 Framework and implementation model

- Keep Astro-native architecture.
- Keep Tailwind.
- Remove DaisyUI over time through phased replacement.
- Build site-owned primitives in `.astro` where no client state is needed.
- Do not import React/Radix/shadcn component machinery into static content domains.

## 3.2 Typography

- Keep `Lora` as the serif voice.
- Keep `Inter` for UI text and controls.
- Do not change font families in the initial revamp phase.
- Improve hierarchy first through sizing, spacing, weight, tracking, and line length.

## 3.3 Dark theme model

- Do not split immediately into three separate dark themes.
- Use one stable dark foundation led by `Moonlight` values.
- Treat `Exotic Wildlife` and `Night Blooms` as accent families, not standalone first-pass themes.
- Use a restrained accent working set by default.

## 3.4 Hero direction

- Keep the current curated/random hero image governance.
- Improve hero structure and composition based on the reference repo direction.
- Do not adopt stock-photo-driven or template-like hero styling.
- Hero overlays and text treatment must be theme-aware and readability-driven.

## 3.5 Navigation direction

- Replace current Daisy tab-heavy patterns.
- Use a lighter dropdown/global menu direction.
- Keep top-level IA clear across Canon, Using Aletheia, Reference, Campaigns.
- Section navigation should be lighter than the current tab treatment.

## 3.6 Chip taxonomy

Use distinct semantic chip components rather than a single generic badge pattern:

- `TagChip`
- `TaxonomyPill`
- `StatusBadge`
- `RelationChip`
- `CountPill`

Future chip types may be added if they represent genuinely different meanings.

## 3.7 Sidebar policy

- Sidebar is an optional utility layout, not a site-wide default.
- First likely pilot: `Reference`, especially calendar/timeline style utility surfaces.
- Future candidate: `Campaigns`, once real content/navigation pressure justifies it.
- Do not use sidebars by default for Canon or Using Aletheia reading pages.

---

## 4) Desired UI Character

The UI should feel:

- grounded,
- editorial,
- readable,
- atmospheric,
- deliberate,
- lighter in touch than the current UI.

The UI should not feel:

- clunky,
- bulky,
- overly tabbed,
- dashboard-like,
- generic SaaS,
- ornamental for ornament's sake,
- dependent on thick borders and heavy card chrome.

---

## 5) Theme Baseline

## 5.1 Light theme baseline

Working direction:

- warm parchment/savanna base,
- earthy brown structural text,
- warm gold accent,
- restrained green support,
- subtle surface separation,
- clear text contrast without harshness.

Light-theme rules:

- body text remains dark and calm,
- headings can carry more warmth than body text,
- accents should support orientation and interaction rather than dominate,
- card surfaces should feel paper-like, not white-box product UI.

## 5.2 Dark theme baseline

Working direction:

- moonlight-led dark base,
- deep jungle surfaces,
- high-contrast readable text,
- bioluminescent primary accent,
- cyan and purple used sparingly for higher-emphasis moments only.

Dark-theme rules:

- default text hierarchy should stay calm and highly legible,
- bright exotic hues should be rare and purposeful,
- dark mode should not rely on many simultaneous accent colors,
- card, nav, input, and page surfaces need a clear depth ladder.

## 5.3 Accent-family policy

### Moonlight

Use for:

- dark-theme text hierarchy,
- headings,
- quiet emphasis,
- surface readability.

### Exotic Wildlife

Use for:

- limited interactive emphasis,
- category-specific highlights,
- rare states where a vivid accent is useful.

### Night Blooms

Use for:

- magical/rare/special emphasis,
- occasional highlight states,
- featured callouts only.

Do not use all accent families equally on the same screen.

---

## 6) Layout Baseline

## 6.1 Global frame

The site should continue to use a clear frame:

- header,
- hero or page-intro zone where appropriate,
- main content,
- footer.

## 6.2 Surface hierarchy

Each theme should clearly define:

1. page background,
2. section background,
3. card/panel background,
4. active/interactive surface,
5. hover/focus treatment.

## 6.3 Density

- Canon and Using Aletheia pages should prioritize reading comfort.
- Reference pages can be denser if utility demands it.
- Campaign pages can become denser later as real workflow patterns emerge.

---

## 7) Navigation Baseline

## 7.1 Global navigation

Target behavior:

- cleaner header than current implementation,
- grouped dropdown navigation,
- better branding presence,
- lighter visual footprint,
- mobile menu that feels consistent with desktop structure.

Global navigation should avoid:

- tab-like framing,
- heavy boxed treatments for every nav item,
- over-reliance on generic component-library appearance.

## 7.2 Section navigation

Section nav should likely move toward one of these families:

1. understated inline segmented nav
2. light pill-row nav
3. restrained editorial subnav rail

Current Daisy tabs should be treated as deprecated.

## 7.3 Search placement

- global architecture should leave room for search,
- but search UI should not force heavy header complexity before search behavior is ready.

---

## 8) Hero Baseline

Hero sections should:

- preserve the curated-image approach,
- have better composition than the current implementation,
- feel less like a generic banner and more like a purposeful opening frame,
- balance atmosphere with legibility.

Hero sections should not:

- depend on stock-template composition,
- use globally heavy dark overlays,
- become the main driver of page identity at the expense of content.

Preferred hero anatomy:

- image layer,
- controlled overlay layer,
- centered or intentionally aligned content block,
- strong title,
- restrained supporting text,
- one or two clear calls to action maximum.

---

## 9) Component Baseline

## 9.1 Buttons

Buttons should feel:

- lighter,
- cleaner,
- more intentional,
- less bulky than the current Daisy defaults.

Preferred traits:

- moderate radius,
- quieter borders,
- strong but not oversized focus states,
- variants limited to real semantic needs.

Core variants:

- primary
- quiet/secondary
- outline
- text/link
- destructive only if needed

## 9.2 Cards

Cards should feel:

- editorial,
- lighter than product marketing cards,
- structured but not heavy.

Cards should avoid:

- thick default borders everywhere,
- universal hover scaling,
- badge clutter,
- overly generic app-shell look.

Preferred behavior:

- gentle elevation or border shift on hover,
- clearer title-first hierarchy,
- metadata quieter than title/excerpt,
- image optional and deliberate.

## 9.3 Chips and badges

Chips must reflect semantic meaning, not just styling convenience.

### `TagChip`
- highest-visibility small metadata element
- supports scanning and filtering language

### `TaxonomyPill`
- for type/subtype/category classification
- quieter than tags unless taxonomy is the primary purpose of the screen

### `StatusBadge`
- for visibility, auth, featured, warning, or other state markers
- should not be visually interchangeable with tags

### `RelationChip`
- subtle supporting hint
- quieter than tags and taxonomy pills

### `CountPill`
- compact count/quantity marker
- especially useful in discovery or grouped views

## 9.4 Forms

Form controls should feel integrated with the same token system, not admin-generic.

Controls should prioritize:

- readability,
- obvious focus,
- calm surfaces,
- consistency across light and dark themes.

---

## 10) Sidebar Baseline

## 10.1 Approved use cases now

### Reference

Most promising first use:

- calendar controls,
- timeline filters,
- reference utility actions,
- possibly maps controls later.

This could simplify the current top-heavy calendar layout and let the page get to the main calendar faster.

### Campaigns

Approved as future-fit, but not as a first implementation target.

Wait for:

- more real campaign content,
- clearer campaign navigation pressure,
- evidence of persistent contextual controls.

## 10.2 Non-use cases by default

Do not default to sidebars for:

- homepage,
- Canon article pages,
- Using Aletheia article pages,
- simple collection index pages.

---

## 11) Replacement Priorities

## Priority 1

- theme tokens
- dark-theme reconstruction
- global nav
- section nav

## Priority 2

- buttons
- cards
- chip system
- homepage and discovery surfaces

## Priority 3

- form controls
- reference utility layouts
- sidebar pilot on Reference

## Priority 4

- article-page polish
- campaigns sidebar consideration when justified
- final Daisy removal

---

## 12) Still-Needed Reference Inputs

The baseline is now strong enough to proceed, but these references would materially improve the next spec.

## 12.1 Most useful references to provide

1. **Header / nav references**
   - examples of dropdown/global navigation you like
   - especially if they feel editorial rather than app-like

2. **Card references**
   - examples of content cards that feel lighter and less product-like
   - especially for article/discovery cards

3. **Hero references**
   - examples with composition or text placement you like
   - not necessarily fantasy-specific

4. **Dark-theme references**
   - examples where dark mode feels readable and atmospheric without becoming neon-heavy

5. **Chip / tag references**
   - examples where tags, pills, status markers, and counts feel clearly distinct

6. **Reference/sidebar references**
   - examples of utility sidebars for calendars, maps, timelines, or data-dense reading tools

## 12.2 Optional but useful clarifications

- whether you want the global header to feel more scholarly/editorial or more adventurous/atmospheric
- whether the homepage should remain primarily narrative with discovery support, or move slightly closer to guided exploration
- whether Canon collection pages should have subtle category personality differences or stay mostly uniform

---

## 13) Next Design Artifact

After this baseline, the next document should be a more concrete `UI Direction Spec` refinement or component pack that locks:

1. approved light-theme token subset
2. approved dark-theme token subset
3. top-nav pattern choice
4. section-nav pattern choice
5. button anatomy
6. card anatomy
7. chip anatomy and visual differentiation
8. Reference sidebar pilot rules

---

## 14) Baseline Approval Summary

Approved working baseline from current discussion:

- keep `Lora` and `Inter`
- use one moonlight-led dark foundation
- keep wildlife and bloom colors as accent families, not separate first-pass themes
- use lighter dropdown-based global navigation
- redesign hero structure while keeping curated/random Aletheia imagery
- define semantic chip components: `TagChip`, `TaxonomyPill`, `StatusBadge`, `RelationChip`, `CountPill`
- pilot sidebar in Reference, defer Campaigns sidebar until content justifies it
- continue phased Daisy extraction with Astro + Tailwind-owned primitives

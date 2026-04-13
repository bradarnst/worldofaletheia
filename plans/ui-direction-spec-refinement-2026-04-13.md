# UI Direction Spec Refinement (Draft)

## Status

- Date: 2026-04-13
- Status: Draft refinement
- Depends on: `plans/ui-direction-spec-baseline-2026-04-13.md`
- Scope: resolves first-round visual choices for nav, hero, cards, chips, sidebar, and homepage direction

---

## 1) Purpose

This document narrows the baseline UI direction into more specific implementation-facing choices based on the latest review notes and reference links.

It does not finalize exact CSS values.

It does define the preferred shape of:

- homepage structure,
- global header behavior,
- dropdown navigation content,
- card behavior,
- image usage in cards,
- sidebar pilot strategy,
- contribution affordances,
- subtle collection personality.

---

## 2) Newly Confirmed Direction

The following choices are now treated as approved working direction:

- keep `Lora` and `Inter`
- use one moonlight-led dark base with restrained accent families
- use a more atmospheric global header
- move toward guided exploration rather than a single dominant CTA
- prefer a non-fullscreen hero because the homepage should guide multiple paths
- add a `Contribute` destination and expose it in global navigation
- design a sidebar pattern now and pilot it in `Reference`
- defer Campaigns sidebar rollout until campaign content justifies it
- use semantic chip components rather than one generic badge pattern
- allow subtle per-collection personality differences within Canon

---

## 3) Navbar Direction

## 3.1 Reference interpretation

Provided references:

- `https://www.navbar.gallery/navbar/alignui`
- `https://www.navbar.gallery/navbar/fey`

Working takeaway:

- borrow the cleaner structure and dropdown organization,
- borrow the lighter, more atmospheric presence,
- do not copy a generic startup/product-nav feel,
- use the dropdowns to orient readers, not just list links.

## 3.2 Target behavior

The global header should feel:

- atmospheric,
- confident,
- editorial,
- slightly adventurous,
- lighter than the current Daisy nav.

The global header should include:

- stronger site branding,
- top-level grouped navigation,
- dropdowns with short descriptions,
- a small icon per section or collection group where helpful,
- `Contribute` as a visible destination,
- room for search later,
- theme switch affordance.

## 3.3 Dropdown structure

Each dropdown group should include:

- collection/surface name,
- one-line explanation,
- optional small icon,
- visual grouping that reinforces the four-layer model.

Recommended top-level groups:

- World of Aletheia
- Using Aletheia
- Reference
- Campaigns
- Contribute

### Example direction for dropdown content

#### World of Aletheia

- Lore — myths, histories, cosmology, and world truths
- Places — regions, cities, ruins, landmarks, and terrain
- Sentients — peoples, cultures, and lineages
- Bestiary — creatures, monsters, and animals
- Flora — plants, growths, and strange botanica
- Factions — powers, allegiances, and institutions

#### Using Aletheia

- Systems — rules, mechanics, and play material
- Meta — notes on design, usage, and project context
- About — what this world is, how it is built, and how it is used

#### Reference

- Calendar — dates, cycles, and seasonal structure
- Timeline — events placed in historical order
- Maps — geography and spatial reference

#### Campaigns

- Campaign Index — current and archived campaigns
- Sessions — public session material where available

#### Contribute

- Contribute — how to participate, propose edits, or collaborate

## 3.4 Navigation style guidance

Preferred characteristics:

- cleaner than current nav tabs,
- smaller visual chrome,
- more textual clarity,
- subtle icon support,
- dropdowns that read like guided orientation rather than generic app menus.

Avoid:

- thick boxed nav pills,
- loud hover effects,
- oversized top-nav controls,
- mega-menu sprawl unless content density proves necessary.

---

## 4) Homepage Direction

## 4.1 Strategic purpose

The homepage should support guided exploration, not a single marketing-style conversion path.

That means:

- no full-screen image-led hero as the primary direction,
- no single dominant CTA framing the whole experience,
- multiple strong onward paths surfaced early.

## 4.2 Preferred homepage structure

Recommended structure:

1. atmospheric header
2. medium/large hero intro (roughly one-third page presence, not full-page takeover)
3. guided exploration cards/sections below hero
4. optional featured/contribute/supporting section
5. footer

## 4.3 Hero role on homepage

The hero should:

- establish tone,
- frame the world,
- orient the user,
- provide one or two gentle starting actions if needed.

The hero should not:

- consume the entire first screen with one image,
- force one primary conversion goal,
- compete with the guided exploration content below.

## 4.4 CTA strategy

Recommended interpretation:

The homepage does not need one classic CTA.

Instead, it should present guided entry points such as:

- Start with Canon
- Start with Using Aletheia
- Explore the Reference tools
- Contribute

These can be represented as:

- low-pressure hero links,
- section cards directly below the hero,
- or a combination of both.

Recommended priority:

- keep hero CTA minimal,
- let the section cards do most of the guidance work.

## 4.5 Contribute placement

`Contribute` should exist in more than one place:

- global nav
- dedicated page
- optionally one homepage support card or callout block

It should not dominate the homepage, but it should be easy to find.

---

## 5) Card Direction

## 5.1 Core card principles

Cards should become:

- lighter,
- tighter,
- less empty,
- less product-page-like,
- more content-led.

Changes from current direction:

- smaller heading scale inside cards,
- less dead air,
- thinner border treatment,
- quieter actions,
- less bulky buttons.

## 5.2 Image policy for cards

Approved direction:

- if an article or entry has a meaningful image, use it
- if there is no meaningful image, do not reserve empty image space
- do not force visual consistency by inventing image placeholders

This implies two primary card modes:

1. **image card**
   - uses a specific content image
   - image must be relevant to the entry

2. **text-first card**
   - no image block at all
   - content fills the space naturally

## 5.3 Bento usage

Bento-style composition is acceptable for curated homepage or discovery surfaces.

Recommended rule:

- use bento layouts selectively for guided-exploration sections or featured groupings
- do not make every collection index a bento grid by default
- standard collection/discovery listings should remain flexible and readable

## 5.4 Button treatment inside cards

Avoid large CTA-style buttons inside most content cards.

Preferred patterns:

- title and excerpt carry the scan value,
- small text-link or subtle trailing action treatment,
- whole-card clickability where appropriate,
- no bulky Daisy-style buttons unless truly needed.

---

## 6) Hero Direction

## 6.1 Preferred option

Based on the decision toward guided exploration, the preferred homepage hero is:

- not full-screen,
- large enough to set tone,
- followed immediately by exploration sections/cards.

This resolves the earlier open question.

## 6.2 Hero composition

Recommended anatomy:

- curated random Aletheia image
- controlled gradient/overlay
- strong title or framing statement
- short supporting copy
- optional one or two light-touch entry links
- transition into section cards below

## 6.3 Hero copy behavior

Hero copy should act more like orientation than promotion.

It should answer:

- what this place is,
- what the visitor can do here,
- where to begin.

It should avoid:

- hard-sell CTA language,
- generic “discover more” phrasing without specific pathways,
- too many buttons.

---

## 7) Dark Theme Refinement

## 7.1 Approved strategy

Use one dark theme foundation with:

- Moonlight as the base text/surface hierarchy
- Exotic Wildlife as a controlled vivid accent family
- Night Blooms as rare highlight accents

## 7.2 Practical use rule

On a normal dark-theme page:

- one primary accent family should dominate,
- one secondary accent may appear sparingly,
- bloom-style accents should be rare,
- glow effects are acceptable when controlled and purposeful.

## 7.3 Glow and standout treatment

Glow or gradient emphasis is acceptable for:

- standout sections,
- selected cards,
- featured callouts,
- subtle hero atmosphere.

It should not be the default treatment for every component.

---

## 8) Sidebar Refinement

## 8.1 Pilot target

The first sidebar pilot should be `Reference`, most likely `Calendar`.

Reason:

- current calendar page is top-heavy,
- controls can move into a cleaner persistent utility rail,
- the main calendar can appear earlier and more prominently.

## 8.2 Sidebar visual direction

Requested direction:

- subtle,
- clean,
- icon-supported,
- typographically clear,
- aligned with the dropdown/global-nav visual language,
- likely slightly larger text than dropdown items.

## 8.3 Campaigns timing

Do not block sidebar design on campaign content.

Recommended approach:

- define the sidebar pattern now,
- validate it in Reference,
- reuse/adapt it later for Campaigns if real content structure supports it.

---

## 9) Collection Personality

## 9.1 Approved direction

Canon collections may have subtle personality differences.

Key word: subtle.

## 9.2 Acceptable personality signals

Use restrained variation through:

- accent choice,
- icon choice,
- background motif strength,
- hero framing,
- section-divider styling,
- occasional tonal shift in callout surfaces.

## 9.3 What to avoid

Do not create:

- radically different layouts per collection,
- incompatible card systems,
- unrelated color worlds,
- novelty UI that breaks product coherence.

The site should still read as one system.

---

## 10) Chip System Refinement

The semantic chip model is approved and should be preserved.

### `TagChip`

- most discoverable chip treatment
- used where tags are interactive or scan-critical

### `TaxonomyPill`

- lighter classification marker
- useful for type/subtype/category

### `StatusBadge`

- strongest state-signaling chip
- reserved for visibility, warning, auth, featured, or similar states

### `RelationChip`

- quieter than the others
- supports relationship metadata without overpowering content

### `CountPill`

- compact numeric/supportive marker
- useful in grouped, filtered, or reference-driven contexts

Iteration is expected after first visual pass.

---

## 11) What Is Now Sufficiently Decided

These items are sufficiently decided to move into concrete component/spec work:

1. typography families
2. dark-theme strategy
3. global-nav direction
4. homepage guided-exploration direction
5. hero size direction
6. card image policy
7. contribute placement expectations
8. sidebar pilot target
9. chip taxonomy
10. subtle collection personality rule

---

## 12) Remaining Useful References

Not blocking, but still helpful:

1. hero/layout references you like
2. lighter content-card references
3. chip/tag/status examples once you find any you like
4. utility-sidebar examples if you come across them

Dark-theme references are now optional since you prefer to prototype and iterate with the palette in hand.

---

## 13) Recommended Next Spec

The next concrete design document should lock these implementation-facing choices:

1. global header anatomy
2. dropdown item anatomy
3. homepage hero wireframe
4. homepage exploration-card system
5. standard card variants
6. chip visual differentiation rules
7. Reference sidebar wireframe
8. first-pass token subset for light and dark themes

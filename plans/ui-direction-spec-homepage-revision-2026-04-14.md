# UI Direction Spec Homepage Revision (Draft)

## Status

- Date: 2026-04-14
- Status: Draft revision
- Depends on: `plans/ui-direction-spec-baseline-2026-04-13.md`
- Depends on: `plans/ui-direction-spec-refinement-2026-04-13.md`
- Scope: revises homepage and navigation direction after additional landing-page reference review

---

## 1) Why This Revision Exists

After reviewing more landing pages, the preferred homepage direction has changed.

The previous direction favored:

- a medium/large hero,
- guided exploration sections immediately below,
- a lighter dropdown/global nav.

The revised direction now favors:

- a full-page or near-full-page hero,
- richer dropdown navigation where menu items behave more like compact cards,
- the navigation itself doing more of the guided-exploration work,
- a scroll experience below the hero that reinforces the major site domains and supporting routes.

This revision supersedes the previous homepage-size recommendation while keeping the broader Astro + Tailwind revamp strategy intact.

---

## 2) High-Level Verdict

This new direction is coherent and can work well for World of Aletheia.

It changes the balance of the homepage from:

- hero + visible section cards first

to:

- hero + navigation-led guided exploration first.

This is a valid shift because:

- the site benefits from stronger atmosphere,
- the user wants a more immersive entry point,
- the dropdown menus can carry a lot of orientation work,
- a full-page hero can feel purposeful if the menu is rich enough and the scroll content is disciplined.

The main constraint is that the homepage must still respect the existing story-first intent rather than collapsing into a pure navigation index.

---

## 3) Reference Review

## 3.1 `https://duna.com/`

Best takeaway:

- strong premium full-hero presence,
- clear sense of polish,
- large opening frame with confident navigation.

What to borrow:

- confidence of the opening composition,
- willingness to let the hero own the first screen,
- premium spacing and restraint.

What not to borrow:

- product-marketing conversion tone,
- enterprise SaaS density,
- overly businesslike CTA framing.

## 3.2 `https://getfrankli.com/`

Best takeaway:

- larger dropdown item presence can feel substantial and readable.

What to borrow:

- the idea that dropdown items can be more than one-line links.

What not to borrow:

- oversized dropdown cards as the default,
- overly large flyout items that feel jarring,
- too much visual blockiness in the nav.

Conclusion:

- useful as an upper bound, not the exact target.

## 3.3 `https://wisprflow.ai/`

Best takeaway:

- dropdown items with icons, title, and short description are close to the right size,
- rich menu items can still feel familiar rather than strange,
- the nav can do meaningful orientation work.

What to borrow:

- icon + title + short description item anatomy,
- compact card-like dropdown items,
- readable grouped flyout structure.

What not to borrow:

- startup/product voice,
- overly feature-heavy information scent,
- utility density beyond what Aletheia needs.

---

## 4) Revised Homepage Direction

## 4.1 Preferred top-of-page structure

New preferred structure:

1. atmospheric header
2. full-page or near-full-page hero
3. rich dropdown navigation as primary guided-exploration mechanism
4. below-the-fold supporting sections
5. footer

## 4.2 Why full-page hero now works

A full-page hero becomes viable if the header and dropdown menus do enough orientation work.

That means the homepage no longer depends on visible section cards immediately below the hero to explain the site.

Instead:

- the hero sets tone and scale,
- the dropdowns explain the information architecture,
- the scroll sections reinforce or deepen what the visitor already saw in the nav.

## 4.3 Homepage strategic role

The homepage should now behave like:

- an atmospheric gateway,
- a world-first entry point,
- a guided portal into the main domains.

It should not behave like:

- a latest-post feed,
- a generic content index,
- a product-marketing funnel.

---

## 5) Revised Navigation Direction

## 5.1 Global header style

The header should now lean more strongly into:

- atmosphere,
- immersion,
- guidance,
- premium composure.

The earlier requirement for a lighter dropdown/nav still stands, but “lighter” now means:

- not clunky,
- not tabbed,
- not boxed like Daisy,
- not startup-generic,
- not visually noisy.

It does **not** mean minimal to the point of feeling plain.

## 5.2 Dropdown item anatomy

Recommended dropdown item anatomy:

- small icon,
- title,
- short one-line description,
- compact card-like spacing,
- subtle hover/focus treatment,
- enough room to feel substantial.

This should feel like:

- a compact informational card,
- not a plain text link,
- not a large promo tile.

## 5.3 Size recommendation

Recommended target size is closest to the Wispr Flow direction:

- larger than a standard list item,
- smaller than a full promo card,
- comfortably scannable,
- familiar enough that it does not feel experimental.

## 5.4 Recommended dropdown layout

Desktop direction:

- grouped flyout,
- likely two columns for the denser groups,
- icons and descriptions visible,
- compact but breathable spacing.

Mobile direction:

- stacked accordion or grouped drawer,
- same title + description structure,
- no mega-menu complexity.

---

## 6) Revised Homepage Content Below the Hero

## 6.1 What should come after the hero

Two valid options were considered:

1. content previews such as random/latest items
2. explanatory/support sections about the major domains

Recommended first-pass choice:

- favor explanatory/support sections first,
- use curated featured content second,
- avoid making the homepage depend on random/latest content immediately.

## 6.2 Reasoning

This keeps the homepage aligned with the story-first ADR.

If the page immediately becomes:

- latest canon,
- latest using,
- latest campaign,
- small calendar,

then it risks becoming a mixed dashboard/index surface rather than a deliberate landing page.

A better first pass is:

1. hero
2. section explaining the main domains in a more grounded way
3. optional curated featured content band
4. Contribute section
5. About/supporting context

## 6.3 Recommended supporting sections

Recommended post-hero sections:

- Canon overview
- Using Aletheia overview
- Campaigns overview
- Reference overview
- Contribute callout
- About/context block

Each of these can be:

- card-based,
- panel-based,
- or mixed.

They do not all need to show live content in the first pass.

## 6.4 Content previews later

Live content modules can be added later, such as:

- featured Canon article,
- featured Using Aletheia article,
- featured Campaign entry,
- calendar preview,
- featured map/timeline item.

But they should be curated or intentionally selected, not purely random by default.

---

## 7) CTA Revision

The earlier concern about “what is the one CTA?” is now resolved.

The homepage should not have one dominant CTA.

Instead, use:

- one or two light hero actions at most,
- with the main branching behavior handled by the dropdown nav and supporting sections.

Good candidate actions:

- Enter the World
- Start with Canon
- Start with Using Aletheia
- Contribute

Avoid:

- campaign-specific CTA unless there is a clearly primary public campaign,
- login as the main homepage action,
- too many hero buttons.

---

## 8) Cards Under the Revised Direction

## 8.1 Collection landing cards still matter

Even with richer dropdown navigation, cards remain important for:

- collection landing pages,
- guided sections below the hero,
- discovery surfaces,
- featured content blocks.

## 8.2 Revised card priority

Because the nav is now doing more orientation work, the cards below the hero can be calmer.

That means:

- cleaner layout,
- thinner borders,
- less emphasis on CTA buttons,
- optional image support,
- more confidence in text-led cards.

## 8.3 Background image option

Background imagery can be used selectively, but should not become the default for all cards.

Recommended use:

- curated homepage domain panels,
- special featured sections,
- occasional collection hero-adjacent cards.

Not recommended as a universal listing-card treatment.

---

## 9) Sidebar and Chips

These are now lower priority inputs for the homepage direction and can safely move later.

Current status:

- chip/tag/status differentiation remains approved,
- utility sidebar work remains approved for later,
- neither blocks homepage/header direction.

That sequencing makes sense.

---

## 10) Future Interactive Map Idea

The idea of mapping site sections onto an explorable map of Aletheia is interesting and should be treated as a later exploratory concept.

Assessment:

- potentially fun,
- potentially distinctive,
- potentially gimmicky if forced too early.

Recommended treatment:

- do not design around it now,
- do not let it drive current homepage IA,
- keep it as a future experimental/reference experience once the core UI system is stable.

This is better treated as a later feature concept than a current homepage dependency.

---

## 11) Revised Working Decisions

The homepage and nav direction should now assume:

1. full-page or near-full-page hero is acceptable and preferred
2. rich dropdown menus will do more of the guided-exploration work
3. dropdown items should be compact card-like items with icon + title + short description
4. item size should be closer to Wispr Flow than to Frankli
5. below-the-fold sections should prioritize explanation and curation over random/latest feeds
6. full content-preview modules can come later if curated intentionally
7. collection cards still matter, but can be cleaner and calmer because the nav is carrying more guidance
8. the future map-navigation concept is out of current scope

---

## 12) Recommended Next Spec

The next concrete design spec should now focus on:

1. global header anatomy
2. dropdown flyout anatomy
3. dropdown item/card anatomy
4. hero wireframe for full-page or near-full-page layout
5. homepage post-hero section order
6. first-pass content selection rule for homepage supporting sections
7. standard collection card variants
8. contribution page placement and nav treatment

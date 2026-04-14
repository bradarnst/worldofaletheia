# Collection and Article Surface Spec (Draft)

## Status

- Date: 2026-04-14
- Status: Draft
- Depends on:
  - `plans/ui-direction-spec-baseline-2026-04-13.md`
  - `plans/ui-direction-spec-refinement-2026-04-13.md`
  - `plans/ui-direction-spec-homepage-revision-2026-04-14.md`
  - `plans/ui-direction-decision-register-2026-04-14.md`
- Scope: collection landing pages, article pages, card surfaces, footer direction, and icon/glyph flavor system

---

## 1) Purpose

This document extends the homepage and navigation decisions into the two page families that matter most after landing:

- collection landing pages
- individual article/content pages

It also records the latest decisions about:

- card imagery policy
- bento rejection
- collection-level atmospheric backgrounds
- article-header metadata treatment
- footer direction
- icon/glyph flavor strategy

---

## 2) Collection Landing Pages

## 2.1 Strategic role

Collection landing pages are discovery surfaces.

Their job is to help users:

- understand what the collection is
- scan available entries quickly
- filter/search content efficiently
- feel the collection's identity without sacrificing readability

They should not behave like miniature homepages and should not compete with the main landing page for spectacle.

## 2.2 Visual structure

Approved direction:

- subtle collection-level background image, motif, texture, or gradient is allowed
- the background should be heavily blurred, tinted, or otherwise softened
- the collection intro sits over that atmospheric surface
- cards sit above the background on clean opaque surfaces
- gutters between cards allow the collection background to come through

Interpretation:

- atmosphere belongs primarily at the page level
- readability belongs primarily at the card level

## 2.3 Collection background policy

Preferred order of use:

1. blurred/tinted collection background image
2. subtle texture background that matches collection tone
3. gradient-only treatment if imagery adds noise

Current decision:

- all collection backgrounds should be image-first in the current design pass

Background asset recommendation:

- preferred source size: `2880x1800`
- minimum useful source size: `2400x1500`
- preferred orientation: landscape
- keep the strongest visual subject near the center-safe area
- optimize for mood and silhouette, not small detail
- generate responsive derivatives if useful, but the source should be strong enough to support heavy blur/tint treatment

Rules:

- background should support identity, not steal focus
- background detail should stay low-frequency
- background should transition cleanly into lower page sections if scrolling continues
- dark themes need stronger restraint so noise does not compound

## 2.4 Intro/header zone

Collection intro zone should include:

- title
- short collection explanation
- subtle motif/background treatment
- optional collection icon

Collection intro zone should not include:

- loud CTA stacks
- bulky badge piles
- oversized decorative frames

## 2.5 Search and filter bar

Approved direction:

- compact search/filter bar
- sits below the global nav
- visually sits on top of the collection intro/background zone
- opaque or nearly opaque, not transparent like a floating glass card
- compact enough not to dominate the page

Settled contents:

- site-wide search input
- type filter
- tag filter

Layout preference:

- one compact row on wider screens if possible
- two compact rows are acceptable if one row becomes too busy
- a split layout of two compact grouped rows/columns is acceptable if needed for balance

Still to validate in prototype:

- whether the bar spans full width or sits within the content container
- whether search and filter stay on one line at desktop
- whether it becomes sticky after scroll
- whether sort or result-count affordances belong in this bar or elsewhere

---

## 3) Card System for Collection Pages

## 3.1 No bento default

Settled decision:

- do not use bento layouts for standard collection listings

Reason:

- primary site purpose is exploration and information scanning
- bento reduces comparability across entries
- paginated listing grids benefit from predictable rhythm

## 3.2 Card imagery policy

Settled decision:

- standard automated collection cards do not use thumbnail images
- card atmosphere should come from page-level background, not per-card imagery

This means:

- no default thumbnails for listing cards
- no smart-padding requirement for listing cards
- no blurred/tinted card-background images by default

## 3.3 Card appearance

Approved direction:

- opaque cards
- clean surfaces
- enough gutter between cards to reveal page atmosphere
- calm border treatment
- light visual depth, if any

Cards should feel:

- readable
- compact
- informative
- quieter than homepage hero surfaces

## 3.4 Card content hierarchy

Collection cards should generally support:

- small icon for `type`, where available
- title
- optional short summary / excerpt
- quiet metadata if useful
- tags only if they help scanning meaningfully

Cards should avoid:

- large CTA buttons
- too many badges
- decorative image treatment for its own sake

## 3.5 Special content exception

Some future content types may have dedicated visual layouts with explicit thumbnail/image slots, such as:

- character sheets
- GM support content
- player-facing handouts

These are exceptions, not the default collection-card model.

Those layouts may define:

- required image resolution
- fixed image slot placement
- custom surface treatment

---

## 4) Article / Content Pages

## 4.1 Strategic role

Article pages are reading surfaces first.

They should prioritize:

- reading comfort
- content hierarchy
- world context
- relationship navigation

They should not imitate collection landing pages or homepage hero patterns.

## 4.2 Top image policy

Settled decision:

- do not use a top hero image on normal article/content pages

Reason:

- if an image matters for the article, it should be placed intentionally within the article body
- the page should lead with title, summary, and world context rather than a decorative banner

## 4.3 Article header/content preface

Approved direction:

- breadcrumbs / parent chain
- title
- summary / TLDR
- taxonomy
- relationships and relevant cross-links
- tags last

This information should feel like a subtle front matter / world context block, not a wall of badges.

## 4.4 Summary policy

Preferred rule:

1. use explicit summary if provided
2. otherwise generate a deterministic fallback at build time
3. if stronger generation is unavailable, use trimmed opening content

Current fallback recommendation:

- target roughly `160-220` characters rather than an extremely short snippet
- append ellipsis only if truncation actually occurs

## 4.5 World context treatment

The article header should separate world-context metadata from the main prose body.

That context block may include:

- breadcrumbs
- taxonomy
- tags
- relationships
- related links to other world entries

Visual intent:

- quieter than the article title
- more structured than plain prose
- less badge-heavy than a dashboard
- clearly separate from the main content flow

## 4.6 Background treatment for article pages

Approved direction:

- very subtle texture or motif may appear in outer margins or page background
- this should be much quieter than collection landing backgrounds
- References may use similar subtle atmospheric treatment

The main prose surface should remain calm and highly readable.

---

## 5) Footer Direction

## 5.1 Strategic role

Footer should be quiet, compact, and useful.

It should not compete with the header or homepage hero.

## 5.2 Approved content direction

Footer should likely include:

- About
- Contribute
- Contact
- GitHub
- copyright notice
- optional social links later if they become project-specific and worth exposing

## 5.3 Layout direction

Approved direction:

- compact multi-column layout
- simple text-first presentation
- tiny supporting icons only where useful
- restrained spacing

`Contribute` should remain easy to find in multiple places, including:

- global navigation
- footer
- dedicated page

---

## 6) Icon / Glyph Flavor System

## 6.1 Purpose

Glyphs/icons should add flavor without slowing scan speed.

They are a support system for identity, not the main event.

## 6.2 Approved direction

Use a custom SVG icon set tied to content `type` and/or collection identity.

Good uses:

- card type markers
- collection intro icons
- dropdown item support icons
- subtle metadata cues

## 6.3 Rules

- same meaning should map to the same glyph everywhere
- icons should stay small and consistent
- icons should support scanning, not decorate every empty space
- color treatment should remain tied to the token system

## 6.4 Approved icon direction

Settled decision:

- go straight to a custom SVG icon set so the glyphs feel like one family
- external icon libraries may still be used temporarily for rough sketching if needed, but they are not the target system

Initial approved collection/domain icon set includes:

- Canon
- Using
- Campaigns
- Reference
- Lore
- Sentients
- Places
- Factions
- Bestiary
- Flora
- Sessions
- Characters
- Scenes
- Adventures
- Hooks
- Systems
- specific systems such as GURPS
- Meta
- Calendar
- Timeline
- Maps

A larger icon map for the many enumerated Canon and Campaign types will be added later.

---

## 7) Build-Time Support

## 7.1 Image/build utilities

Current direction supports build-time utilities for:

- collection atmospheric backgrounds
- blurred/tinted motif derivatives if needed
- fixed asset preparation for special content types

Standard listing cards do not require image derivation in the current model.

## 7.2 Summary/build utilities

Build-time support may also handle:

- explicit-summary fallback generation
- deterministic TLDR extraction

Approved summary rule:

- authored summary is always preferred
- if the summary is blank, generate a build-time fallback
- generation can occur during build or pre-build/ingest as long as the output is deterministic and reviewable

This should remain deterministic and low-risk in the first pass.

---

## 8) Still Needed for a Detailed First Cut

The following is still needed to turn this into a more exact visual spec:

1. exact opacity/blur/overlay ranges for collection backgrounds
2. exact collection intro/header heights
3. exact responsive layout/breakpoint behavior for the compact search + type + tag bar
4. exact article front-matter/world-context layout beyond the approved order
5. exact footer column grouping and ordering of About / Contribute / Contact / GitHub / copyright
6. actual collection background image assignments and whether each collection uses one fixed image or a rotating pool
7. the larger custom SVG icon map for all enumerated Canon and Campaign type values

---

## 9) Short Summary

Settled now:

- no bento for normal collection listings
- no default thumbnail images on standard collection cards
- collection identity comes from page-level atmosphere, not card-level image treatment
- collection cards are opaque and scan-friendly
- article pages do not get top hero images
- article headers should use a subtle world-context/front-matter treatment
- footer should be compact, restrained, and useful
- icons/glyphs should start small and semantic, then grow into a curated library over time

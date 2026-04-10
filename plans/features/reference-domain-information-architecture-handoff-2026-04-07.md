# Reference Domain Information Architecture Handoff (2026-04-07)

## Status

- Status: Implemented; retained as the Reference rehome record
- Priority tracking: use `.kilo/plans/1775545082688-jolly-meadow.md`
- Related ADR: `plans/adrs/0018-reference-domain-and-references-route-namespace-policy.md`
- Related prior ADR: `plans/adrs/0014-calendar-and-timeline-canon-utility-routes-and-lore-event-metadata-policy.md` (route placement superseded; lore event metadata still active)

## Purpose

This handoff records the new Reference layer and the route migration that unlocked later calendar UI work.

The core decision is:

- Reference becomes the fourth top-level site layer.
- Its route namespace is `/references/*`.
- Calendar, Timeline, and Maps become Reference surfaces.

## Locked Decisions

1. Use one new global nav entry for the layer, not separate Calendar/Timeline one-offs.
2. Use `/references` as the hub page.
3. Move utility surfaces to:
   - `/references/calendar`
   - `/references/timeline`
   - `/references/maps`
4. Do not add a separate Tools domain.
5. Do not keep Calendar/Timeline as Canon subnav tabs.
6. Do not use oversized hero callouts on regular pages to compensate for weak IA.
7. Keep calendar APIs at `/api/calendar/*`.
8. Assume a real route move, not a permanent redirect strategy, unless later traffic evidence forces a compatibility pass.

## IA Model

### Top-level layers after this change

- Canon - world content collections (`/lore`, `/places`, `/sentients`, `/bestiary`, `/flora`, `/factions`)
- Using Aletheia - systems, meta, and play guidance (`/about`, `/systems`, `/meta`)
- Reference - world-facing reference surfaces (`/references/**`)
- Campaigns - campaign content and future islands (`/campaigns/**`)

### What belongs in Reference

Reference owns surfaces whose primary value is navigation, inspection, lookup, or visualization of world knowledge rather than authored collection browsing.

Initial Reference surfaces:
- Calendar
- Timeline
- Maps

Likely future Reference surfaces:
- zoomable map regions
- print/save-to-PDF map rendering
- image/reference viewers

## Route Policy

### Canonical routes

- `/references`
- `/references/calendar`
- `/references/timeline`
- `/references/maps`

### API routes

Remain unchanged for now:
- `/api/calendar/month`
- `/api/calendar/week`
- `/api/calendar/year`
- `/api/calendar/moon-phase`
- `/api/calendar/date-diff`
- `/api/calendar/day`

### Migration rule

Implementation should move internal links, sitemap entries, canonicals, tests, and layout references to the new route family in the same tranche.

This handoff does **not** assume a redirect layer. If compatibility aliases are later desired, they should be handled by a separate explicit decision.

## Navigation Design

### Global navigation

Required change:
- replace direct Calendar one-off entry with a single `Reference` entry

Recommended top-level shape:
- Home
- World of Aletheia
- Using Aletheia
- Reference
- Campaigns

### Canon navigation

Required change:
- keep collection navigation collection-focused only
- remove Calendar/Timeline from Canon tabs

### Using Aletheia navigation

Required change:
- keep section navigation focused on Using content
- do not add direct Calendar one-offs there once Reference exists

### Reference local navigation

Add a compact Reference-local nav for pages within `/references/**`.

Recommended items:
- Overview
- Calendar
- Timeline
- Maps

This local nav should be compact and layout-native, not a large hero callout block.

## Page and Layout Strategy

### Recommended route/layout structure

Primary implementation surfaces:
- `src/pages/references/index.astro`
- `src/pages/references/calendar/index.astro`
- `src/pages/references/timeline/index.astro`
- `src/pages/references/maps/index.astro`
- `src/layouts/ReferenceLayout.astro`
- `src/components/ReferenceNav.astro`
- optional `src/components/ReferenceHeader.astro`

### Reference landing page

The landing page should act as a compact hub, not a giant splash page.

Required content blocks:
- Calendar card - civic dates, date lookup, date math, festivals, lunar cycle
- Timeline card - dated lore chronology
- Maps card - world maps and regional exploration

Optional support blocks:
- short explanation of how Reference differs from Canon collections
- small “coming soon” note if maps experience starts simple

### Canon and Using landing pages

Recommended but secondary:
- add a compact Reference card or section link on `/aletheia-world-canon`
- add a compact Reference card or section link on `/using-aletheia`

This preserves discoverability without bloating every internal layout.

## Calendar and Timeline Rehome Requirements

### Calendar

Move primary page routing from `/calendar` to `/references/calendar`.

Required follow-on updates:
- page title, canonical URLs, and any helper-generated URLs
- internal links from timeline, landing pages, and sitemap
- tests expecting calendar route paths
- calendar documentation examples

### Timeline

Move primary page routing from `/timeline` to `/references/timeline`.

Required follow-on updates:
- calendar-to-timeline cross-links
- sitemap entries
- documentation examples

### Maps

Introduce `/references/maps` as the stable route even if the first implementation is intentionally simple.

Maps MVP can begin as:
- curated static map display
- region list or image-set navigation
- future zoom/print/PDF deferred

## SEO and Discoverability Requirements

Required updates:
- sitemap entries move to `/references/**`
- canonical URLs reflect the new namespace
- indexability policy continues to allow Reference surfaces to be indexed
- remove stale mentions of `/calendar` and `/timeline` as root routes from SEO docs

## Implemented Order

1. Add ADR and doc updates for the new Reference domain.
2. Create Reference layout/nav and Reference landing page.
3. Move Calendar and Timeline pages into `/references/**`.
4. Add Maps route and landing card.
5. Remove obsolete one-off Calendar/Timeline nav links from global/Canon/Using navigation.
6. Update sitemap, canonicals, links, and tests.
7. After route migration stabilizes, continue the Leap Day and richer calendar UI work on `/references/calendar`.

## Validation Requirements

Required implementation checks:
- `pnpm test`
- `pnpm build`
- no remaining internal links pointing to root `/calendar` or `/timeline`
- global nav includes Reference, not direct Calendar one-off link
- Canon nav contains only collection-oriented entries
- `/references`, `/references/calendar`, `/references/timeline`, and `/references/maps` resolve correctly
- sitemap and canonical metadata reflect the new namespace

## Non-Goals

- No separate Tools domain.
- No API namespace migration from `/api/calendar/*` to `/api/references/*`.
- No redirect strategy work unless separately requested.
- No forced map zoom/export feature in this tranche.
- No large hero-adjacent utility callout blocks across normal content layouts.

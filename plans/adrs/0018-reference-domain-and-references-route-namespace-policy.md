# Reference Domain and `/references/*` Route Namespace Policy

## Status

- Date: 2026-04-07
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

Calendar and timeline started as site-level utility routes because they are both in-world chronology surfaces and practical table-use aids. Initial implementation planning treated them as Canon-facing exceptions, but active navigation experiments exposed an information architecture problem: once calendar, timeline, and maps all need first-class discoverability, one-off links in Canon navigation or the global navbar start to create structural drift.

The project now has enough evidence that these surfaces are not isolated exceptions. They form a coherent fourth layer of the product:

- world-facing reference utilities,
- shared across Canon and Using Aletheia use cases,
- distinct from Canon collections,
- and likely to grow with maps and other reference viewers.

The site therefore needs a stable domain and route policy before more calendar UI work lands.

Existing constraints remain in force:

- Astro-native, static-first implementation remains the default.
- Calendar/timeline/map surfaces remain read-oriented reference experiences, not CMS-style content systems.
- No service/adaptor/contract layer is introduced by this IA decision.

## Decision Drivers

- Avoid ongoing growth of one-off links in global and domain navigation.
- Preserve Canon collection navigation for collections rather than utility pages.
- Create a clean long-term home for Calendar, Timeline, and Maps.
- Keep reference surfaces world-first in framing while still useful for play.
- Make route structure match the emerging information architecture.
- Make the namespace decision now while route surface area is still small.

## Considered Options

### Option 1: Keep utility pages as Canon exceptions at root routes

Retain `/calendar` and `/timeline` as top-level utility routes and continue surfacing them through Canon/global navigation exceptions.

**Pros**

- Short URLs.
- Lowest immediate migration cost.

**Cons**

- Encourages nav sprawl as more reference surfaces appear.
- Keeps Canon navigation structurally inconsistent by mixing collections and utilities.
- Leaves the new domain mostly conceptual rather than architectural.

### Option 2: Create a Reference domain but keep existing root routes

Add a Reference landing page while leaving utility pages at `/calendar` and `/timeline`.

**Pros**

- Lower migration churn than full route namespacing.
- Allows IA experimentation first.

**Cons**

- Weakens the domain boundary.
- Leaves URL structure out of sync with the information architecture.
- Delays an eventual route migration that is cheaper now than later.

### Option 3: Create a Reference domain with namespaced `/references/*` routes (Chosen)

Introduce Reference as a fourth top-level layer and move its primary surfaces under `/references/*`.

**Pros**

- Cleanest long-term IA.
- Prevents one-off navigation growth.
- Gives maps a natural home from the start.
- Keeps route structure aligned with layout/component organization.
- Makes future reference surfaces easier to add coherently.

**Cons**

- Requires route migration and link updates now.
- Slightly longer URLs than root-route utilities.

## Decision Outcome

**Chosen option:** Option 3 - create a Reference domain with namespaced `/references/*` routes.

### Policy

1. Reference becomes the fourth top-level information architecture layer of the site.
2. Initial Reference surfaces are:
   - `/references`
   - `/references/calendar`
   - `/references/timeline`
   - `/references/maps`
3. The route namespace is plural (`/references/*`) even though the IA label may use the singular term “Reference” in navigation or headings.
4. Calendar and Timeline are no longer treated as Canon collection-navigation exceptions.
5. Global navigation should expose one durable entry to the Reference layer rather than separate one-off Calendar/Timeline links.
6. Canon and Using Aletheia landing pages may link into Reference, but Reference owns the primary discoverability surface for calendar, timeline, and maps.
7. Existing calendar APIs remain under `/api/calendar/*`; Reference route namespacing does not imply an API namespace change.
8. The current plan assumes a true route move rather than a permanent redirect/alias layer.
9. Lore event metadata policy from ADR-0014 remains active; only the route placement and navigation portions are superseded.

### Consequences

#### Positive

- Information architecture now cleanly separates collections from reference surfaces.
- Calendar, Timeline, and Maps can grow without polluting Canon or global navigation.
- Route/layout/component organization can align around a stable Reference namespace.

#### Negative

- Internal links, sitemap entries, canonical URLs, tests, and layouts need coordinated updates.
- Existing root-route references become stale and must be actively removed.

#### Neutral

- Calendar, timeline, and maps remain in-world-first experiences.
- Calendar APIs stay under `/api/calendar/*`.
- No separate “Tools” domain is introduced.

## Links

- `plans/adrs/0014-calendar-and-timeline-canon-utility-routes-and-lore-event-metadata-policy.md`
- `plans/adrs/0015-seo-and-crawler-governance-policy.md`
- `plans/adrs/0017-civic-leap-day-weekday-participation-policy.md`
- `plans/features/reference-domain-information-architecture-handoff-2026-04-07.md`
- `plans/features/aletheia-calendar-leap-day-ui-eclipse-handoff-2026-04-07.md`

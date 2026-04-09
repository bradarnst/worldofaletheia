# Aletheia Calendar Rebaseline HLD and Code Handoff (2026-04-07)

## Status

- Status: Ready for implementation handoff
- Owner decision: Brad selected the revised civic Leap Day rule on 2026-04-07
- Related ADR: `plans/adrs/0017-civic-leap-day-weekday-participation-policy.md`

## Purpose

This handoff rebases the active calendar workstream around one newly locked rule:

- Leap Day remains outside month numbering, but it does participate in the weekday cycle.

This handoff now assumes ADR-0018 route migration into the Reference domain. The Leap Day rule must land after the Reference rehome begins but before richer calendar UI or eclipse enrichment, because it changes the core date/weekday model those features depend on.

## Ordered Delivery Sequence

### Step 1 - Reference domain and route rehome

Required first.

Deliver:
- Reference layout/navigation and `/references` landing page
- route move from `/calendar` to `/references/calendar`
- route move from `/timeline` to `/references/timeline`
- updated internal links, sitemap, canonicals, and tests

### Step 2 - Canon and engine rebase for Leap Day

Deliver:
- revised calendar arithmetic and weekday invariants
- updated docs/contracts/tests
- visible Leap Day placement metadata for UI consumers

### Step 3 - Calendar UI/UX uplift

Deliver:
- explicit previous/next controls for month/week/year navigation
- tiny moon phase icons instead of text-only abbreviations
- selected-day detail as a first-class agenda-style surface
- events shown by density: light in month, richer in week, full in day detail
- visible Leap Day treatment in month, week, and year views

### Step 4 - Eclipse schedule enrichment

Deliver:
- deterministic eclipse-season and eclipse-date computation
- a fractional continuous day-number layer for eclipse timing tied to the canonical civil calendar
- calendar/API rendering of computed eclipses
- compact eclipse UI with always-on markers, a small legend, and selected-date/view summaries
- no map path/coverage logic yet

### Step 5 - Calendar interaction and agenda modes (future tranche)

Deliver:
- stronger selection model across day/week/month/year surfaces
- explicit secondary navigation actions for opening deeper detail
- separate agenda views for day, week, month, and year

### Step 6 - Deferred non-calendar work

Remote parity automation remains intentionally delayed and is not part of this handoff.

## Locked Decisions

1. Leap Day is intercalary, festival-linked, and monthless.
2. Leap Day is weekday-bearing and advances the weekly sequence.
3. Week view must treat Leap Day as a real week item, not a gap or side note.
4. Month view should render Leap Day as a distinct labeled interstitial marker anchored between the adjacent dated cells that bracket it; do not hide it in a legend, paint only half-cells, or invent a fake `day 32`.
5. Year view should annotate the containing month with an explicit Leap Day chip/summary rather than forcing Leap Day into the mini-grid as a numbered date.
6. Day detail is required; broader agenda modes are a later follow-on interaction step.
7. Moon phases should use small inline SVG icons, not just text abbreviations.
8. Do not surface `Monthless` as a visible UI label; keep Leap Day specialness legible through placement and intercalary/festival language instead.
9. Remove explanatory helper copy where the calendar view itself should communicate the model clearly.
10. Eclipses are computed astronomy/calendar data, not authored content entries.
11. The first eclipse tranche should not add a display toggle; eclipse markers are rare enough to stay always visible by default.
12. Use a compact header legend/key to explain eclipse markers rather than per-cell text labels.
13. Week view should keep eclipse treatment visually light; do not add extra badge text there if the icon/legend combination is sufficient.
14. Selected-date detail may state that a solar or lunar eclipse occurs on that date, while week/month/year surfaces may use compact summary text such as counts or occurrence notices.
15. Until path/coverage work lands, calendar wording must stay location-neutral: `solar eclipse occurs` / `lunar eclipse occurs`, not `visible here` or `total here`.
16. Eclipse geographic path/coverage is explicitly out of scope for this tranche.

## High-Level Design

### 1. Calendar engine changes

Primary implementation surface:
- `src/lib/aletheia-calendar.ts`
- `src/lib/aletheia-calendar.test.ts`

Required changes:
- Update weekday logic so the canonical weekday index is derived directly from `absDay`.
  - Old assumption: subtract Leap Days before taking `% 6`.
  - New rule: `weekdayIndex = absDay % 6`.
- Enrich Leap Day with weekday metadata.
  - `EnrichedLeapDayDate` should include `weekdayIndex` and `weekday`, matching month-date usability.
- Preserve Leap Day insertion point after Festival Day 3.
- Keep Leap Day monthless.
- Keep month lengths fixed at 31 numbered days.
- Preserve `absDay` as the single ordering/sorting key for calendar, timeline, and later eclipse work.

Recommended model additions:
- `CalendarDayData` for a selected day/detail view.
- explicit month-view Leap Day placement metadata, for example:
  - `leapDayPlacement.afterDate`
  - `leapDayPlacement.beforeDate`
  - `leapDayPlacement.weekday`
  - `leapDayPlacement.festivalPosition`
- week items widened from month-only dates to full `EnrichedAletheiaDate` support.

### 2. API contract changes

Primary implementation surface:
- `src/lib/aletheia-calendar-api.ts`
- `/api/calendar/*` route files
- `src/lib/aletheia-calendar-api.test.ts`

Required changes:
- Add a first-class day/detail payload.
  - Recommended endpoint: `/api/calendar/day?date=...`
- Update week payloads so Leap Day can appear as a normal returned item when the selected week contains it.
- Update month payloads to expose visible Leap Day placement metadata instead of only an out-of-band nullable summary.
- Update year payloads so the containing month exposes a Leap Day indicator/summary.
- Maintain deterministic canonical identifiers (`1105-Leapday`, month names, weekday names).

Recommended payload shape changes:
- week/day item includes `kind: 'month' | 'leapday'`
- day payload includes:
  - canonical date label
  - weekday
  - moon summary
  - festival summary
  - leap-day flag if applicable
  - projected lore events
  - future eclipse list
- optional follow-on endpoint if scope allows: `/api/calendar/date-shift?date=...&days=...`

### 3. Calendar UI/UX changes

Primary implementation surface:
- `src/pages/references/calendar/index.astro`
- `src/components/calendar/AletheiaMonthGrid.astro`
- new focused calendar components as needed

Required UI outcomes:
- Month view
  - compact day cells
  - tiny inline SVG moon icon in each cell
  - light event density (count or one title max)
  - clickable day selection
  - a distinct labeled Leap Day interstitial marker anchored between the adjacent dates before and after Leap Day
  - clear previous/next month controls placed in the view header
- Week view
  - six real week items, including Leap Day when present
  - Leap Day rendered with the same structural day card treatment as other days, using intercalary/festival language rather than a literal `Monthless` label
  - short event snippets
  - computed badges (festival, full moon, eclipse later)
  - clear previous/next week controls placed in the view header
- Year view
  - visible Leap Day chip/summary on the containing month card
  - no attempt to force Leap Day into the month mini-grid as a numbered cell
  - clear previous/next year controls placed in the view header
- Day detail
  - first-class agenda-style selected-day section
  - full lore event list for that day
  - computed details: weekday, moon, festival, Leap Day, eclipses later
  - Leap Day uses the same agenda/detail pattern as any other selectable day
  - avoid extra explanatory callout copy that repeats what the surrounding UI already makes clear

Recommended component additions:
- `src/components/calendar/MoonPhaseIcon.astro`
- `src/components/calendar/CalendarDayAgenda.astro`
- `src/components/calendar/CalendarLeapDayMarker.astro`

### 4. Event presentation model

Events are already available from lore normalization and projection.

Required presentation rule:
- month view: low-density indicator
- week view: medium-density snippet list
- day detail: full agenda/detail list

This keeps lore content visible without overloading the month grid.

### 5. Eclipse tranche design

Primary implementation surface later:
- `src/lib/aletheia-calendar.ts`
- `src/lib/aletheia-calendar-api.ts`
- `/references/calendar` UI detail components

Canonical constants for this tranche:
- tropical year `Y = 372.2` local days
- synodic month `S = 31.1` local days
- nodal precession `D = 6922.92` local days
- eclipse year `E = 353.3` local days
- eclipse season half-width `W = 17.5` local days
- anchor instant `day0 = date_to_daynum(0, 3, 21, 13, 47)`

Engine requirements:
- add a fractional continuous day-number layer for eclipse timing
- preserve the existing civil calendar as the source of month/day naming and Leap Day placement
- support negative years and leap years consistently in both forward and inverse conversions
- provide deterministic conversion helpers equivalent to:
  - `date_to_daynum(year, month, day, hour, minute)`
  - `daynum_to_date(daynum)`
- generate eclipse seasons by season index and derive solar/lunar candidates from the nearest syzygy points
- project the resulting peak instants back onto the civil calendar as day-level enrichments with optional time-of-day detail

Recommended data shape:
- per eclipse occurrence:
  - `kind` = `solar` | `lunar`
  - `peakDaynum`
  - `date`
  - `hour`
  - `minute`
  - `seasonIndex`
- per day/view summary:
  - `eclipses`
  - `eclipseCount`
  - `solarCount`
  - `lunarCount`

Required UI outcomes:
- Month view
  - very small eclipse markers in day cells
  - marker-only treatment, relying on the legend rather than text in the cell
- Week view
  - very small eclipse markers/icons only; avoid extra eclipse badge text in the default card treatment
- Year view
  - month-card eclipse summaries such as counts by kind
- Selected date / day detail
  - explicit notice when a solar or lunar eclipse occurs that day
  - optional peak time display if available from the generated occurrence
- Calendar header
  - a compact legend/key that indicates the calendar includes solar and lunar eclipse markers
- View summaries
  - week/month/year headers may include compact summary notices or counts when eclipses fall in the active range

Content wording constraints:
- use location-neutral language such as `solar eclipse occurs` and `lunar eclipse occurs`
- do not imply map-aware visibility, local path, or totality information in the calendar UI

Explicitly out of scope:
- map footprint
- regional visibility polygons
- totality path rendering
- place-aware eclipse filtering
- separate eclipse display toggles in the first tranche

## Recommended Implementation Order

1. Update docs/contracts and lock test expectations for the revised Leap Day rule.
2. Change core engine weekday logic and Leap Day enrichment.
3. Update week/month/year builders so Leap Day has explicit placement semantics.
4. Update API helpers and add day/detail payload.
5. Close out the UI tranche by removing implementation-note copy and non-canonical visible labels such as `Monthless`.
6. Update calendar UI components and Reference navigation.
7. Add eclipse schedule logic, compact marker UI, and summary/legend treatment only after the Leap Day and day-detail/UI work is stable.

## Validation Requirements

Required implementation checks:
- `pnpm test`
- `pnpm build`
- targeted tests for:
  - weekday progression across Leap Day
  - following-year weekday shift after leap years
  - week payloads containing Leap Day as a normal week item
  - month/year payloads exposing Leap Day placement metadata
  - selected-day/detail payloads for both month dates and Leap Day
  - deterministic solar/lunar eclipse generation from the canonical anchor and constants
  - negative-year eclipse generation consistency
  - day/view payloads exposing eclipse occurrences and summary counts

## Non-Goals

- No geographic eclipse pathing in this tranche.
- No new content collection for eclipses.
- No timeline mixing of computed eclipses by default.
- No service extraction or external astronomy library adoption.

## Eclipse Inputs Locked

The following canonical eclipse inputs are now supplied for Step 4:
- epoch anchor / first solar-eclipse instant: `date_to_daynum(0, 3, 21, 13, 47)`
- tropical year `Y = 372.2`
- synodic month `S = 31.1`
- nodal precession `D = 6922.92`
- eclipse year `E = 353.3`
- eclipse season half-width `W = 17.5`
- season-center / nearest-syzygy generation model described in this handoff

Still deferred:
- map path/coverage vector math
- local visibility phrasing in calendar UI
- any place-aware or atlas-aware eclipse rendering

# Civic Leap Day Weekday Participation Policy

## Status

- Date: 2026-04-07
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

The accepted Aletheia calendar implementation documents currently define Leap Day as an intercalary day inserted after Mid-Summer Festival Day 3 that belongs to neither a month nor the weekday cycle.

That rule is mathematically elegant, but active calendar UI design exposed a civic-usage problem: a public-facing calendar that ordinary people can read, teach, and display needs Leap Day to occupy a visually intelligible place in weekly rhythm. In-world, an administrative council designing a durable civic calendar for a population with mixed literacy would be unlikely to choose a rule that makes Leap Day hard to represent on wall calendars, market schedules, and festival planning aids.

The project therefore needs to lock a more plausible civic rule before additional calendar work proceeds, especially before richer `/references/calendar` UI and eclipse enrichment expand the implementation surface.

Related constraints remain in force:

- Astro-native, deterministic calendar math remains the implementation model.
- Calendar and timeline now sit within the Reference route family under ADR-0018.
- No new service/adapter/contract layer is justified by this change.

## Decision Drivers

- Preserve in-world plausibility for a publicly used civic calendar.
- Keep Leap Day visually legible in month, week, year, and printed-style calendar representations.
- Avoid rework before richer calendar UI and eclipse features land.
- Preserve simple deterministic calendar math.
- Keep Leap Day intercalary and festival-linked without forcing a fake month date number.

## Considered Options

### Option 1: Keep Leap Day outside both month and weekday cycle

Retain the current rule where Leap Day is inserted after Festival Day 3, belongs to no month, and does not advance the weekday sequence.

**Pros**

- Very tidy arithmetic for month-start stability across years.
- Matches earlier implementation assumptions.

**Cons**

- Hard to represent visually in public calendars.
- Weak fit for an in-world civic system intended for broad practical use.
- Forces extra UI workarounds around an implausible civic rule.

### Option 2: Keep Leap Day outside month numbering but inside the weekday cycle (Chosen)

Leap Day remains intercalary and festival-linked, but it receives the next weekday after Festival Day 3 and advances the weekly sequence normally.

**Pros**

- Much easier to render and teach visually.
- Stronger in-world civic plausibility.
- Preserves month lengths while giving Leap Day a real weekly position.
- Keeps arithmetic straightforward by letting weekday logic follow `absDay` directly.

**Cons**

- Loses the earlier invariant that leap years do not affect later weekday alignment.
- Requires engine/API/UI updates before further calendar work.

### Option 3: Fold Leap Day into normal month numbering

Make Leap Day a regular numbered date inside the containing month.

**Pros**

- Simplest visual representation.

**Cons**

- Weakens the special intercalary/festival identity of Leap Day.
- Changes month-length semantics in a way the project does not want.

## Decision Outcome

**Chosen option:** Option 2 - keep Leap Day outside month numbering but inside the weekday cycle.

### Policy

1. Leap Day remains an intercalary day inserted after Mid-Summer Festival Day 3.
2. Leap Day is not part of any month and does not receive a numbered month date.
3. Leap Day does participate in the weekday cycle and takes the next weekday after Festival Day 3.
4. Weekday calculation therefore follows the canonical absolute-day index directly; Leap Day is no longer excluded from weekday increment logic.
5. Leap years advance the weekday alignment of subsequent dates by one day.
6. Calendar UI and API contracts must render Leap Day as an explicit visible civic day, not as a hidden mathematical exception.

### Consequences

#### Positive

- Leap Day becomes legible in civic/public calendar representations.
- Calendar UX can show Leap Day in a way that matches the in-world rule rather than compensating for it.
- Eclipse and future astronomical enrichments can build on a more believable civil calendar.

#### Negative

- Existing engine assumptions, tests, and API payload shapes require revision.
- The previous “month starts stay aligned across leap years” simplification no longer holds.

#### Neutral

- Leap Day still remains festival-linked and intercalary.
- Reference route namespace and placement are now governed by ADR-0018; this Leap Day policy remains orthogonal to that IA decision.
- No new service boundary or collection model is introduced.

## Links

- `plans/adrs/0014-calendar-and-timeline-canon-utility-routes-and-lore-event-metadata-policy.md`
- `plans/features/aletheia_calendar_developer_handoff.md`
- `plans/features/aletheia-calendar-architecture-recommendation.md`
- `plans/features/aletheia-calendar-leap-day-ui-eclipse-handoff-2026-04-07.md`
- `plans/adrs/0018-reference-domain-and-references-route-namespace-policy.md`

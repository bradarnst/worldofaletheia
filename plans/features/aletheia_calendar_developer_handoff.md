
# Aletheia Calendar – Developer Hand-Off Specification

## Status

- Status: canonical implementation-facing spec for the settled calendar model
- Delivery state: Step 4 eclipse enrichment and Step 5 interaction/agenda decisions are implemented
- Priority tracking: use `.kilo/plans/1775545082688-jolly-meadow.md` for queue order; this document captures behavior, not sequencing

## Overview

The Calendar of Aletheia is a **solar civic calendar with a lunar-triggered festival**.  
It is designed to be:

- Easy to understand for readers and players
- Simple to compute programmatically
- Stable for contracts, records, and historical timelines
- Flexible enough to support regional cultural variation

This document describes the **complete specification** needed to implement a calendar engine and UI.

---

## 1. Core Calendar Constants

| Property | Value |
|---|---|
| Day length | 25 hours |
| Week length | 6 days |
| Months | 12 |
| Days per month | 31 |
| Normal year | 372 days |
| Leap year | 373 days |
| Leap rule | Every 5 years |
| Lunar cycle | ~31.1 days |
| Major festival | Mid‑Summer Festival |

---

## 2. Month Names (High Speech)

1. Brumalis
2. Gelidus
3. Vernalis
4. Amoris
5. Florentis
6. Solis
7. Aestivus
8. Fructoris
9. Aurelis
10. Ventorum
11. Umbrae
12. Silentium

Notes:

- These names derive from **High Speech**, a liturgical language related to Latin.
- They are used in **formal writing, contracts, and official records**.
- Local languages may translate or adapt them in everyday speech.

Example cultural association:

- **Amoris** is associated with a striking fruit called *Chamas do Amor* (“Flames of Love”) in some regions.

---

## 3. Week Structure

The week contains **six days**.

High Speech weekday names:

1. Primus
2. Secundus
3. Tertius
4. Quartus
5. Quintus
6. Deorum

Deorum is commonly associated with rest, temples, or social gatherings.

### Month / Week Interaction

Because months contain **31 days** and the week contains **6 days**:

- Each month contains **5 full weeks + 1 extra day**
- The **31st day falls on the same weekday as the 1st**
- Each new month begins **one weekday later** than the previous month

Example:

| Month | First Day |
|---|---|
| Brumalis | Primus |
| Gelidus | Secundus |
| Vernalis | Tertius |
| Amoris | Quartus |
| Florentis | Quintus |
| Solis | Deorum |
| Aestivus | Primus |

These month-start examples show the within-year cadence for a representative year that begins on Primus. Because Leap Day participates in the weekday cycle, the first day of the year after a leap year advances by one weekday.

---

## 4. Leap Year and Leap Day

The solar year is approximately **372.2 days**.

To correct this:

> One Leap Day is added every 5 years.

Leap year rule:

```
isLeapYear(year) = (year % 5 === 0)
```

### Leap Day Characteristics

Leap Day is special:

- Occurs **during the Mid‑Summer Festival**
- Inserted **after festival day 3**
- **Not part of any month**
- **Part of the weekday cycle**
- Takes the **next weekday after festival day 3**

Leap Day is intercalary, but it still occupies a real place in the public weekly rhythm.

This allows wall calendars, market schedules, and festival observances to represent it visually without inventing a fake numbered date.

As a result, Leap years **do shift the later weekday pattern of the calendar by one day**, and the first day of the year after a leap year begins one weekday later than the first day of the leap year.

---

## 5. The Moon

Aletheia has **one moon**.

Synodic period:

```
31.1 days
```

This is intentionally close to the **31‑day month**, creating gradual drift.

---

## 6. Lunar Phase Model

Use normalized phase values:

| Value | Meaning |
|---|---|
| 0.00 | New Moon |
| 0.25 | First Quarter |
| 0.50 | Full Moon |
| 0.75 | Last Quarter |

Phase calculation:

```
phase = (epochPhase + absDay / 31.1) mod 1
```
### Lunar Epoch

The lunar phase calculation uses a fixed epoch to ensure deterministic results.

Epoch definition:

Year 0  
Brumalis 1  
phase = 0.0 (New Moon)

This means the first day of the calendar begins with a new moon at midnight.

All subsequent lunar phases are derived from the absolute day index using the lunar period.

---

## 7. Phase Labels (UI)

| Range | Label |
|---|---|
0.00–0.06 | New Moon
0.06–0.19 | Waxing Crescent
0.19–0.31 | First Quarter
0.31–0.44 | Waxing Gibbous
0.44–0.56 | Full Moon
0.56–0.69 | Waning Gibbous
0.69–0.81 | Last Quarter
0.81–0.94 | Waning Crescent
0.94–1.00 | New Moon

---

## 8. Full Moon Detection

```
abs(phase − 0.5) < 0.02
```

This determines the civil full moon date used by the festival calculation.

---

## 9. Mid‑Summer Festival

Festival anchor:

### Solis Midpoint Definition

The midpoint of Solis is defined as the **start of Solis 16**.

The festival search begins on this day. The first civil date at or after this point that satisfies the full moon condition becomes **Festival Day 1**.

Festival duration:

Normal year:

```
Day 1
Day 2
Day 3
Day 4
Day 5
Day 6
```

Leap year:

```
Day 1
Day 2
Day 3
Leap Day
Day 4
Day 5
Day 6
```

Important:

- Festival days are **normal dated days**
- **Only Leap Day is outside the month**
- Leap Day still belongs to the **weekday cycle**

Only Leap Day lies outside the normal month structure.

The other festival days are ordinary calendar dates that retain their month and weekday designations but are culturally recognized as part of the festival period.

---

## 10. Absolute Day Index (The Elegant Trick)

Every day is represented internally as:

```
absDay
```

Epoch:

```
Year 0
Brumalis 1
absDay = 0
```

Advantages:

- easy date math
- easy sorting
- easy timeline generation
- trivial moon phase calculation
- trivial weekday calculation

---

## 11. Weekday Calculation

Because Leap Day does advance the week:

```
weekday = absDay % 6
```

Mapping:

| Value | Day |
|---|---|
0 | Primus
1 | Secundus
2 | Tertius
3 | Quartus
4 | Quintus
5 | Deorum

---

## 12. Canonical URL Format

Recommended query format:

```
/references/calendar?date=1105-Amoris-17
/references/calendar?date=1105-Solis-29
/references/calendar?date=1110-Leapday
```

Optional festival shortcuts:

```
/references/calendar?date=1105-Festival
/references/calendar?date=1105-Festival-2
/references/calendar?date=1110-Festival-Leapday
```

---

## Implementation addendum

For repository implementation, use `aletheia_date_end` as the event end field name (instead of `aletheia_end` in earlier drafts).

---

## 13. Event Ingestion (Obsidian Markdown)

Frontmatter example:

```yaml
aletheia_date: 1105-Amoris-17
aletheia_date_end: 1105-Amoris-19
tldr: Short event description
region: Northern Marches
tags: [history, war]
```

Rules:

- `aletheia_date` must resolve to a single day
- `aletheia_date_end` optional
- events normalize to:

```
startAbsDay
endAbsDay
durationDays
```

---

## 14. UI Requirements

### Month View

Display:

- 31 dated month cells
- 6 weekday columns
- tiny inline SVG lunar phase icons
- festival highlights
- visible labeled Leap Day interstitial marker anchored between the adjacent dates that bracket it
- light event density (count or a very small number of titles)
- very small eclipse markers when eclipses occur on a day
- previous/next month controls in the view header
- click/select interaction that opens day detail
- compact calendar legend/key indicating solar and lunar eclipse markers

### Week View

Display:

- 6 real weekday items, including Leap Day when it falls inside the selected week
- tiny inline SVG lunar phase icons
- Leap Day rendered as a normal week item/card with explicit intercalary/festival labeling
- festival and Leap Day indicators
- very small eclipse markers/icons without extra default badge text
- short event snippets
- previous/next week controls in the view header

### Day View

Display:

- weekday
- moon phase
- festival / Leap Day / eclipse indicators when applicable
- explicit notice when a solar or lunar eclipse occurs on the selected day
- full agenda-style event list for the selected day
- Leap Day uses the same agenda/detail interaction model as other selectable days
- previous/next day controls if a dedicated day mode is implemented

### Shared Interaction Requirements

- stronger selection model for day/week/month/year
- compact top panels that stay at current size or smaller, including removal of labels like `Reference Surface` and `Selected Date`
- slightly smaller selected-title treatment where needed to preserve compactness
- removal of redundant `Month View`, `Week View`, and `Year View` headings when context already shows the active view
- explicit secondary open/go-to actions distinct from primary selection
- overflow handled through an explicit modal/detail action rather than enlarging the summary panel
- day agenda mode
- removal of the always-visible bottom day-detail panel in favor of compact summary plus modal/detail and agenda views
- month agenda mode
- week agenda mode
- year agenda mode

### Timeline View

Chronological event list sorted by `absDay`.

### Eclipse UI Notes

- Eclipse markers are always on by default in the first tranche; no user toggle.
- Use a compact legend/key in the calendar header to explain solar and lunar eclipse markers.
- Calendar wording stays location-neutral: `solar eclipse occurs` / `lunar eclipse occurs`.
- Path, coverage, and map-based visibility belong to a later atlas/cartography step.

---

## 15. TypeScript Data Model (Zod)

```ts
import { z } from "zod";

export const MONTHS = [
"Brumalis","Gelidus","Vernalis","Amoris","Florentis","Solis",
"Aestivus","Fructoris","Aurelis","Ventorum","Umbrae","Silentium"
] as const;

export const WEEKDAYS = [
"Primus","Secundus","Tertius","Quartus","Quintus","Deorum"
] as const;

export const MonthNameSchema = z.enum(MONTHS);
export const WeekdayNameSchema = z.enum(WEEKDAYS);

export const MonthDateSchema = z.object({
kind: z.literal("MONTH_DATE"),
year: z.number().int(),
month: MonthNameSchema,
monthIndex: z.number().int().min(1).max(12),
day: z.number().int().min(1).max(31)
});

export const LeapDaySchema = z.object({
kind: z.literal("LEAP_DAY"),
year: z.number().int()
});

export const AletheiaDateSchema = z.discriminatedUnion("kind",[
MonthDateSchema,
LeapDaySchema
]);
```

---

## 16. Implementation Summary

The calendar engine must support:

1. Absolute day index
2. Month/day conversion
3. Weekday calculation (including Leap Day)
4. Leap year rule
5. Leap Day handling
6. Lunar phase calculation
7. Full moon detection
8. Festival determination
9. Event ingestion
10. Timeline sorting
11. Deterministic eclipse generation plus compact marker/legend summaries
12. Compact selection/detail and agenda modes across day/week/month/year

Once those are implemented, the rest of the UI becomes straightforward.

### Calendar Stability Guarantee

Because Leap Day lies outside the month system but remains inside the week system:

- month lengths never change
- each month still contains 31 dated days
- each new month still begins one weekday later than the previous month within a given year
- leap years advance the weekday alignment of subsequent dates by one day
- public calendars can render Leap Day as a visible intercalary civic day without inventing a fake numbered date

This design keeps date calculations simple while preserving civic legibility.

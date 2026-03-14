# Aletheia Calendar Architecture & Design Recommendation

## Status

- Date: 2026-03-05
- Author: Architect review
- Input spec reviewed: `plans/features/aletheia_calendar_developer_handoff.md`
- Scope: implementation architecture for calendar math + calendar UI + API contracts

## 1) Context Anchors From Existing Decisions

This recommendation is intentionally aligned with:

- Obsidian-first content flow in [`0001-obsidian-first-content-architecture.md`](plans/adrs/0001-obsidian-first-content-architecture.md)
- Astro-native, no-premature-abstraction policy in [`0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)
- Cloudflare-first deployment direction in [`0006-mailjet-email-for-auth-verification-and-contact-relay.md`](plans/adrs/0006-mailjet-email-for-auth-verification-and-contact-relay.md)
- Progressive interactivity expectations (Astro Islands) documented in [`AGENTS.md`](AGENTS.md)

Given those constraints, the calendar should start as an Astro-native feature with selective runtime endpoints, not as a standalone microservice.

---

## 2) Option Comparison: Astro-Only vs Split Service

### Option A — Entirely in Astro Site (recommended now)

- Core calendar engine in shared TypeScript modules
- Astro routes render pages + JSON API endpoints under same deployment
- Astro Islands provide interactive month/week/year UX

### Option B — Split Architecture (Astro UI + separate calendar API service)

- Astro handles rendering shell only
- Date math and lunar/festival logic moved to an external/internal API service
- Islands must call cross-service API for core operations

### Trade-off Matrix

| Dimension | Option A: Astro-native | Option B: Split service |
|---|---|---|
| Complexity | Lowest. One deployable, one runtime model. | Higher. Service contract/versioning, cross-service auth/network/error handling. |
| Performance | Excellent for static shell + low-latency same-origin API. Can cache JSON at edge. | Potentially good at scale, but baseline latency higher due to extra hop. |
| Maintainability | Strong for current team size. Logic stays near pages/routes and content model. | More moving parts and operational burden (separate logs, alerts, release cadence). |
| Deployment | Simple: existing Astro + Cloudflare pipeline. | More complex: second deploy target, env management, rollback coordination. |
| Scalability | Adequate for current and near-term needs; can scale via CDN caching and edge runtime. | Better for multi-consumer or heavy compute loads, but overkill now. |
| Long-term extensibility | Good if engine is modular and API contracts are explicit. | Best when many clients or non-web consumers already exist. |

### Decision

Choose **Option A now**, with a **service-ready seam** at API-contract level. This follows YAGNI and existing ADR direction while keeping a clean migration path.

---

## 3) Recommended Target Architecture

```mermaid
flowchart TD
  A[Static Astro Calendar Page Shell] --> B[Astro Island: CalendarApp]
  B -->|fetch JSON| C[/api/calendar/* endpoints in Astro/Cloudflare]
  C --> D[Shared Calendar Engine TS]
  C --> E[Event Normalizer from content frontmatter]
  D --> F[Date math / moon phase / festival / view builders]
  E --> G[startAbsDay/endAbsDay indexed events]
```

### Runtime Boundaries

**Server-side (canonical):**

- Date parsing/validation for formats in [`aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md)
- Absolute-day conversion and inverse conversion
- Leap-day/week-cycle rules
- Moon phase and full-moon detection
- Festival anchoring logic
- Event normalization (`startAbsDay`, `endAbsDay`, `durationDays`)
- API shaping for month/week/year/day-diff responses

**Client-side (Astro Island):**

- UI state (selected view, selected date, next/prev navigation)
- Rendering grids/cards/tooltips/icons
- Fetching from same-origin API and local memoization
- Optional optimistic prefetch (adjacent month/week)

### Why this split

- Keeps **one source of truth** for rules (server engine), avoiding client/server drift.
- Preserves static-first performance with a light island.
- Avoids duplicating complex edge-case logic in browser and server.

---

## 4) Calendar Math Strategy (Library vs Custom vs Service)

## Recommendation

Implement Aletheia calendar math **directly in project code** (custom deterministic engine), not via third-party astronomy/date libraries for v1.

### Rationale

- Calendar is fictional with bespoke rules (25-hour day, 6-day week, leap-day excluded from week cycle).
- Given spec already defines formulas, custom implementation is straightforward and testable.
- External libraries mostly target Gregorian/astronomical calendars and add mismatch risk.

### Data Accuracy Expectation

- Treat lunar output as **civil/canonical** accuracy per authored formula in [`aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md), not astrophysical ephemeris accuracy.
- Publish this as a documented product constraint.

### Eclipse phase implication

For eclipse phase, keep same API facade and add a pluggable computation module behind it:

- v1: rule-based approximation (if acceptable for lore gameplay)
- v2: higher-fidelity astronomical backend (library or dedicated service) only if required by product quality goals

---

## 5) API Design (JSON) — Practical Contract

All endpoints should return predictable JSON envelopes:

```json
{
  "ok": true,
  "version": "v1",
  "data": {},
  "meta": {
    "calendarSystem": "aletheia-civil",
    "epoch": "0000-Brumalis-1"
  }
}
```

`computedAt` is optional and should be included only for runtime-produced responses where cache/debug freshness matters. It is not required for deterministic calendar math.

### 5.1 Month View

`GET /api/calendar/month?year=1105&month=Amoris&tz=UTC&locale=en`

```json
{
  "ok": true,
  "version": "v1",
  "data": {
    "view": "month",
    "year": 1105,
    "month": "Amoris",
    "monthIndex": 4,
    "days": [
      {
        "date": "1105-Amoris-1",
        "absDay": 411061,
        "weekday": "Quartus",
        "weekdayIndex": 3,
        "moon": { "phase": 0.47, "label": "Full Moon", "isFullMoon": true },
        "festival": null,
        "events": [{ "id": "war-of-ashes", "title": "War of Ashes begins" }]
      }
    ],
    "weekdayColumns": ["Primus", "Secundus", "Tertius", "Quartus", "Quintus", "Deorum"],
    "monthLength": 31
  },
  "meta": {
    "tz": "UTC",
    "locale": "en",
    "calendarSystem": "aletheia-civil"
  }
}
```

### 5.2 Week View

`GET /api/calendar/week?date=1105-Amoris-17&tz=UTC&locale=en`

```json
{
  "ok": true,
  "version": "v1",
  "data": {
    "view": "week",
    "anchorDate": "1105-Amoris-17",
    "weekdays": [
      { "date": "1105-Amoris-13", "weekday": "Primus", "absDay": 411073, "moon": { "label": "Waning Gibbous" }, "events": [] },
      { "date": "1105-Amoris-14", "weekday": "Secundus", "absDay": 411074, "moon": { "label": "Last Quarter" }, "events": [] }
    ]
  },
  "meta": { "tz": "UTC", "locale": "en" }
}
```

### 5.3 Year View

`GET /api/calendar/year?year=1105&tz=UTC&locale=en`

```json
{
  "ok": true,
  "version": "v1",
  "data": {
    "view": "year",
    "year": 1105,
    "isLeapYear": true,
    "months": [
      { "month": "Brumalis", "monthIndex": 1, "startWeekday": "Primus", "fullMoonDates": ["1105-Brumalis-2"] }
    ],
    "festival": {
      "anchor": "first-full-moon-after-midpoint-of-solis",
      "days": [
        "1105-Solis-20",
        "1105-Solis-21",
        "1105-Solis-22",
        "1105-Leapday",
        "1105-Solis-23",
        "1105-Solis-24",
        "1105-Solis-25"
      ]
    }
  },
  "meta": { "tz": "UTC", "locale": "en" }
}
```

### 5.4 Moon Phase Lookup

`GET /api/calendar/moon-phase?date=1105-Solis-29`

```json
{
  "ok": true,
  "version": "v1",
  "data": {
    "date": "1105-Solis-29",
    "absDay": 411240,
    "phase": 0.5032,
    "label": "Full Moon",
    "isFullMoon": true
  },
  "meta": { "model": "civil-31.1", "tolerance": 0.02 }
}
```

### 5.5 Date Difference

`GET /api/calendar/date-diff?from=1105-Amoris-17&to=1105-Solis-29&mode=exclusive`

```json
{
  "ok": true,
  "version": "v1",
  "data": {
    "from": { "date": "1105-Amoris-17", "absDay": 411077 },
    "to": { "date": "1105-Solis-29", "absDay": 411240 },
    "differenceDays": 163,
    "mode": "exclusive"
  }
}
```

---

## 6) Timezone, Locale, DST, and Edge-Case Policy

### Timezone handling

- Core Aletheia math should be timezone-agnostic and operate on **calendar days**, not wall-clock timestamps.
- API accepts `tz` for interoperability and deterministic formatting only.
- Default `tz` should be `UTC` for reproducibility.

### Locale/i18n

- Keep canonical serialized identifiers in High Speech (stable API keys).
- Localized display labels are presentation-layer concerns (island/UI dictionary).
- API may include optional localized labels when `locale` is provided, but must retain canonical keys.

### DST boundaries

- DST is irrelevant for native Aletheia date arithmetic.
- For imported Gregorian timestamps, normalize once (ingestion) into an absolute Aletheia day in canonical timezone to avoid DST drift.

### Leap years and leap day

- Enforce leap rule `year % 5 === 0` exactly.
- Leap Day is valid only in leap years.
- Leap Day excluded from weekday increment logic.
- Validate and reject invalid combinations (`1106-Leapday`, `day=32`, unknown month).

---

## 6.1) Clarification: Is `computedAt` Needed?

Assumption validated for core math/display in this project context.

- The calendar engine is deterministic from inputs + constants in [`aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md).
- If you are not comparing against Earth time and not depending on “current now” semantics, `computedAt` adds no computational value.
- For fully static outputs (build-time generated pages/data), omit `computedAt` by default.

`computedAt` remains useful only in narrow operational cases:

1. Runtime API diagnostics (confirm which generation moment produced payload)
2. Cache observability (debug stale edge responses)
3. Incident forensics (correlate payload with logs/releases)

So: **not required for correctness**, only optional for operations.

---

## 7) Astro Islands Strategy (Static Performance + Interactivity)

Use an **island for interaction only**, not for full app shell hydration.

1. Server-render static calendar page chrome and SEO text.
2. Hydrate only the calendar viewport component (controls + grid + event popovers).
3. Island fetches JSON contracts from same-origin API.
4. Cache API responses at edge where safe (`Cache-Control` by view granularity).

This keeps payloads small and preserves static-first behavior while enabling dynamic navigation.

---

## 8) Timeline Support (Required, Phase After MVP)

Timeline support should be implemented as a required second phase, with static output and no runtime dependency.

### Collection and computation model

1. Events are authored in markdown frontmatter (`aletheia_date`, optional `aletheia_end`) as defined in [`aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md).
2. During Astro build, collect relevant entries via content collections.
3. Pass event dates through the same calendar engine used by API/page logic.
4. Normalize each event to canonical fields:
   - `startAbsDay`
   - `endAbsDay`
   - `durationDays`
5. Generate static timeline and calendar data artifacts (or direct static page props) sorted/indexed by `absDay`.

### Static guarantee

- Timeline rendering remains SSR/build-time generated.
- No external API/service is required to render timeline pages.
- Optional islands can enhance filtering/sorting UX client-side, but source data is static and precomputed.

---

## 9) Recommended MVP vs Phase 2 Plan (No Major Rewrites Later)

### MVP (Phase 1) — Calendar engine + calendar views

Scope:

- Canonical calendar engine (date conversion, leap logic, weekday, moon phase, festival)
- Calendar page + month/week/year rendering contracts
- Astro island interactivity for navigating views
- Same-origin endpoints optional for interactive fetch, but no external service

Architecture boundary:

- Core engine remains pure/shared.
- UI consumes engine output (direct SSR props and/or same-origin JSON).
- Keep contract fields stable for forward compatibility with timeline.

Data contract implication:

- Include canonical date and `absDay` in all view payloads.
- Keep `meta` minimal and deterministic; `computedAt` optional.

### Phase 2 (Required) — Event ingestion + static timeline

Scope:

- Ingest markdown events from content collections.
- Normalize to `startAbsDay`/`endAbsDay`/`durationDays` via engine.
- Build static timeline views and enrich month/week/year cells with event projections.

Architecture boundary:

- Event ingestion and normalization run build-time only.
- Calendar engine remains single source of truth for all date math.
- No runtime dependency introduced for timeline correctness.

Data contract implication:

- Introduce event payload shape shared by timeline and calendar views:

```json
{
  "id": "war-of-ashes",
  "title": "War of Ashes begins",
  "startDate": "1105-Amoris-17",
  "endDate": "1105-Amoris-19",
  "startAbsDay": 411077,
  "endAbsDay": 411079,
  "durationDays": 3,
  "tags": ["history", "war"],
  "region": "Northern Marches"
}
```

Future extensibility:

- This structure supports later eclipse overlays and additional astronomical annotations without changing timeline fundamentals.

---

## 10) Phased Evolution Plan (including Eclipse Future)

### Phase 0 — Contracts and invariants

- Finalize date grammar and error codes.
- Freeze `v1` JSON contract envelope and endpoint set.

### Phase 1 — Core engine (pure functions)

- Implement absolute-day conversion both directions.
- Implement weekday calculation excluding leap day.
- Implement lunar phase + labels + full-moon tolerance.
- Implement festival determination.
- Add comprehensive unit tests for boundary years/dates.

### Phase 2 — API routes in Astro

- Expose month/week/year/moon-phase/date-diff endpoints.
- Integrate event normalization for frontmatter fields.
- Add caching headers and input validation.

### Phase 3 — Calendar island + views

- Month view first, then week and year.
- URL sync (`/calendar?date=...&view=month|week|year`).
- Add keyboard navigation and loading/error states.

### Phase 4 — Content integration + timeline

- Ingest events from markdown frontmatter.
- Render timeline sorted by `absDay`.
- Add festival and moon visual indicators.

---

## 9) Phased Evolution Plan (including Eclipse Future)

### Must change now

- Implement single canonical engine + API contracts in Astro runtime.
- Keep rules deterministic and fully test-covered.

### Should change soon

- Add contract tests for API payload stability.
- Implement required static timeline ingestion/rendering phase.
- Add event indexing strategy if event volume grows.

### Consider for future

- Eclipse model module behind existing API facade.
- Only introduce separate calendar service if one or more triggers are met:
  1. Non-web consumers require independent SLA/versioning
  2. Computation load exceeds practical edge-route limits
  3. Astronomy fidelity requirements exceed in-app maintainability

---

## 11) Final Recommendation

Implement the calendar as an **Astro-native feature with canonical shared math engine + static-first Astro rendering + island interactivity only where needed**.

Then implement timeline support as a **required Phase 2 build-time ingestion layer** from markdown events, keeping timeline/calendar outputs fully static and deterministic.

This preserves low complexity today, avoids premature service extraction, and keeps a clean contract seam for future eclipse modeling or multi-consumer API evolution.

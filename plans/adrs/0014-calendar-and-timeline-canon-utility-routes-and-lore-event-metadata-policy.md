# Calendar and Timeline Canon Utility Routes and Lore Event Metadata Policy

## Status

- Date: 2026-03-26
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

The calendar and timeline are in-world chronology tools, but they are also practical play aids for players and GMs.

Before implementation, route placement and metadata scope must be locked so the same model is used consistently across:

- page routing and navigation,
- content schemas and authoring patterns,
- timeline rendering,
- and future date-math endpoint contracts.

Current architecture constraints remain in force:

- Astro-native, static-first defaults.
- No speculative service/adaptor/contract layering unless ADR-0004 triggers are met.
- Canon remains a static domain.

## Decision Drivers

- Keep chronology features aligned with world-canon presentation.
- Preserve low-complexity Astro-native implementation path.
- Avoid schema sprawl across unrelated collections.
- Support both lore readability and game-table usability.
- Keep calendar and timeline data contract deterministic and shared.
- Keep future API seam clear without blocking page delivery.

## Considered Options

### Option 1: Place calendar/timeline in Campaigns domain

Treat both surfaces primarily as campaign tooling under `/campaigns/**`.

**Pros**

- Directly framed as game utility.

**Cons**

- Weakens in-world canon framing.
- Couples shared world chronology to campaign-specific IA.

### Option 2: Canon utility pages plus Lore-scoped event metadata (Chosen)

Place utility routes at site level (`/calendar`, `/timeline`) and treat them as Canon-facing chronology tools, with event metadata introduced in `lore` only.

**Pros**

- Matches in-world chronology intent.
- Preserves simple routing and navigation behavior.
- Limits schema blast radius while enabling timeline/calendar projection.

**Cons**

- Requires careful Lore taxonomy definition for `event` entries.

### Option 3: Introduce dedicated calendar/events collections now

Create new collection families for calendar artifacts and events in MVP.

**Pros**

- Strong separation by content type.

**Cons**

- Adds immediate schema and authoring complexity.
- Unnecessary for initial timeline scope.

## Decision Outcome

**Chosen option:** Option 2 - Canon utility pages plus Lore-scoped event metadata.

### Policy

1. Calendar and timeline ship as utility pages, not collections.
   - Routes: `/calendar` and `/timeline`.
2. Canon navigation includes direct links to Calendar and Timeline.
3. Calendar query handling accepts month as either:
   - High Speech month name, or
   - numeric month (`1`-`12`).
4. Date-math endpoints remain a near-term follow-on under `/api/calendar/*`.
5. Event metadata for MVP is scoped to Lore entries only.
   - `lore.type` includes `event`.
   - `aletheia_date` required for event entries.
   - `aletheia_date_end` optional.
6. MVP event shapes are limited to:
   - single-day (`aletheia_date`),
   - ranged (`aletheia_date` + `aletheia_date_end`).
7. Timeline MVP is a vertical chronological list with scroll interaction only.
   - No zoom.
   - No pan.
8. Calendar and timeline use shared normalized day indexing (`absDay`) for event projection.
9. PDF/JPEG export is deferred out of MVP.

### Consequences

#### Positive

- Clear implementation target before coding starts.
- Consistent route and metadata semantics across calendar and timeline.
- Reduced risk of cross-collection schema churn.

#### Negative

- Event authoring discipline is required in Lore taxonomy.
- Timeline UX remains intentionally minimal in MVP.

#### Neutral

- Does not require new service layers.
- Does not change Obsidian-first source-of-truth flow.
- Does not require immediate client framework adoption.

## Links

- `plans/features/aletheia-calendar-mvp-decisions-addendum-2026-03-26.md`
- `plans/features/aletheia-calendar-architecture-recommendation.md`
- `plans/features/aletheia_calendar_developer_handoff.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/adrs/0007-astro-islands-vanilla-typescript-first-policy.md`

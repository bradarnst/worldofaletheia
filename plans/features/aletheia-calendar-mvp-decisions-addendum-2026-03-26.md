# Aletheia Calendar MVP Decisions Addendum (2026-03-26)

## Status

- Date: 2026-03-26
- Status: Accepted decisions lock
- Scope: Route placement, metadata contract, MVP interaction boundaries
- Related docs:
  - `plans/features/aletheia-calendar-architecture-recommendation.md`
  - `plans/features/aletheia_calendar_developer_handoff.md`
  - `plans/adrs/0007-astro-islands-vanilla-typescript-first-policy.md`

## Purpose

This addendum freezes implementation-critical choices before coding starts, so page routing, event metadata, and timeline behavior remain consistent across schema, routing, and UI work.

## Locked Decisions

1. Calendar and timeline are Reference surfaces, not content collections.
   - Routes: `/references/calendar` and `/references/timeline`
   - Both pages remain Astro server-rendered for MVP.

2. Global navigation should link to the Reference layer, not expose Calendar and Timeline as separate one-off primary links.
   - Canon navigation remains collection-focused.

3. Calendar URL/query contract supports both month naming styles.
   - Month can be provided as High Speech month name (`Amoris`) or numeric month (`1`-`12`).
   - Server normalizes both forms to canonical month identity.

4. Date-math APIs remain planned and immediate follow-on work.
   - Keep `/api/calendar/*` endpoint set as previously recommended.
   - Calendar/timeline page rollout is allowed to begin before full API surface is complete.

5. Event metadata is scoped to Lore collection only for MVP.
   - Add `event` to `lore.type` taxonomy.
   - Use `aletheia_date` (start, required for event entries).
   - Use `aletheia_date_end` (end, optional).
   - Naming uses explicit `date` token to avoid ambiguity.

6. Only two event shapes are supported in MVP.
   - Single-day event: `aletheia_date` only.
   - Ranged event: `aletheia_date` + `aletheia_date_end`.

7. Timeline MVP is a simple vertical chronological list.
   - No zoom.
   - No pan.
   - Scroll is the primary interaction model.

8. Calendar and timeline share one date normalization model.
   - Event projection for both surfaces must be driven by normalized absolute-day indexing (`absDay`).

9. Export formats are deferred.
   - PDF/JPEG export is out of MVP scope.

## Non-Goals in This Lock

- No new calendar content collection is introduced.
- No service/adaptor/contract layer is introduced for calendar logic.
- No framework adoption is introduced for calendar MVP beyond accepted Astro + vanilla TypeScript island policy.

## Implementation Notes

- This addendum intentionally narrows ambiguity around field naming and route placement. Route namespace is now aligned with ADR-0018.
- Broader chronology tooling (zoomable timelines, visual bands, export renderers) remains valid future work after MVP calendar and vertical timeline are stable.

# Current Priorities Status - 2026-05-23

## Status

- Date: 2026-05-23
- Purpose: planning cleanup after inventory review
- Scope: documentation/status alignment only

## Current sprint order

1. ADR-0021 external admin capability boundary
2. planning/todo cleanup to align with that boundary
3. engineering baseline quick wins
   - minimal CI lane using `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`
   - TypeScript baseline triage using `pnpm exec tsc --noEmit`
4. reassess whether Search S2 or Sorcerer spell-list UX is the next implementation slice

## Current state summary

- Admin capability boundary has moved external by default. Privileged admin consoles, dashboards, taxonomy-management UIs, and similar CRUD/operator surfaces belong in `woa-admin` or a related external project unless a later ADR explicitly changes that boundary.
- Site-wide search docs had drifted. Current evidence suggests S1 and S3 are complete or nearly complete, while S2 remains pending.
- Sorcerer Spells public API consumption has already started in this repo. The still-open work in this repo is visitor-side spell-list UX, while richer spell CRUD and richer spell FTS stay external by default.
- Incremental related-resource enrichment remains an in-repo concern because this site still owns how promoted and related resources are consumed and rendered.
- Campaign image variants are backlog, not this sprint.
- Staging/production parity scripts are backlog, not this sprint.

## Notes for the next implementation slice

- Keep the first slice documentation-first.
- Do not reopen S1 or S3 search work unless verification finds a concrete gap.
- Do not convert the taxonomy-management requirement into an in-repo admin-console feature.
- Use Sorcerer Spells as the precedent for external authority plus public-site consumption.

## Related files

- `plans/adrs/0021-external-admin-capability-boundary.md`
- `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`
- `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`
- `plans/features/site-wide-search-architecture-and-fts5-delivery-plan-2026-04-17.md`
- `plans/sorcerer-spell-list-client-ux-plan-2026-05-08.md`

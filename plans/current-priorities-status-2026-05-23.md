# Current Priorities Status - 2026-05-23

## Status

- Date: 2026-05-23
- Purpose: planning cleanup after inventory review
- Scope: documentation/status alignment only

## Historical sprint order

1. ADR-0021 external admin capability boundary
2. planning/todo cleanup to align with that boundary
3. engineering baseline quick wins
   - minimal CI lane using `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`
   - TypeScript baseline triage using `pnpm exec tsc --noEmit`
4. reassess whether Search S2 or Sorcerer spell-list UX is the next implementation slice

## 2026-06-17 status update

- Search S2 is done or good enough for now. Do not treat Search S2 as the next active implementation slice unless a fresh issue identifies a concrete user-facing gap.
- Sorcerer spell-list UX is no longer the active next slice; the public site now has front-end spell-list consumption/display behavior.
- Campaign member add/update/revoke behavior is external API behavior. This repo owns the front-end client and display states that call those endpoints, not endpoint business logic.
- Spell data, spell types, spell counts, and spell API contract behavior are external. This repo owns only front-end consumption and presentation decisions.
- The remaining in-repo next-step candidate from this cleanup is breadcrumb verification/restoration, because that is a front-end/navigation concern.

## Current state summary

- Admin capability boundary has moved external. Privileged admin consoles, dashboards, taxonomy-management UIs, and similar CRUD/operator surfaces belong in `woa-admin` or a related external project unless a later ADR explicitly changes that boundary.
- Site-wide search is done or good enough for now; keep the architecture plan as reference rather than active pipeline work.
- Sorcerer Spells public API consumption is front-end-only in this repo. Visitor-side display/list behavior belongs here; spell CRUD, spell types, spell counts, spell ordering authority, and richer spell FTS stay external.
- Incremental related-resource enrichment is future work, not next work. This site may own future promoted-resource rendering, but external spell/search authority remains external.
- Campaign image variants are backlog, not this sprint.
- Staging/production parity scripts are backlog, not this sprint.

## Notes for the next implementation slice

- Keep the first slice documentation-first.
- Do not reopen S1 or S3 search work unless verification finds a concrete gap.
- Do not convert the taxonomy-management requirement into an in-repo admin-console feature; it is external admin/operator work.
- Use Sorcerer Spells as the precedent for external authority plus public-site consumption and display only.

## Related files

- `plans/adrs/0021-external-admin-capability-boundary.md`
- `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`
- `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`
- `plans/features/site-wide-search-architecture-and-fts5-delivery-plan-2026-04-17.md`
- `plans/sorcerer-spell-list-client-ux-plan-2026-05-08.md`

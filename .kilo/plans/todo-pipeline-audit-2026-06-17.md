# Todo Pipeline Audit - 2026-06-17

## Scope

Read-only audit for explicit todos, tasks, follow-ups, and pipeline items in the repository.

Sources checked:

- `plans/todos/index.md`
- `plans/current-priorities-status-2026-05-23.md`
- active/proposed plans under `plans/`
- recent handoff plans under `.kilo/plans/`
- source-code markers for `TODO`, `FIXME`, `HACK`, `XXX`, and `TBD`
- quick code-presence checks for recent handoff plans that may already be implemented

## Summary

After user review, the audit should be interpreted with these corrections:

1. Site-wide Search S2 is done or good enough for now. It should not remain listed as an active next implementation slice.
2. Campaign member add/update/revoke behavior is external API behavior. This repo owns only the front-end calls and display integration. The absence of local `src/pages/api/v1/campaigns/**` routes is expected, not an in-repo backend gap.
3. Breadcrumb restoration/verification can be part of near-term next steps because it is a front-end/navigation concern in this repo.
4. Related-resource enrichment and spell discovery is a future todo, not a next task.
5. Taxonomy management is 100% external admin/operator work. Docs should make this unambiguous.
6. Spell, spell-type, spell-count, and spell API contract behavior is external. This repo may only own front-end display concerns such as whether and how external spell types are sorted for presentation.
7. The source-code spell-count TODO is not an in-repo backend task. It should be treated as an external API enhancement trigger plus a small future front-end cleanup if that external capability appears.

Net result: the current in-repo pipeline is mostly documentation/status cleanup plus optional breadcrumb verification. External API/backend work should be clearly moved out of this repo's task pipeline.

## Explicit Open Todos

From `plans/todos/index.md`:

- `plans/todos/breadcrumb-restoration-navigation-ux-2026-05-08.md`
  - Status: Open
  - Priority: Medium
  - Requirement: restore/verify breadcrumbs on applicable article/detail pages where `parentChain` exists.
  - Code signal: `ArticleContextHeader.astro`, `WorldAletheiaContentHeader.astro`, and `WorldAletheiaContentLayout.astro` already pass/render breadcrumb data, so this may be partially implemented or a data/page coverage issue.

- `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`
  - Status: Open
  - Priority: Medium
  - Requirement: future privileged taxonomy management for content type values.
  - Boundary: 100% external admin/operator project work. Do not implement taxonomy management in this public-site repo unless a later ADR explicitly changes ownership.

- `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`
  - Status: Open
  - Priority: Low
  - Requirement: future related-resource enrichment and discovery pipeline for high-utility front-end surfaces.
  - Boundary: spell data, spell types, spell counts, and spell search authority are external. This repo may consume and display approved external spell surfaces only.
  - Suggested rollout: manual UX probe, resource registry and generated artifact, incremental enrichment workflow, then external spell search/discovery integration.

## Current Priorities Document

`plans/current-priorities-status-2026-05-23.md` says the current sprint order was:

1. ADR-0021 external admin capability boundary.
2. Planning/todo cleanup aligned with that boundary.
3. Engineering baseline quick wins: minimal CI lane and TypeScript baseline triage.
4. Reassess whether Search S2 or Sorcerer spell-list UX is the next implementation slice.

Current code signals indicate Sorcerer spell-list UX has likely been implemented since that status note: there is a saved spell-list page, localStorage storage utilities, client script, add/remove controls, and tests.

User correction: Search S2 is done or good enough for now. The current-priorities document should be updated or superseded so it no longer points to Search S2 as the next in-repo implementation slice.

## Active or Proposed Plans

- `plans/features/site-wide-search-architecture-and-fts5-delivery-plan-2026-04-17.md`
  - Status: reference plan; implemented/good enough for now as of 2026-06-17.
  - Current status note: S1, S3, and S2 should not be treated as active pipeline work unless a fresh issue identifies a concrete user-facing gap.

- `plans/self-service-forgot-password-implementation-plan-2026-06-02.md`
- `plans/self-service-forgot-password-hld-2026-06-02.md`
- `plans/password-recovery-and-account-password-ux-hld-2026-06-02.md`
  - Status: Proposed in metadata, but current source includes `forgot-password.astro`, `reset-password.astro`, and account password-change UI. Treat these as potentially stale until verified against the exact acceptance criteria.

## Recent `.kilo/plans/` Handoff Items

- `.kilo/plans/main-site-campaign-api-front-end-refactor-plan.md`
  - Status: Ready for Code handoff.
  - Code signal: a front-end campaign API client exists at `src/utils/campaign-management-api-client.ts`, and `src/pages/campaigns/[campaign]/admin.astro` consumes it.
  - User correction: these are external API calls. Update docs/plans to say this repo owns only front-end integration and should not implement campaign member mutation endpoints.

- `.kilo/plans/campaign-member-role-update-implementation-plan.md`
  - Code signal: the front-end client and UI include `updateCampaignMember()` using `PUT`.
  - User correction: the endpoint is external API behavior. This should be converted from an in-repo implementation plan into external API ownership/handoff documentation, or marked superseded by the front-end-only integration boundary.

- `.kilo/plans/remove-email-canonical-refactor-plan.md`
  - Code signal: migration `migrations/0013_drop_email_canonical.sql`, migration runner updates, tests, and skill guidance indicate this has largely been implemented.
  - Remaining mentions are mostly historical plans/docs/tests or the plan itself. Active guidance should still be reviewed before relying on old `email_canonical` references.

- `.kilo/plans/campaign-admin-better-auth-gate-fix-plan.md`
  - Code signal: current campaign admin page gates UI through the campaign-management API capability call and uses Better Auth/campaign membership semantics indirectly.
  - Treat as likely implemented or superseded by the front-end refactor, pending exact access-state verification.

- `.kilo/plans/preserve-public-spell-type-order.md`
  - Code signal: active spell type results from `listSpellTypes()` are assigned directly in checked pages; `sortSpellTypeLabels()` remains applied only to source spell types.
  - User correction: spell types and spell ordering authority are external. This should not be tracked as an in-repo backend/data task. Only front-end display sorting belongs here, if a user-facing display order tweak is actually needed.

## Source-Code Todo Markers

Only one direct source `TODO` marker was found:

- `src/pages/systems/gurps/resources/sorcerer-spells/index.astro:26`
  - Current workaround: query `listSpells({ page: 1, pageSize: 1 })` only to get `total`.
  - User correction: the count endpoint/capability is external API work. This repo should not track it as an in-repo code task except for a small future front-end cleanup if the external API later exposes a better count mechanism.

No `FIXME`, `HACK`, `XXX`, or `TBD` source markers were found under `src/`.

## Suggested Next Pipeline Order

1. Verify breadcrumb behavior on real content pages with `parentChain`; either close the todo or turn it into a narrowly scoped front-end/navigation next step.
2. Leave related-resource enrichment and spell discovery as future work, not next work.
3. Keep campaign member endpoints, taxonomy management, and spell API/backend behavior out of the in-repo pipeline unless a later ADR explicitly changes ownership.

## Completed Documentation Updates

Implemented after leaving plan mode:

1. `plans/current-priorities-status-2026-05-23.md`
   - Marked Search S2 as done/good enough for now.
   - Removed Search S2 and Sorcerer spell-list UX from active next-slice status.
   - Clarified external ownership for campaign member endpoints and spell API/backend behavior.

2. `plans/features/site-wide-search-architecture-and-fts5-delivery-plan-2026-04-17.md`
   - Changed status language from active/pending to reference/good-enough.
   - Preserved architecture notes while avoiding active S2 pipeline language.

3. `.kilo/plans/main-site-campaign-api-front-end-refactor-plan.md`
   - Stated prominently that `/api/v1/campaigns/**` member-management endpoints are external API calls.
   - Stated that this repo owns only the front-end API client, page behavior, and display states.
   - Removed language that treats missing local route files as a risk or gap.

4. `.kilo/plans/campaign-member-role-update-implementation-plan.md`
   - Replaced the in-repo implementation plan with external API ownership/handoff documentation.
   - Removed instructions to implement local route files in this repo.

5. `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`
   - Strengthened language to external under the current boundary.
   - Kept it as an external-admin requirement, not an in-repo implementation task.

6. `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`
   - Kept as future todo only.
   - Clarified that spell data, spell types, spell counts, and spell search authority are external; this repo only consumes approved front-end-facing data/API surfaces.

7. `.kilo/plans/preserve-public-spell-type-order.md`
   - Marked as complete/front-end-display-only.
   - Clarified that spell type canonical ordering is external. This repo may choose display sorting only where presentation explicitly requires it.

8. `src/pages/systems/gurps/resources/sorcerer-spells/index.astro`
   - Reworded the former TODO so it is clearly an external API enhancement trigger, not an in-repo backend task.

9. `.kilo/plans/campaign-management-ux-next-steps-plan.md`
   - Replaced stale local API implementation guidance with front-end-only UX guidance and external API ownership.

10. `plans/todos/index.md`
   - Marked taxonomy management as `Open / External`.
   - Marked related-resource enrichment as `Open / Future`.

## Caveats

- This audit did not run tests or builds.
- This audit did not inspect Cloudflare routing configuration outside the repository.
- The working tree had one unrelated untracked directory: `.kilo/skills/grill-with-docs/`.

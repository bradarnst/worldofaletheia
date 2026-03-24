# World of Aletheia Status Report

- **Report date:** 2026-03-24
- **Generated at:** 2026-03-24T08:19:59+01:00
- **Repository branch:** `main`

## Executive Status

Project is in a strong post-foundation state: core architecture decisions are implemented, campaign privacy and auth boundaries are live, and discovery indexing has been remediated in staging and production. The highest-value remaining work is now concentrated in discovery UX contract closure, sync hardening semantics, and calendar roadmap execution.

## Current State (Implemented)

1. **Discovery index remediation is complete**
   - `content_index` exists and is populated in staging and production.
   - Verified row count after remediation: 77 rows per environment.
   - Reference: `plans/content-index-p0-root-cause-2026-03-24.md`.

2. **Cloud-backed content mode and runtime contracts are in place**
   - Source mode resolver supports global `local|cloud` behavior with emergency overrides.
   - R2-backed markdown loader is implemented.
   - References: `src/lib/content-source-mode.ts`, `src/lib/r2-content-loader.mjs`, ADR-0010.

3. **Index-backed collection delivery is active for high-volume collections**
   - `lore`, `places`, `sentients`, and `systems` use index-backed pagination/query path with local fallback behavior.
   - References: `src/lib/content-index-page.ts`, `src/lib/content-index-repo.ts`, `src/pages/lore/index.astro`, `src/pages/places/index.astro`, `src/pages/sentients/index.astro`, `src/pages/systems/index.astro`.

4. **Campaign access and protected media path are implemented**
   - Better Auth + D1 campaign access checks are live.
   - Protected campaign media route fails closed for protected content when auth or storage is unavailable.
   - References: `src/utils/campaign-access.ts`, `src/lib/campaign-request-access.ts`, `src/lib/campaign-media-handler.ts`, `src/pages/api/campaign-media/[campaign]/images/[variant]/[...asset].ts`.

5. **Validation baseline is healthy**
   - `pnpm test`: passing (64 tests)
   - `pnpm build`: passing (with non-blocking warnings in local lane)

## Remaining Work (Short-Term Priorities)

1. **Finalize campaign image variant generation/verification pipeline**
   - Open item remains for `thumb`, `detail`, `fullscreen` sync-time generation/verification.
   - References:
     - `plans/campaign-content-separation-plan-and-todos-2026-03-16.md`
     - `plans/campaign-content-source-separation-handoff-to-code-2026-03-16.md`

2. **Close Discovery Gate G1 (requirements and UX contract)**
   - Type/subtype/tag behavior and grouped view UX are still open.
   - Reference: `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`.

3. **Close Discovery Gate G2 (sync failure semantics and hardening)**
   - Current sync flow can continue after index write failure; this should be formalized and tightened for authoritative lanes.
   - References:
     - `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`
     - `scripts/content-sync/apply-sync.mjs`

4. **Resolve known operator/config debt**
   - Staging Wrangler config warning debt remains.
   - Migration dry-run parser remains brittle when Wrangler warning noise appears.
   - Reference: `plans/content-index-p0-root-cause-2026-03-24.md`.

5. **Add automation for parity checks**
   - No CI workflow is currently present under `.github/workflows/`.
   - This keeps sync/index/auth verification primarily operator-driven.

## Longer-Term Workstreams

1. **Option 3 authz simplification (unified membership roles)**
   - Fully planned but not yet executed.
   - Reference: `plans/option-3-unified-membership-role-upgrade-todo.md`.

2. **Producer repository extraction (staged cutover)**
   - Decision accepted; implementation staged and not yet cut over.
   - Reference: ADR-0012 and `plans/content-producer-extraction-lld-handoff-2026-03-20.md`.

3. **Calendar implementation**
   - Architecture and developer handoff docs are present; runtime implementation has not started in `src/` yet.
   - References:
     - `plans/features/aletheia-calendar-architecture-recommendation.md`
     - `plans/features/aletheia_calendar_developer_handoff.md`

## Risks and Notes

1. **Doc drift risk remains non-trivial**
   - Some older planning files describe superseded states and can dilute current priority signal.

2. **Partial-success sync behavior can hide authoritative-lane failures**
   - This was a direct factor in the recent `content_index` incident and should be addressed via Gate G2.

3. **Local build warnings are expected under cloud-first workflow shift**
   - Empty local content mirrors in cloud mode can produce local warnings while parity lane remains authoritative.

## Immediate Recommended Sequence

1. Discovery Gate G1 requirements/design sign-off.
2. Discovery Gate G2 hardening contract sign-off.
3. Implement grouped type/subtype/tag views and search endpoint foundation.
4. Finalize campaign media variants pipeline.
5. Add CI parity lane for sync/index/auth verification.

## Open Task Count Snapshot (from active planning docs)

- `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`: 9 open items
- `plans/campaign-content-separation-plan-and-todos-2026-03-16.md`: 4 open items
- `plans/campaign-content-source-separation-handoff-to-code-2026-03-16.md`: 3 open items
- `plans/option-3-unified-membership-role-upgrade-todo.md`: 16 open items

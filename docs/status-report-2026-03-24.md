# World of Aletheia Status Report

- **Report date:** 2026-04-02
- **Generated at:** 2026-04-02T23:22:40+02:00
- **Repository branch:** `main`

## Executive Status

Project is in a stronger post-foundation state: CI now covers the core local quality lane, repo-wide TypeScript is back to a trustworthy baseline, and Discovery Gates G1/G2 are closed in both UX and sync semantics. The highest-value remaining work is now campaign media variants, calendar MVP depth, and operator tooling hardening.

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

5. **Discovery grouped UX and sync hardening gates are closed**
   - Grouped discovery is live for the type-bearing public collections: `lore`, `places`, `sentients`, `systems`, `bestiary`, `flora`, and `factions`.
   - Discovery contract and sync failure semantics are captured in `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`.
   - Cloud authoritative sync now fails closed on object, manifest, and D1 index publish failures with dedicated support codes.

6. **Validation baseline is healthy**
    - `pnpm test`: passing (64 tests)
    - `pnpm build`: passing (with non-blocking warnings in local lane)
    - `pnpm exec tsc --noEmit`: passing

7. **CI regression guard is present**
   - Minimal GitHub Actions workflow now runs `pnpm test` and `pnpm build` on pull requests and `main`.
   - Reference: `.github/workflows/ci.yml`.

## Remaining Work (Short-Term Priorities)

1. **Finalize campaign image variant generation/verification pipeline**
    - Open item remains for `thumb`, `detail`, `fullscreen` sync-time generation/verification.
    - References:
      - `plans/campaign-content-separation-plan-and-todos-2026-03-16.md`
      - `plans/campaign-content-source-separation-handoff-to-code-2026-03-16.md`

2. **Advance calendar MVP beyond the current route utility layer**
   - Calendar and timeline foundations exist, but the next value is richer event usage and follow-on date-math/API work.
   - References:
      - `plans/adrs/0014-calendar-and-timeline-canon-utility-routes-and-lore-event-metadata-policy.md`
      - `plans/features/aletheia_calendar_developer_handoff.md`

3. **Resolve known operator/config debt**
    - Staging Wrangler config warning debt remains.
    - Migration dry-run parser remains brittle when Wrangler warning noise appears.
    - Reference: `plans/content-index-p0-root-cause-2026-03-24.md`.

4. **Add deeper parity automation when secrets/remote execution are worth the complexity**
   - CI now covers the local quality lane, but sync/index/auth parity remains operator-driven by design.
   - Remote lanes should be added only with explicit secret handling and failure ownership.

## Longer-Term Workstreams

1. **Option 3 authz simplification (unified membership roles)**
   - Fully planned but not yet executed.
   - Reference: `plans/option-3-unified-membership-role-upgrade-todo.md`.

2. **Producer repository extraction (staged cutover)**
   - Decision accepted; implementation staged and not yet cut over.
   - Reference: ADR-0012 and `plans/content-producer-extraction-lld-handoff-2026-03-20.md`.

3. **Calendar implementation**
   - Architecture is accepted and the shared calendar engine/routes are present; richer MVP coverage is still pending.
   - References:
      - `plans/features/aletheia-calendar-architecture-recommendation.md`
      - `plans/features/aletheia_calendar_developer_handoff.md`

## Risks and Notes

1. **Doc drift risk remains non-trivial**
   - Some older planning files describe superseded states and can dilute current priority signal.

2. **Remote parity remains intentionally manual**
   - The new CI lane protects local regressions, but remote sync/index/auth verification still depends on operator execution.

3. **Local build warnings are expected under cloud-first workflow shift**
    - Empty local content mirrors in cloud mode can produce local warnings while parity lane remains authoritative.

## Immediate Recommended Sequence

1. Finalize campaign media variants pipeline.
2. Extend calendar/timeline MVP coverage.
3. Harden Wrangler/operator tooling around warning noise and staging config.
4. Decide whether remote parity deserves a secret-backed CI lane.

## Open Task Count Snapshot (from active planning docs)

- `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`: 9 open items
- `plans/campaign-content-separation-plan-and-todos-2026-03-16.md`: 4 open items
- `plans/campaign-content-source-separation-handoff-to-code-2026-03-16.md`: 3 open items
- `plans/option-3-unified-membership-role-upgrade-todo.md`: 16 open items

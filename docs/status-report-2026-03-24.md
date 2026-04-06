# World of Aletheia Status Report

- **Report date:** 2026-04-02
- **Generated at:** 2026-04-02T23:22:40+02:00
- **Repository branch:** `main`

## Executive Status

Project is in a stronger post-foundation state: CI covers the core local quality lane, repo-wide TypeScript remains healthy, cloud content no longer depends on R2 manifests, campaign media variants are generated at sync time, and the first `/api/calendar/*` contracts are live. The highest-value remaining work is now operator tooling hardening, remote parity automation decisions, and follow-on calendar consumers.

## Current State (Implemented)

1. **Discovery index remediation is complete**
   - `content_index` exists and is populated in staging and production.
   - Verified row count after remediation: 77 rows per environment.
   - Reference: `plans/content-index-p0-root-cause-2026-03-24.md`.

2. **Cloud-backed content mode and runtime contracts are in place**
    - Source mode resolver supports global `local|cloud` behavior with emergency overrides.
    - R2-backed markdown loader now resolves object keys from D1 `content_index` rows instead of R2 manifests.
    - References: `src/lib/content-source-mode.ts`, `src/lib/r2-content-loader.mjs`, `src/lib/content-index-loader.mjs`, ADR-0010.

3. **Index-backed collection delivery is active for high-volume collections**
   - `lore`, `places`, `sentients`, and `systems` use index-backed pagination/query path with local fallback behavior.
   - References: `src/lib/content-index-page.ts`, `src/lib/content-index-repo.ts`, `src/pages/lore/index.astro`, `src/pages/places/index.astro`, `src/pages/sentients/index.astro`, `src/pages/systems/index.astro`.

4. **Campaign access and protected media path are implemented**
     - Better Auth + D1 campaign access checks are live.
     - Protected campaign media route fails closed for protected content when auth or storage is unavailable.
     - Sync now generates `thumb`, `detail`, and `fullscreen` campaign image variants from `assets/images/original/**` source paths.
     - References: `src/utils/campaign-access.ts`, `src/lib/campaign-request-access.ts`, `src/lib/campaign-media-handler.ts`, `src/pages/api/campaign-media/[campaign]/images/[variant]/[...asset].ts`, `scripts/content-sync/campaign-media-variants.mjs`.

5. **Discovery grouped UX and sync hardening gates are closed**
    - Grouped discovery is live for the type-bearing public collections: `lore`, `places`, `sentients`, `systems`, `bestiary`, `flora`, and `factions`.
    - Discovery contract and sync failure semantics are captured in `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`.
    - Cloud authoritative sync now fails closed on object publish and D1 lookup/index publication failures with dedicated support codes.

6. **Calendar API follow-on work is live**
    - Same-origin JSON endpoints now exist for `/api/calendar/month`, `/api/calendar/week`, `/api/calendar/year`, `/api/calendar/moon-phase`, and `/api/calendar/date-diff`.
    - The server-rendered `/calendar` and `/timeline` pages still use the same shared engine directly.

7. **Validation baseline is healthy**
     - `pnpm test`: passing (94 tests)
     - `pnpm build`: passing (with non-blocking warnings in local lane)
     - `pnpm exec tsc --noEmit`: passing

8. **CI regression guard is present**
    - Minimal GitHub Actions workflow exists for manual `workflow_dispatch` execution and runs `pnpm test` plus `pnpm build`.
    - Reference: `.github/workflows/ci.yml`.

## Remaining Work (Short-Term Priorities)

1. **Resolve known operator/config debt**
    - Staging Wrangler config warning debt remains.
    - Migration dry-run parser remains brittle when Wrangler warning noise appears.
    - Reference: `plans/content-index-p0-root-cause-2026-03-24.md`.

2. **Decide whether remote parity deserves more automation**
    - CI protects the local quality lane, but sync/index/auth parity remains operator-driven by design.
    - Remote lanes should be added only with explicit secret handling and failure ownership.

3. **Build consumers on top of the new calendar API surface**
    - Calendar and timeline foundations exist, and `/api/calendar/*` is now available for richer UI or tooling consumers.
    - References:
      - `plans/adrs/0014-calendar-and-timeline-canon-utility-routes-and-lore-event-metadata-policy.md`
      - `plans/features/aletheia_calendar_developer_handoff.md`

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

1. Harden Wrangler/operator tooling around warning noise and staging config.
2. Decide whether remote parity deserves a secret-backed CI lane.
3. Build the next calendar/timeline consumer on top of `/api/calendar/*`.
4. Reassess campaign-domain follow-ons once the simplified pipeline settles.

## Open Task Count Snapshot (from active planning docs)

- `plans/discovery-navigation-and-search-index-lld-handoff-2026-03-20.md`: 9 open items
- `plans/campaign-content-separation-plan-and-todos-2026-03-16.md`: 4 open items
- `plans/campaign-content-source-separation-handoff-to-code-2026-03-16.md`: 3 open items
- `plans/option-3-unified-membership-role-upgrade-todo.md`: 16 open items

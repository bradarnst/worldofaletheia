# Front-End UI/UX Stabilization Plan (Implementation-Ready)

## Status

- Date: 2026-02-22
- Owner: Brad
- Scope: Astro front-end (layouts, headers, hero rendering, readability, interaction consistency)
- Priority: Immediate stabilization + near-term hardening

---

## 1) Context Snapshot (Current Confirmed State)

This plan reflects the current code and recent debugging outcomes:

1. **Non-deterministic/stale state was observed** during dev/hot-reload checks, masking visible changes until hard refresh/cache bypass.
2. **Shared header mismatch between domains** was a primary root cause of hero inconsistency.
3. **Route-conditional behavior exists** (e.g., systems route checks in layout), requiring explicit cross-route validation.
4. **Metadata/mapping risks remain possible** (per-collection assumptions and slug/image mapping drift if not validated).
5. **CSS suppression/layering risks were investigated** (hero overlay/filter layering and readability treatment).
6. **Targeted wiring fixes were applied** including:
   - `src/components/UsingAletheiaHeader.astro` now wired to `RandomHeroImage`.
   - Temporary debug scripts removed from:
     - `src/layouts/WorldAletheiaLayout.astro`
     - `src/layouts/UsingAletheiaLayout.astro`
7. **Build verification succeeded** with `pnpm build` after these changes.

---

## 2) Problem and Objective

### Problem

Hero readability and UI consistency historically drifted due to component parity gaps, cache masking, and inconsistent treatment under varied image luminance.

### Objective

Deliver deterministic, maintainable front-end behavior with:

- consistent hero rendering across World and Using domains,
- robust readability without over-darkening,
- stable responsive/interaction behavior,
- explicit validation protocol to prevent regression.

---

## 3) Prioritized Workstreams

## P0 — Immediate Stabilization (execute now)

### P0.1 Shared Header Contract Lock

**Files**
- `src/components/WorldAletheiaHeader.astro`
- `src/components/UsingAletheiaHeader.astro`
- `src/components/RandomHeroImage.astro`
- `src/components/HeroImage.astro`

**Task**
- Keep both domain headers using `RandomHeroImage` with the same behavioral contract.
- Ensure hero rendering path remains `RandomHeroImage -> HeroImage -> <Picture>`.
- Keep transparent/non-darkening overlay baseline in hero rendering.

**Dependency**
- None.

**Risk**
- Reintroducing domain divergence via ad-hoc header edits.

**Rollback**
- Revert header changes only; retain stable `HeroImage` and `RandomHeroImage` contracts.

**Acceptance Criteria**
- `/flora`, `/factions`, `/meta`, `/systems` all render hero through shared component path.
- No domain-specific hero implementation bypasses shared path.

---

### P0.2 Hero Readability Baseline (No Heavy Global Darkening)

**Files**
- `src/components/HeroImage.astro`
- `src/styles/global.css`
- `src/components/RandomHeroImage.astro`

**Task**
- Keep global overlay visually neutral.
- Preserve text readability with controlled text treatment and per-image class behavior.
- Remove unusually dark hero outlier(s) from curated image pool.

**Dependency**
- P0.1 complete.

**Risk**
- Overcorrecting brightness and reducing image fidelity.

**Rollback**
- Revert only filter class constants; keep curated pool edit if readability improves.

**Acceptance Criteria**
- Hero title/body readable at mobile + desktop on key routes.
- No muddy over-dark look on mid/bright images.

---

### P0.3 Deterministic QA Protocol (Cache/Hot-Reload Guardrail)

**Files**
- `docs/content-ingestion-user-guide.md` (append front-end validation section)

**Task**
- Document required hard-refresh and cache-disabled validation protocol.
- Document route matrix and theme matrix for hero + header parity checks.

**Dependency**
- P0.1 complete.

**Risk**
- Team falsely interpreting stale assets as code defects.

**Rollback**
- N/A (documentation only).

**Acceptance Criteria**
- Validation steps reproducible by a second person without clarification.

---

## P1 — Near-Term Hardening (next 1–2 sprints)

### P1.1 Typography and Spacing Consistency

**Files**
- `src/styles/global.css`
- Collection index pages under `src/pages/*/index.astro`

**Task**
- Normalize heading hierarchy and section spacing rhythm across collection index pages.

**Dependency**
- P0 complete.

**Risk**
- Inconsistent visual rhythm persists and weakens IA clarity.

**Acceptance Criteria**
- Equivalent sections use equivalent spacing and heading scale across domains.

---

### P1.2 Interaction State Consistency and Accessibility

**Files**
- `src/styles/global.css`
- `src/components/GlobalNavigation.astro`
- Header CTA/button regions

**Task**
- Ensure keyboard focus-visible, hover, active states are clear and consistent across themes.

**Dependency**
- P0 complete.

**Risk**
- Accessibility regressions in dark themes and keyboard-only navigation.

**Acceptance Criteria**
- Focus indicators visible on all primary nav and hero CTA controls.

---

### P1.3 Responsive QA Matrix

**Files**
- Collection index pages
- Header/layout wrappers

**Task**
- Validate mobile/tablet/desktop behavior for readability, card density, and CTA collision risk.

**Dependency**
- P1.1, P1.2.

**Acceptance Criteria**
- No clipping, overlap, or unreadable text in tested breakpoints.

---

## P2 — Strategic Improvements (defer)

### P2.1 IA Alignment of Linked but Missing Features

**Files**
- `src/components/Footer.astro`
- `src/components/TagCloud.astro`

**Task**
- Align navigation affordances with implemented routes to avoid dead-end expectation.

**Acceptance Criteria**
- No prominent links pointing to unimplemented end-user flows without clear status.

---

## 4) Execution Sequence (Directly Hand-off to Code Mode)

1. Confirm parity and shared hero path in both domain headers.
2. Curate hero pool in `RandomHeroImage` (remove known outlier image).
3. Validate hero readability token behavior in CSS and hero component.
4. Run deterministic checks:
   - `pnpm build`
   - `pnpm dev`
   - hard refresh + disable cache in browser devtools.
5. Validate route matrix:
   - `/`
   - `/flora`
   - `/factions`
   - `/meta`
   - `/systems`
6. Validate theme matrix:
   - `savanna-days`
   - `lake-days`
   - `savanna-nights`
   - `jungle-nights`
7. Document protocol in user guide.

---

## 5) Regression Checklist

Before merge:

1. `pnpm build` passes.
2. No temporary debug scripts reintroduced in layout files.
3. Both domain headers still use `RandomHeroImage`.
4. Hero text readable on route + theme matrix.
5. No unexpected visual suppression from overlay/filter layering.

---

## 6) Measurable Success Criteria

1. **Rendering parity:** 100% of World + Using index routes render hero through shared hero pipeline.
2. **Readability:** hero heading/body readable on all target routes in all four themes at mobile + desktop.
3. **Determinism:** cache-disabled recheck matches expected output after changes.
4. **Maintainability:** no new custom chooser tooling required; curated workflow remains lightweight.

---

## 7) Notes for Future Contributors

- Treat header parity as architectural contract, not page-level preference.
- Validate with cache bypass before concluding regressions.
- Prefer curation and predictable tokens over algorithmic complexity for the small hero pool.



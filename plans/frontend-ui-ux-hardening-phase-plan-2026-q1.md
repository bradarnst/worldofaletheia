# Front-End UI/UX Hardening Phase Plan (Q1 2026)

## Status

- Date: 2026-02-22
- Scope: Post-stabilization hardening
- Dependency: `plans/frontend-ui-ux-stabilization-plan-2026-02.md`
- Owner: Brad

---

## 1) Purpose

Convert recent stabilization outcomes into durable front-end quality controls across:

- interaction consistency,
- responsive clarity,
- accessibility conformance,
- information architecture coherence,
- maintainability and regression resistance.

This phase assumes hero parity fixes and layout debug cleanup are already complete.

---

## 2) Work Packages (with Dependencies)

## WP-1: Design Token and Rhythm Alignment

**Files**
- `src/styles/global.css`
- Collection index pages (`src/pages/*/index.astro`)

**Tasks**
1. Normalize heading sizes and spacing steps for shared section patterns.
2. Consolidate repeated utility patterns into reusable classes where duplication is proven.

**Dependencies**
- Stabilization plan complete.

**Risks**
- Inadvertent visual drift in pages not actively audited.

**Rollback**
- Revert token edits only; keep component wiring changes.

**Acceptance Criteria**
- Equivalent sections render with equivalent spacing and heading hierarchy across World/Using collections.

---

## WP-2: Accessibility Interaction Pass

**Files**
- `src/styles/global.css`
- `src/components/GlobalNavigation.astro`
- Header CTA areas

**Tasks**
1. Verify focus-visible on all interactive controls in all themes.
2. Standardize hover/active/focus styling to avoid theme-specific inconsistencies.
3. Verify keyboard navigation order for top nav + hero CTAs.

**Dependencies**
- WP-1 complete.

**Risks**
- Dark theme focus contrast regressions.

**Rollback**
- Revert focus style overrides and re-apply incrementally.

**Acceptance Criteria**
- Keyboard-only navigation is viable without hidden focus states.

---

## WP-3: Responsive Breakpoint QA Matrix

**Files**
- `src/layouts/WorldAletheiaLayout.astro`
- `src/layouts/UsingAletheiaLayout.astro`
- Collection page indexes

**Tasks**
1. Validate hero + first content section at mobile/tablet/desktop.
2. Validate card grids for density/readability at intermediate widths.
3. Ensure no route-specific overlap/collision on CTA or nav elements.

**Dependencies**
- WP-2 complete.

**Risks**
- Medium-width breakpoints under-tested compared to desktop.

**Rollback**
- Revert problematic breakpoint utility changes only.

**Acceptance Criteria**
- No clipping/overlap in route matrix (`/`, `/flora`, `/factions`, `/meta`, `/systems`, `/lore`, `/places`, `/sentients`, `/bestiary`).

---

## WP-4: IA/Navigation Coherence

**Files**
- `src/components/Footer.astro`
- `src/components/TagCloud.astro`
- Navigation components

**Tasks**
1. Review links to unimplemented routes and decide: implement, hide, or label as upcoming.
2. Keep top-level wayfinding consistent with the current four-layer model (Canon, Using Aletheia, Reference, Campaigns).

**Dependencies**
- WP-3 complete.

**Risks**
- User trust erosion from dead-end links.

**Rollback**
- Re-enable prior links only if replacement path exists.

**Acceptance Criteria**
- No high-prominence dead links in primary navigation surfaces.

---

## WP-5: Performance and Regression Guardrails

**Files**
- `src/components/HeroImage.astro`
- `src/components/RandomHeroImage.astro`
- `docs/content-ingestion-user-guide.md`

**Tasks**
1. Confirm hero stays on Astro optimized image path (`<Picture>`).
2. Keep curated hero pool minimal and documented.
3. Document repeatable cache-bypass validation protocol.

**Dependencies**
- WP-4 complete.

**Risks**
- Reintroduction of ad-hoc image paths bypassing optimized pipeline.

**Rollback**
- Restore shared hero component usage and remove any route-level bypasses.

**Acceptance Criteria**
- Hero pipeline unchanged and verified after each release.

---

## 3) Sequence (Execution Order)

1. WP-1
2. WP-2
3. WP-3
4. WP-4
5. WP-5

No parallel execution is recommended until WP-2 is complete.

---

## 4) Validation Protocol

Per work package:

1. `pnpm build` must pass.
2. `pnpm dev` run for manual verification.
3. Browser hard refresh (`Ctrl+Shift+R`) + DevTools Disable Cache enabled.
4. Route matrix + theme matrix checks documented in run notes.

---

## 5) Measurable Hardening Outcomes

1. **Consistency:** heading/spacing parity across all collection index pages.
2. **Accessibility:** focus-visible and keyboard path coverage across all themes.
3. **Responsiveness:** no collisions at mobile/tablet/desktop in route matrix.
4. **IA quality:** dead-end high-visibility links reduced to zero or explicitly labeled.
5. **Maintainability:** hero behavior remains centralized and curation process remains manual/lightweight.

---

## 6) Operational Notes

- This plan intentionally avoids introducing new automation systems for hero curation.
- Any proposal to add tooling must demonstrate clear maintenance ROI beyond current cadence.


# Campaigns Architecture Implementation Checklist (Code Mode)

## Objective
Implement a **single Astro project** approach with **internal domain separation** so Campaigns is modular now and extractable later.

## Definition of Done (High Level)
- Campaigns is treated as a first-class internal domain boundary.
- World/Using/Campaigns share one UX shell and design system.
- Session content is nested under Campaigns content, not a top-level Sessions content domain.
- Campaign data access goes through explicit service/API contracts.
- Interactive behavior is isolated to Campaigns Islands where needed.
- Extraction readiness artifacts exist (contracts, adapters, decision triggers).

---

## Phase 0 — Baseline and Guardrails

- [ ] Create this architecture decision record in project plans:
  - [ ] Confirm: one Astro app now, modular Campaigns boundary, API-first seams.
  - [ ] Document split triggers and non-goals.
  - [ ] Record source-of-truth decision: Obsidian vault is primary authoring system.
  - [ ] Record ingestion principle: Obsidian markdown and YAML frontmatter should be consumed as-is with minimal transformation.
- [ ] Add a short “Domain Model” section to project docs with three domains:
  - [ ] World of Aletheia (Canon)
  - [ ] Using Aletheia
  - [ ] Campaigns
- [ ] Define URL and IA policy (no breaking URL changes during migration).
- [ ] Define shared UX guardrails:
  - [ ] Shared navigation behavior
  - [ ] Shared visual tokens/components
  - [ ] Shared terminology for permissions and visibility

### 0.1 Obsidian-first content architecture
- [ ] Create an ADR or HLD section describing Obsidian-first pipeline and invariants.
- [ ] Define canonical content contract for ingestible notes:
  - [ ] markdown body remains source text
  - [ ] YAML frontmatter fields map to Astro schema fields
  - [ ] unsupported frontmatter keys are preserved in pass-through metadata
- [ ] Define Obsidian Bases compatibility policy:
  - [ ] identify required metadata fields for Bases views
  - [ ] ensure ingestion does not strip or rewrite Bases-relevant metadata
- [ ] Define file ownership model:
  - [ ] two global co-authors for shared content
  - [ ] campaign-level ownership override allowed per campaign
- [ ] Define ingest error policy:
  - [ ] warn on non-critical schema drift
  - [ ] fail on route identity breakage or missing required IDs

---

## Phase 1 — Internal Domain Boundaries in Code

### 1.1 Folder and module structure (pragmatic)
- [ ] Keep existing content folders under `src/content/**` (no forced Canon/Using folder split).
- [ ] Keep infrastructure simple and centralized first:
  - [ ] `src/services/` for service interfaces and query orchestration
  - [ ] `src/adapters/` for storage/data-source adapters
  - [ ] `src/contracts/` for DTO and contract types
  - [ ] `src/components/islands/` for interactive islands
- [ ] Keep Canon and Using as **logical layers** (schema + layout + nav), not mandatory filesystem domains.
- [ ] Establish Campaigns as the third logical layer and align content hierarchy under `src/content/campaigns/**`.
- [ ] Adopt nested campaign content convention:
  - [ ] `src/content/campaigns/<campaign-slug>/index.md` for campaign overview
  - [ ] `src/content/campaigns/<campaign-slug>/sessions/<session-slug>.md` for session notes
  - [ ] optional sibling folders for campaign-specific entities such as `characters` and `assets`
- [ ] Keep page routes stable while refactoring Campaign imports behind domain modules.
- [ ] Defer any Canon/Using folder reorganization unless measurable pain appears (ownership confusion, schema collisions, or repeated coupling bugs).

### 1.2 Route organization and ownership
- [ ] Confirm route ownership map:
  - [ ] `/campaigns/**` owned by Campaigns domain
  - [ ] `/campaigns/:campaignSlug/sessions/**` owned by Campaigns domain
  - [ ] do not maintain legacy `/sessions/**` compatibility in alpha
  - [ ] Canon/Using routes stay separate
- [ ] Ensure Campaign routes no longer import non-shared internals from Canon/Using.

### 1.3 Shared shell consistency
- [ ] Consolidate cross-domain shell contracts:
  - [ ] global nav entry schema
  - [ ] breadcrumb schema
  - [ ] layout slots/regions
- [ ] Verify Campaign pages still use shared shell and styles.

---

## Phase 2 — API/Service Contracts (Internal First)

### 2.1 Campaigns service layer
- [ ] Use Astro content collections directly in Campaign pages (`getCollection`, `getEntry`, `render`).
- [ ] Keep session resolution scoped by `campaignSlug` from nested campaign paths.
- [ ] Prefer route-local query logic first; extract tiny shared helpers only when duplication appears in 3+ places.
- [ ] Do **not** introduce repository/query-service layers by default.
- [ ] Keep `src/services/` and `src/adapters/` empty unless concrete complexity appears.
- [ ] Add Obsidian ingestion adapters:
  - [ ] vault markdown file reader
  - [ ] frontmatter normalizer with pass-through metadata
  - [ ] route identity resolver for campaign and session slugs

### 2.2 Contract definitions
- [ ] Keep Astro collection schemas as the primary type contract.
- [ ] Add explicit DTO contracts **only** when a real API boundary is introduced.
- [ ] If DTOs are introduced later, ensure session DTOs include `campaignSlug` and route-safe identifiers.
- [ ] If DTOs are introduced later, add explicit permission/visibility fields and a version marker (e.g., `v1`).
- [ ] If DTOs are introduced later, include authoring metadata fields compatible with Obsidian workflow.

### 2.3 Read API surface for future composition
- [ ] Expose stable read endpoints (or endpoint handlers) for campaign data.
- [ ] Keep endpoint contracts independent of Astro page internals.
- [ ] Add basic contract tests around response shapes.

---

## Phase 3 — Progressive Interactivity (Campaigns-only focus)

### 3.1 Island boundaries
- [ ] Identify first interactive Campaign slices:
  - [ ] live session stats panel
  - [ ] initiative/status tracker
  - [ ] campaign timeline filter UI
- [ ] Implement as isolated Islands under `src/components/islands/` with Campaign-prefixed naming.
- [ ] Keep canonical and most Using pages static/server-rendered.

### 3.2 State and update strategy
- [ ] Introduce a thin client-state layer for Campaign islands only.
- [ ] Define update transport strategy:
  - [ ] polling initially
  - [ ] upgrade path to SSE/WebSocket when justified
- [ ] Add resilience behavior (offline/latency fallbacks) for Campaign UI.

---

## Phase 4 — Security, Permissions, and Observability

- [ ] Normalize permission model for Campaigns (`public/player/gm/author`) at service layer.
- [ ] Add centralized permission checks (not page-by-page ad hoc checks).
- [ ] Add audit-friendly logging for campaign mutations (when writes are introduced).
- [ ] Add domain-tagged telemetry/events:
  - [ ] `domain=campaigns`
  - [ ] route performance and error rates
  - [ ] interactive feature usage

---

## Phase 5 — Extraction Readiness (No split yet)

- [ ] Add adapter boundaries so data source can be swapped:
  - [ ] Astro content adapter (current)
  - [ ] API/DB adapter (future)
- [ ] Create a “strangler” migration document for potential externalization.
- [ ] Ensure navigation/auth/theme contracts are portable across deployment boundaries.
- [ ] Run a dry-run: serve Campaigns through internal API-only path to validate seam quality.

---

## Split Decision Gate (Quarterly or milestone-based)

Trigger a split only if **2+** are true for sustained period:
- [ ] Campaigns needs independent release cadence.
- [ ] Real-time infra requirements diverge materially.
- [ ] Permission/security model requires isolation.
- [ ] Team ownership is distinct and blocked by shared deploy cadence.
- [ ] Reliability/performance of one domain harms the other.

If not triggered, continue one-project model and deepen modular boundaries.

---

## Immediate Next Sprint (Suggested)

- [ ] Simplify Campaign data access to direct Astro content collection usage in `/campaigns/**` pages.
- [ ] Remove unused services/adapters/contracts abstractions for Campaigns.
- [ ] Implement nested sessions routes under `/campaigns/:campaignSlug/sessions/**` without legacy `/sessions/**` compatibility.
- [ ] Defer DTO contract module until an actual API boundary is required.
- [ ] Draft an ADR in `plans/` for Obsidian-first source of truth and ingestion invariants.
- [ ] Build an initial ingest spike that reads Obsidian `.md` notes with minimal transformation.
- [ ] Add one non-critical Campaign island (read-only) as architecture spike.
- [ ] Add contract tests + one UX consistency checklist pass.

---

## Risks and Mitigations

- **Risk:** Overengineering early.
  - **Mitigation:** Keep adapters thin; ship value each phase.
- **Risk:** UX drift between domains.
  - **Mitigation:** shared shell contracts + design token governance.
- **Risk:** Contract churn.
  - **Mitigation:** versioned DTOs + compatibility tests.

---

## Success Metrics

- [ ] Campaign routes have no direct dependency on non-shared Canon/Using internals.
- [ ] 80%+ of Campaign data access goes through service interfaces.
- [ ] Initial interactive Campaign feature delivered without impacting static page performance.
- [ ] No UX inconsistency regressions in nav/layout across domains.
- [ ] Extraction readiness review passes without major refactor requirements.

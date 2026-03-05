# Astro Islands Framework Decision Memo — Calendar Now, Campaign/Character Systems Later

## Status

- Date: 2026-03-05
- Type: Framework decision memo (implementation-oriented)
- Inputs:
  - [`plans/features/aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md)
  - [`plans/features/aletheia-calendar-architecture-recommendation.md`](plans/features/aletheia-calendar-architecture-recommendation.md)
  - [`AGENTS.md`](AGENTS.md)
  - [`plans/adrs/0001-obsidian-first-content-architecture.md`](plans/adrs/0001-obsidian-first-content-architecture.md)
  - [`plans/adrs/0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)

## 1) Decision Question

For Astro Islands in this repo, should we:

1. Use Astro-only vanilla islands (no UI framework), or
2. Adopt a client framework now (Preact/React, Svelte, Vue)

given current calendar scope and plausible future interactive campaign/character features (dice rolling, near real-time sheet updates, party time/location tracking, synchronized GURPS state)?

---

## 2) Current Project Reality (Important Constraints)

1. Existing architecture direction is static-first + Astro-native, with anti-premature abstraction policy in [`0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md).
2. Current dependencies/config show **no client framework integration** in [`package.json`](package.json) and [`astro.config.mjs`](astro.config.mjs).
3. Calendar MVP requirements are deterministic date math + month/week/year views, which are interactive but not collaboration-heavy per [`aletheia_calendar_developer_handoff.md`](plans/features/aletheia_calendar_developer_handoff.md).
4. Timeline support is required but can remain build-time/static per [`aletheia-calendar-architecture-recommendation.md`](plans/features/aletheia-calendar-architecture-recommendation.md).

---

## 3) Option Comparison (Astro-Compatible)

## Option A — Astro Islands + Vanilla TypeScript (no framework) **[Recommended now]**

### Fit to current calendar

- Strong fit for bounded interactivity: view switching, date navigation, URL-state sync, panel toggles.
- Lowest hydration overhead and minimal dependencies.

### Trade-offs

- **Complexity:** Lowest.
- **Hydration cost/perf:** Best baseline.
- **State management:** Manual; fine for local UI state, weaker for complex shared state.
- **Ergonomics:** Good for small widgets, can become verbose for large reactive UIs.
- **Maintainability:** Strong now if components remain small.
- **Scalability/extensibility:** Adequate for calendar + static timeline; weaker for real-time multi-user features.

## Option B — Preact/React Islands

### Fit to current calendar

- Works well but likely unnecessary for MVP calendar complexity.

### Trade-offs

- **Complexity:** Medium (new integration + framework conventions).
- **Hydration cost/perf:** Higher than vanilla; Preact lighter than React.
- **State management:** Strong ecosystem for complex shared state.
- **Ergonomics:** High for interactive app-like surfaces.
- **Maintainability:** Good if interactive scope grows substantially.
- **Scalability/extensibility:** Best ecosystem fit for large client-state and real-time UX.

## Option C — Svelte Islands

### Fit to current calendar

- Very good for concise reactive UI with small bundle profiles.

### Trade-offs

- **Complexity:** Medium (new framework + team familiarity risk).
- **Hydration cost/perf:** Typically excellent.
- **State management:** Good, but smaller ecosystem than React.
- **Ergonomics:** Very good for focused interactive components.
- **Maintainability:** Good if team commits to Svelte direction.
- **Scalability/extensibility:** Solid, but fewer off-the-shelf patterns than React for complex collaborative tools.

## Option D — Vue Islands

### Fit to current calendar

- Strong reactive model, good component ergonomics.

### Trade-offs

- **Complexity:** Medium (new integration and conventions).
- **Hydration cost/perf:** Good.
- **State management:** Mature options, though adds framework-specific structure.
- **Ergonomics:** Good.
- **Maintainability:** Good with team familiarity.
- **Scalability/extensibility:** Strong, but no immediate advantage over simpler approach for calendar MVP.

---

## 4) Future Campaign/Character Interactivity Impact

The listed future features (dice rolling, near real-time HP/fatigue/encumbrance, synchronized party location/time, broader shared game-state) are **qualitatively different** from calendar MVP.

They trend toward:

- authoritative mutable state,
- frequent updates and conflict handling,
- real-time transport concerns,
- richer client-side state orchestration,
- stronger app-shell behavior.

That is usually a signal for either:

1. a framework-backed interactive sub-application, or
2. a separate campaign app/service boundary.

It is **not** a reason to force a framework into the calendar MVP now.

---

## 5) Same Site vs Separate Application Boundary

## Keep in same Astro architecture when all are true

1. Interactivity remains page-local (calendar navigation, filters, lightweight calculators).
2. No hard requirement for real-time multi-user consistency.
3. Data remains mostly build-time or request-time read-heavy.
4. Client state can remain ephemeral/session-local.

## Trigger split to separate app when any two or more are true

1. **Real-time collaboration requirement**: sub-second multi-user state sync becomes core UX.
2. **Authoritative live state**: campaign/character state must be transactionally consistent across users/sessions.
3. **Interactive surface dominance**: >50% of Campaigns domain traffic is inside app-like tools, not content pages.
4. **Operational divergence**: campaign tools need independent release cadence/SLO/error budgets from content site.
5. **Data model divergence**: high-write relational/event data no longer fits content-collection-centric patterns.
6. **Client complexity threshold exceeded**: repeated cross-page shared state/orchestration creates persistent complexity in Astro islands.

This aligns with extraction intent already noted in [`AGENTS.md`](AGENTS.md) and abstraction triggers in [`0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md).

---

## 6) Final Recommendation

## Framework choice now (calendar)

- Use **Astro islands with vanilla TypeScript** (no React/Preact/Svelte/Vue adoption now).
- Keep calendar engine server-canonical and shared with static timeline build pipeline per [`aletheia-calendar-architecture-recommendation.md`](plans/features/aletheia-calendar-architecture-recommendation.md).

### Why

1. Best fit for current feature size and deterministic logic.
2. Preserves static-first performance and minimal hydration cost.
3. Avoids accidental framework lock-in before true app-level needs are proven.
4. Matches YAGNI and current ADR direction.

## Framework choice later (if triggers are met)

- If Campaigns evolves into real-time collaborative tooling, prefer a **separate campaign application** using a dedicated interactive framework (likely Preact/React for ecosystem depth), while the main Astro site remains content/static-first.

---

## 7) Implementation Guidance — Build Now vs Defer

## Build now

1. Calendar UI island(s) in plain TS for month/week/year navigation.
2. Canonical calendar computation module used by SSR/build-time + optional same-origin endpoints.
3. Static timeline phase (post-MVP) using markdown ingestion + absDay normalization.
4. Clear internal contracts for calendar data shapes (view payloads, event payloads).

## Defer now

1. Adding any client framework integration package.
2. Global client-side state container architecture.
3. Realtime sync infrastructure and websocket/event channels.
4. Service extraction for calendar logic.

## Preserve optionality (without over-engineering)

1. Keep framework-agnostic domain interfaces for calendar payloads and event normalization.
2. Avoid embedding framework-specific assumptions into engine/data contracts.
3. Keep campaign interactive concerns behind route/API seams, not spread across static content routes.
4. Add a formal ADR only when split-app trigger conditions are crossed.

---

## 8) Practical Outcome Statement

Implement calendar interactivity with Astro vanilla islands now, keep timeline static/build-time in Phase 2, and defer framework adoption until campaign/character features cross explicit real-time/state-complexity thresholds that justify a separate interactive application boundary.


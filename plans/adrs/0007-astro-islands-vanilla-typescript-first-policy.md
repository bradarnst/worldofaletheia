# Astro Islands Framework Policy: Vanilla TypeScript First

## Status

- **Date:** 2026-03-05
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

The project is introducing interactive calendar capabilities (month/week/year navigation, date computations, moon phase display, timeline integration) within an Astro-first architecture.

At the same time, future campaign/character features may become significantly more interactive (dice rolling, near real-time stat updates, synchronized party state), which raises the question of whether to introduce a client framework now.

Current project conditions:

- Astro + Cloudflare deployment with static-first direction in [`AGENTS.md`](AGENTS.md)
- YAGNI and low-abstraction policy in [`0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)
- Calendar architecture recommendation favoring deterministic shared engine + static-first rendering in [`aletheia-calendar-architecture-recommendation.md`](plans/features/aletheia-calendar-architecture-recommendation.md)
- No existing client framework integration in [`astro.config.mjs`](astro.config.mjs) and [`package.json`](package.json)

## Decision Drivers

- **Static-first performance** with minimal hydration overhead
- **Simplicity** for current calendar scope
- **Maintainability** for a small team
- **YAGNI discipline**: avoid speculative framework adoption
- **Future optionality** for richer campaign/character interactivity without locking in prematurely

## Considered Options

### Option 1: Astro islands with Vanilla TypeScript (Chosen)

Use Astro islands and plain TypeScript/DOM APIs for calendar interactivity.

**Pros**

- Lowest dependency and runtime complexity
- Lowest baseline hydration cost
- Strong fit for bounded interactivity (navigation, filters, local UI state)
- Aligns with current Astro-native architecture decisions

**Cons**

- Manual state/event wiring can become verbose as UI complexity grows
- Less ergonomic than framework ecosystems for large reactive client applications

### Option 2: Adopt Preact/React now

Introduce framework integration immediately and build calendar islands with component/state ecosystem.

**Pros**

- Strong ecosystem for complex interactive app surfaces
- Good path for future real-time shared state tooling

**Cons**

- Adds immediate complexity and hydration overhead not required by current calendar scope
- Prematurely commits project ergonomics before triggers are proven

### Option 3: Adopt Svelte now

Introduce Svelte integration for concise reactive islands.

**Pros**

- Strong reactive ergonomics and good bundle characteristics

**Cons**

- New framework/tooling burden without clear near-term necessity
- Still premature given current bounded feature needs

### Option 4: Adopt Vue now

Introduce Vue integration for reactive islands.

**Pros**

- Mature reactive model and ecosystem

**Cons**

- Additional framework complexity without current requirement
- No concrete near-term advantage over vanilla islands for calendar MVP

## Decision Outcome

**Chosen option:** Option 1 — Astro islands with **vanilla TypeScript first**.

### Policy

1. Calendar interactivity is implemented using Astro islands and plain TypeScript.
2. Keep calendar computation logic framework-agnostic and shared across build/server usage.
3. Defer client framework integration unless explicit trigger conditions are reached.
4. If triggers are met, evaluate framework adoption together with potential campaign-app boundary extraction rather than piecemeal introduction.

### Trigger Conditions for Re-evaluation

Re-open this decision when two or more apply:

- Real-time multi-user synchronization is a core requirement
- Authoritative shared mutable campaign/character state is required
- Campaign tools become app-dominant rather than content-adjacent
- Independent release cadence/SLO for interactive domain is required
- Client state complexity repeatedly exceeds maintainable vanilla-island patterns

## Consequences

### Positive

- Fastest delivery for calendar with minimal architectural overhead
- Preserves static performance posture
- Aligns with existing ADR direction and team scale
- Keeps future extraction and framework choice open

### Negative

- Some future refactor likely if campaign tooling grows into a real-time app
- More manual client state wiring compared with framework abstractions

### Neutral

- Does not prevent future framework adoption
- Does not force immediate split into separate campaign application

## References

- Framework comparison memo: [`astro-islands-framework-decision-memo-calendar-and-campaigns.md`](plans/features/astro-islands-framework-decision-memo-calendar-and-campaigns.md)
- Calendar architecture recommendation: [`aletheia-calendar-architecture-recommendation.md`](plans/features/aletheia-calendar-architecture-recommendation.md)
- Campaign access policy ADR: [`0004-campaigns-astro-native-content-access-policy.md`](plans/adrs/0004-campaigns-astro-native-content-access-policy.md)


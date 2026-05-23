# External Admin Capability Boundary

## Status

- Date: 2026-05-23
- Status: Accepted
- Deciders: Brad

## Context and Problem Statement

World of Aletheia needs some privileged operational capabilities over time, including taxonomy management, richer spell-data administration, and other workflows that should not be exposed through the public website runtime by default.

Recent planning drift started to describe those needs as future admin-console or dashboard work inside this repository. That direction conflicts with the current project shape and architecture:

1. this repository is the public-facing Astro site and should remain Astro-native and public-site focused
2. privileged CRUD, dashboard, and operator workflows introduce a different runtime and security boundary than normal public content delivery
3. the project already has a working precedent for external capability ownership: Sorcerer Spells public read/query behavior can be served by an external project/API while this site consumes the approved public interface
4. some requirements are still real, especially taxonomy management, but they should be tracked as requirements handed off to an external admin project rather than as default implementation work here

At the same time, this decision should not overcorrect into saying the main site can never host any non-content behavior. Lightweight public forms and clearly public, site-only controls are already legitimate concerns in this repo.

## Decision Drivers

- Keep the public site scoped to public-site concerns.
- Avoid mixing privileged admin runtime concerns into the Astro site by default.
- Preserve clear security and ownership boundaries for admin CRUD and operator workflows.
- Support external API/artifact consumption from specialized projects such as `woa-admin`.
- Keep taxonomy-management requirements visible without implying this repo owns the admin UI.
- Follow existing YAGNI and external-boundary guardrails instead of introducing privileged layers casually.

## Considered Options

### Option 1: Build admin dashboards and CRUD surfaces in this repo

Use this Astro site as the default home for future privileged admin capabilities.

**Pros**

- Single repository for public and admin concerns.
- Fewer cross-project handoffs at first.

**Cons**

- Blurs the boundary between public site delivery and privileged operations.
- Encourages scope creep in a repo that is supposed to stay public-site focused.
- Adds security, authz, and runtime complexity without a current need to colocate those concerns here.

### Option 2: Keep admin capabilities external by default and consume approved APIs or artifacts here (Chosen)

Treat privileged admin surfaces, dashboards, CRUD tools, and taxonomy-management workflows as external-project responsibilities by default, likely under `woa-admin` or related operator-facing projects. This repo consumes approved public APIs, generated artifacts, or published exports from those projects when needed.

**Pros**

- Keeps the main site focused on public consumption and rendering.
- Preserves a cleaner security boundary around privileged operations.
- Fits the existing Sorcerer Spells precedent of external authority with public-site consumption.
- Makes cross-project ownership explicit for taxonomy management and similar operator workflows.

**Cons**

- Requires cross-project coordination.
- Introduces dependency on documented API or artifact contracts.

### Option 3: Decide case-by-case with no default boundary

Leave each future admin-like need to ad hoc planning without a standing rule.

**Pros**

- Maximum flexibility per feature.

**Cons**

- Reintroduces planning drift.
- Makes scope and ownership harder to reason about.
- Increases the chance that privileged concerns leak back into this repo by inertia.

## Decision Outcome

**Chosen option:** Option 2 - keep admin capabilities external by default and consume approved APIs or artifacts here.

### Policy

1. Admin consoles, dashboards, privileged CRUD, and operator workflows are external to this repository by default.
2. `woa-admin` is the expected default home for those capabilities unless a different external project is explicitly chosen.
3. This repository may consume public APIs, generated artifacts, or exported datasets produced by those external projects.
4. Taxonomy management remains a real requirement, but it is tracked here as an external-admin requirement rather than as an in-repo admin-console feature.
5. Sorcerer Spells is the precedent model: external project authority for spell data/admin capability, public-site consumption in this repo via approved public interfaces.
6. Rich spell CRUD, privileged spell management, and any future spell-specific FTS administration belong outside this repo unless a later ADR explicitly changes that boundary.
7. Related-resource enrichment for how this site consumes and renders links remains an in-repo concern; this ADR does not move that rendering/discovery work out of the site.
8. Exceptions are allowed for lightweight public-site concerns that do not create a privileged admin surface, such as public inquiry forms or clearly site-local controls.
9. Introducing privileged admin behavior into this repo requires an explicit follow-up architectural decision rather than happening by default inside feature planning.

## Consequences

### Positive

- Public-site scope is clearer.
- Privileged workflows keep a cleaner security and runtime boundary.
- Planning docs can track taxonomy-management needs without implying the wrong implementation home.
- External API consumption patterns already used by Sorcerer Spells become easier to reason about.

### Negative

- Some features now require explicit cross-project handoff and contract definition.
- Planning and delivery can depend on external project readiness.

### Neutral

- This repo may still host lightweight public forms and similar non-privileged interactions.
- This repo may still consume external spell/search/query APIs and other approved public interfaces.
- This decision does not itself require new service, adapter, or contract layers in the public site.

## Links

- `plans/todos/admin-console-and-taxonomy-management-2026-04-25.md`
- `plans/todos/related-resource-enrichment-and-spell-discovery-2026-04-27.md`
- `plans/sorcerer-spell-list-client-ux-plan-2026-05-08.md`
- `src/adapters/public-spell-api.ts`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`

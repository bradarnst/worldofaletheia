# Systems Collection Taxonomy: `type` as System Family, `subtype` as Topic

## Status

- **Date:** 2026-03-15
- **Status:** Accepted
- **Deciders:** Brad

## Context

The `systems` collection under Using Aletheia currently mixes two different classification concerns:

1. system family (for example, GURPS), and
2. topic domain (for example, magic, combat, skill).

Current schema in `src/content.config.ts` models `systems.type` as topic values (`magic`, `combat`, `skill`, etc.).
At the same time, content is already carrying system-family identity separately through ad hoc fields (for example, `ttrpg: gurps`) that are not part of the collection schema contract.

This causes structural drift and weakens the taxonomy for future expansion (for example, Pathfinder, DnD) because the primary discriminator (`type`) is not the same axis used by route and navigation intent (`/systems/gurps/*`).

The project already uses collection-level type hierarchies elsewhere and favors explicit, schema-enforced content contracts.

## Decision Drivers

- Preserve consistent taxonomy hierarchy across collections
- Keep schema as canonical source of truth (avoid ad hoc metadata)
- Support future multi-system expansion without adding a second naming field later
- Minimize accidental complexity and avoid introducing unnecessary new fields
- Keep migration cost low and bounded to frontmatter + schema updates

## Considered Options

### Option 1: Keep `type` as topic and add a new `systemName` field

Use `type` for topic (magic/combat/etc.) and introduce a separate field for system family (`gurps`, `general`, etc.).

**Pros**

- Minimal change to existing `type` values
- Direct compatibility with current topic-oriented entries

**Cons**

- Adds a parallel taxonomy field where existing patterns already rely on `type`
- Increases long-term cognitive overhead (two competing primary classifiers)
- Encourages further drift when contributors choose different fields for grouping/filtering

### Option 2: Redefine `type` as system family and add `subtype` for topic (Chosen)

Use `type` for system family (`general`, `gurps`, future `pathfinder`, `dnd`) and `subtype` for topic (`magic`, `combat`, `skill`, etc.).

**Pros**

- Clear two-axis model with explicit semantics
- Aligns with route and navigation intent under `/systems/{family}`
- Preserves extensibility for additional systems
- Keeps schema-driven contract simple and explicit

**Cons**

- Requires frontmatter migration for existing systems content
- Requires small schema and page/filter updates

### Option 3: Use folder-derived system family and keep `type` as topic

Infer system family from path (`src/content/systems/gurps/*`) and retain topic-only `type`.

**Pros**

- Avoids explicit family field in frontmatter
- Smaller immediate frontmatter change set

**Cons**

- Couples data model to filesystem conventions
- Makes content portability and schema validation weaker
- Harder to support cross-family or future non-folder-based ingestion workflows

## Decision Outcome

**Chosen option:** Option 2 — redefine `systems.type` as system family and add `systems.subtype` for topic.

### Policy

1. `systems.type` is the primary system family axis (`general`, `gurps`, future families as needed).
2. `systems.subtype` is the topic axis (for example, `magic`, `combat`, `skill`, `language`, `character`, `economy`, `social`, `equipment`).
3. Ad hoc `ttrpg` frontmatter is deprecated for systems classification and must be removed after migration.
4. Schema and content must remain in lockstep; unknown taxonomy values are rejected at validation time.

### Consequences

#### Positive

- Stable taxonomy for future multi-system expansion
- Stronger schema enforcement and less metadata drift
- Cleaner filtering/grouping semantics for Using Aletheia systems pages

#### Negative

- One-time migration effort across existing systems entries
- Requires test/content validation updates to prevent regression

#### Neutral

- Does not alter Campaign authorization model or SSR gating decisions
- Does not require new service/adaptor abstractions

## Links

- `src/content.config.ts`
- `src/content/systems/**`
- Related ADR: `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`

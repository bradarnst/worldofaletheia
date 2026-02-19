# Architect Mode — Project Context Rules

## Required Reading

Before any architectural analysis, read these files:

1. `AGENTS.md` — Full project context, tech stack, content model, conventions
2. `plans/adrs/` — All existing Architecture Decision Records
3. `aletheia-worldbulding-charter.md` — Immutable world canon constraints

## ADR Quick Reference

| ADR | Decision | Key Implication |
|-----|----------|-----------------|
| 0001 | Obsidian-first content architecture | One-way content flow: Obsidian → repo → build → deploy. No bidirectional sync or CMS patterns. |
| 0002 | Homepage story-first pattern | Narrative landing page, not navigation index. Navigation duplication is intentional reinforcement. |
| 0003 | Astro Image component policy | `<Picture>` for hero/banner, `<Image>` for inline/cards. No CSS `background-image` for primary content. |
| 0004 | Campaigns native content access | Use Astro content APIs directly. No abstraction layers unless concrete triggers are met. |

## ADR-0004 Abstraction Triggers

Do NOT recommend introducing service/adapter/contract layers unless one or more of these triggers are concretely met:

- Same logic duplicated in 3+ places
- Materially complex authentication rules
- A real external API boundary
- A second active data source

## Three-Domain Boundaries

| Domain | Collections | Layout Chain | Interactive? |
|--------|-------------|-------------|--------------|
| Canon (World of Aletheia) | lore, places, sentients, bestiary, flora, factions | BaseLayout → WorldAletheiaLayout → WorldAletheiaContentLayout | No — remains fully static |
| Using Aletheia | systems, meta | BaseLayout → UsingAletheiaLayout → UsingAletheiaContentLayout | No — remains fully static |
| Campaigns | campaigns, sessions | BaseLayout → CampaignsLayout → CampaignsContentLayout | Yes — first domain for Astro Islands |

## Astro-Native Architecture

This project uses Astro as both framework and architectural philosophy:

- **Static by default** — pages are pre-rendered at build time. This is a feature, not a limitation.
- **Content APIs are the data layer** — `getCollection()`, `getEntry()`, `render()` from Astro's content layer are the primary data access pattern. Do not introduce ORMs, GraphQL, or custom query layers unless ADR-0004 triggers are concretely met.
- **Astro components over framework components** — use `.astro` components for all UI that doesn't require client-side state. They render to zero JavaScript.
- **Islands for interactivity** — when client-side state is genuinely needed (Campaigns domain only in the current roadmap), use Astro Islands (`client:load`, `client:visible`, `client:idle`) with the lightest viable framework. Do not introduce islands for static content domains (Canon, Using).
- **No global client-side state** — there is no Redux, Zustand, or similar. Theme switching uses vanilla JS with `localStorage`. Future campaign interactivity should use isolated island state, not a global store, unless a concrete need emerges.

When evaluating architectural proposals, prefer solutions that:
1. Work at build time over runtime
2. Use Astro-native APIs over third-party abstractions
3. Add zero client JS when possible
4. Scope interactivity to the smallest necessary island

## Core Product Concerns (Not Afterthoughts)

These are central to the product vision and must be considered in any architectural recommendation:

1. **Relationships** — `parentChain` (hierarchical breadcrumbs) and `relationships` (cross-references with `partOf`/`connectedTo` kinds) are first-class schema features with rendering infrastructure ready
2. **Search/Filter/Sort/Group** — Planned capabilities that should influence schema, component, and routing decisions
3. **Content types** — Each collection has a `type` enum; future filtering, grouping, and navigation depend on these
4. **Tags** — Present in schema and rendered via TagCloud; tag-based filtering and index pages are planned

## New ADR Format

When drafting a new ADR, follow MADR format with these sections:
- Title (as H1)
- Status (Proposed/Accepted/Deprecated/Superseded)
- Context and Problem Statement
- Decision Drivers
- Considered Options
- Decision Outcome (with Consequences: positive, negative, neutral)

Number sequentially after the last ADR (currently 0004).

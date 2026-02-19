---
description: Pragmatic, readable code for World of Aletheia
mode: primary
---

You are the project Code agent for World of Aletheia. In addition to your general
coding expertise, you have deep context on this specific project. Read AGENTS.md
for full project context before making structural decisions.

## Framework: Astro-Native First

- Use `getCollection()`, `getEntry()`, `render()` from `astro:content` directly in page frontmatter.
- Use `.astro` components for everything that doesn't need client-side state.
- Use `<Image>` for inline/card images, `<Picture>` for hero/banner (ADR-0003).
- Only use Astro Islands in the Campaigns domain when genuine client-side state is needed.
- File-based routing via `src/pages/`. Dynamic routes use `[...slug].astro` with `getStaticPaths()`.

## Import Conventions

Always use path aliases — never relative paths with `../`:
`~/*`, `@components/`, `@layouts/`, `@pages/`, `@styles/`, `@utils/`, `@data/`, `@assets/`, `@images/`

## Component Design Principles

- Prefer generic, parameterized components over domain-specific duplicates.
- Define props with `interface Props`. Destructure with defaults.
- Handle both Astro v5 and v6 content structures: `const data = content.data || content;`
- Favor composition (slots, nested components) over configuration (lots of boolean props).

## Content Collections

- Schema source of truth: `src/content.config.ts`
- All collections except `pages` extend `baseSchema`
- Campaigns override status with their own enum via `baseSchema.omit({ status: true }).extend()`

## Content Filtering

- Current: inline `status === 'publish'` checks in each page
- Preferred: use `getFilteredCollection()` from `src/utils/content-filter.ts`

## Styling

1. DaisyUI component classes first (`card`, `btn`, `badge`)
2. Tailwind utilities second (`flex`, `gap-4`, `text-sm`)
3. Custom utility classes third (`.reading-prose`, `.meta-muted`, `.tag-chip`)
4. All four themes must work — use DaisyUI semantic classes, not hardcoded colors

## Architecture Guardrails

- Do not populate `src/adapters/`, `src/services/`, or `src/contracts/` unless ADR-0004 triggers are met
- Do not add client-side frameworks to Canon or Using Aletheia domains
- Do not introduce global client-side state
- Relationships (`parentChain`, `relationships`) are a core product concern

## Known Technical Debt

When touching code near these patterns, mention the debt but only fix if in scope:

| Current | Preferred |
|---|---|
| Domain-specific layouts sharing 80%+ structure | Generic parameterized components |
| Inline status filtering in every index page | Use `getFilteredCollection()` |
| Repeated filter→map→grid across index pages | Shared utility or component |
| Homepage with 10 near-identical filter/map blocks | Extract collection-to-discovery mapper |

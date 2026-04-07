# Code Mode — World of Aletheia Project Rules

## Framework: Astro-Native First

This is an Astro 6 (beta) project. Always prefer Astro-native patterns:

- **Data access**: Use `getCollection()`, `getEntry()`, `render()` from `astro:content` directly in page frontmatter. Do not introduce GraphQL, ORMs, or custom query layers.
- **Components**: Use `.astro` components for everything that doesn't need client-side state. They emit zero JavaScript.
- **Images**: Use `<Image>` from `astro:assets` for inline/card images, `<Picture>` for hero/banner images (ADR-0003). Always provide `alt` text. Do not use CSS `background-image` for content imagery.
- **Islands**: Only use Astro Islands (`client:load`, `client:visible`, `client:idle`) in the Campaigns domain when genuine client-side state is needed. Canon and Using Aletheia domains remain fully static — no islands, no client-side framework components.
- **Routing**: File-based routing via `src/pages/`. Dynamic routes use `[...slug].astro` with `getStaticPaths()`.

## Import Conventions

Always use path aliases — never relative paths with `../`:

```typescript
import Layout from '@layouts/MainSiteLayout.astro';
import ContentCard from '@components/ContentCard.astro';
import { getCollection } from 'astro:content';
import heroImage from '@images/hero.png';
```

Available aliases: `~/*`, `@components/`, `@layouts/`, `@pages/`, `@styles/`, `@utils/`, `@data/`, `@assets/`, `@images/`, `@services/`, `@adapters/`, `@contracts/`

## Component Design Principles

### Prefer Generic over Domain-Specific

The codebase currently has parallel domain-specific components and layouts (e.g., `WorldAletheiaContentLayout`, `UsingAletheiaContentLayout`, `CampaignsContentLayout`) that share significant structure. **The preferred direction is toward generic, parameterized components** where the domain is a prop or slot, not a reason to duplicate a component.

When building or modifying components:
- **Ask**: Could this component serve multiple domains if it accepted a domain/variant prop instead of being hardcoded to one?
- **Ask**: Is the domain-specific version doing anything structurally different, or just swapping labels, nav items, and colors?
- **If the structure is the same**, prefer a single component with domain passed as a prop (e.g., `domain: 'canon' | 'using' | 'campaigns'`)
- **If the behavior genuinely diverges** (e.g., Campaigns needs interactive islands that Canon never will), separate components are justified
- **Don't force it** — if parameterization makes the component harder to read than two simple components, keep them separate

This applies to layouts, content headers, navigation components, and index page patterns.

### Component Conventions
- Define props with `interface Props` in the frontmatter fence
- Destructure `Astro.props` with default values: `const { tags = [], maxTags = 10 } = Astro.props;`
- Handle both Astro v5 and v6 content structures: `const data = content.data || content;`
- Keep components focused — one clear responsibility per component
- Favor composition (slots, nested components) over configuration (lots of boolean props)

### Composition over Configuration
When a component starts accumulating boolean flags (`showExcerpt`, `showTags`, `showStatus`, `showCampaign`), consider whether slots or composed sub-components would be clearer. A few flags are fine; a component with 8+ props controlling visibility is a sign it should be decomposed.

## Page Patterns

### Collection Index Pages
Each collection follows a two-file pattern:
- `src/pages/{collection}/index.astro` — List: `getCollection()` → filter → render grid + tag cloud
- `src/pages/{collection}/[...slug].astro` — Detail: `getStaticPaths()` + `getEntry()` + `render()`

**Known improvement area**: Current index pages duplicate the same filtering, grid layout, and tag extraction logic inline. The preferred direction is to reduce this duplication — either through a shared index page component that accepts a collection name, or through utility functions that extract the repeated patterns. Use judgment: a small shared utility is better than a complex abstraction.

### Reference-Specific Routing
Reference routes live under `/references/**`. Calendar, timeline, and maps are reference surfaces, not content collections. Keep their page/layout/navigation work gathered under the Reference route family while leaving calendar APIs under `/api/calendar/*`.

### Campaign-Specific Routing
Sessions use nested routes: `/campaigns/[campaign]/sessions/[...slug].astro`. The `campaign` param comes from the URL; the session's `data.campaign` field is the foreign key linking back to the campaign slug.

## Content Collections

All 11 collections are defined in `src/content.config.ts`:

- **Schema source of truth**: `src/content.config.ts` — not the meta design docs in `src/content/meta/`
- **Base schema**: All collections except `pages` extend `baseSchema` (includes `status`, `author`, `secret`, `tags`, `campaign`, `permissions`, `parentChain`, `relationships`)
- **Campaigns omit status**: Uses `baseSchema.omit({ status: true }).extend()` and relies on `visibility` for access behavior and public listing decisions
- **Sessions require campaign**: The `campaign` field is required on sessions (overrides the optional base field)

### Content Filtering
**Current state**: Index pages use inline `item.data.status === 'publish'` checks. The utility `src/utils/content-filter.ts` exists with `shouldIncludeContent()`, `getFilteredCollection()`, etc., but no pages use it yet.

**Preferred direction**: Centralize filtering through the utility. When modifying index pages or creating new ones, prefer using `getFilteredCollection()` over inline status checks. If the utility needs enhancement to support a use case, improve it rather than adding more inline logic.

## Styling

### Class Hierarchy (in order of preference)
1. **DaisyUI component classes**: `card`, `btn`, `badge`, `badge-outline`, etc.
2. **Tailwind utilities**: `flex`, `gap-4`, `text-sm`, `mb-3`, etc.
3. **Custom utility classes** (from `src/styles/global.css`): `.reading-prose`, `.content-container`, `.meta-muted`, `.tag-chip`, `.content-card`, `.nav-readable`, `.focus-ring`
4. **Custom CSS**: Only when the above three can't achieve the result

### Design Tokens
Use the project's semantic token names, not raw colors:
- Backgrounds: `bg-base-100`, `bg-base-200`, or `paper-*` custom properties
- Text: `text-ink-950` (primary), `text-ink-800` (body), `text-ink-700` (secondary)
- Accents: `btn-primary` (bronze), `dusty-*` (rose), `warm-stone-*` (neutral)
- Status: `.meta-muted` for secondary metadata text

### Theme Awareness
All four themes (`savanna-days`, `lake-days`, `savanna-nights`, `jungle-nights`) must work. Use DaisyUI semantic classes (`bg-base-100`, `text-base-content`) rather than hardcoded colors. Test in at least one light and one dark theme.

## Content Sync Scripts

Scripts in `scripts/content-sync/` are standalone Node.js ESM (`.mjs` files):
- Use only Node.js built-ins (`node:fs/promises`, `node:path`, `node:child_process`)
- No external dependencies
- Use logging utilities from `utils.mjs` (`info`, `ok`, `warn`, `fail`, `step`, `support`)
- Error messages include support codes (e.g., `CONFIG-MISSING`, `VALIDATION-FAILED`)
- Debug mode: check `process.env.CONTENT_SYNC_DEBUG`

## Architecture Guardrails

- **Do not populate** `src/adapters/`, `src/services/`, or `src/contracts/` unless ADR-0004 triggers are concretely met (3+ places with duplicated logic, complex auth, real API boundary, or second data source)
- **Do not add client-side frameworks** (React, Vue, Svelte, Solid) to Canon or Using Aletheia domains
- **Do not introduce global client-side state** (Redux, Zustand, signals). Theme uses vanilla JS + localStorage. Future Campaign islands use isolated state only.
- **Do not create bidirectional content sync** or CMS patterns — content flows one way from Obsidian (ADR-0001)
- **Relationships are a core concern** — when creating or modifying components that display content, consider whether `parentChain` and `relationships` should be surfaced

## Known Technical Debt

Do not replicate these patterns when writing new code — instead move toward the preferred direction:

| Current Pattern | Preferred Direction |
|---|---|
| Domain-specific layouts/headers that share 80%+ structure | Generic parameterized components with domain as a prop |
| Inline `status === 'publish'` filtering in every index page | Use `getFilteredCollection()` from `content-filter.ts` |
| Repeated filter → map → grid pattern across index pages | Shared index page component or extracted utility |
| `content.data \|\| content` backward-compat checks everywhere | Consolidate to a single helper if the pattern persists across Astro 6 stable |
| Homepage discovery pool with 10 near-identical filter/map blocks | Extract a collection-to-discovery-item mapper |

When touching code near these patterns, **mention the debt but only fix it if it's in scope**. Don't expand a small task into a refactoring project without discussing it first.

## Key Files to Know

| When working on...            | Read first...                                    |
|-------------------------------|--------------------------------------------------|
| Any content collection        | `src/content.config.ts`                          |
| Layouts or page structure     | `src/layouts/BaseLayout.astro` and the relevant domain layout chain |
| Styling or theming            | `src/styles/global.css`                          |
| Content filtering             | `src/utils/content-filter.ts`                    |
| Campaign/session routing      | `src/pages/campaigns/` directory structure        |
| Content sync pipeline         | `scripts/content-sync/index.mjs`                 |
| Architectural decisions       | `plans/adrs/` (all 4 ADRs)                       |

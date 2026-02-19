# AGENTS.md — World of Aletheia

## Project Identity

World of Aletheia is a fantasy worldbuilding website and evolving campaign platform for a custom GURPS-based tabletop RPG setting. It is **not just a wiki** — the roadmap includes interactive campaign management tools, relationship-rich navigation, search/filter/sort/group capabilities, authenticated multi-user access, and real-time session features. The Campaigns domain is designed for eventual extraction as an independent service.

Content is co-authored by two people (Brad and Barry) primarily in Obsidian, synced to this repo via a custom pipeline, and published as an Astro static site deployed to Cloudflare Pages.

**Live site**: worldofaletheia.com

---

## Tech Stack

| Technology         | Version/Detail               | Role                                  |
| ------------------ | ---------------------------- | ------------------------------------- |
| Astro              | 6.0.0-beta.3                 | Core SSG/SSR framework                |
| TypeScript         | strict mode                  | Type safety (via `astro/tsconfigs/strict`) |
| Tailwind CSS       | 4.x                         | Utility-first CSS                     |
| DaisyUI            | 5.x                         | Component library atop Tailwind       |
| Cloudflare Workers | via `@astrojs/cloudflare`    | Deployment target                     |
| Fuse.js            | 7.x                         | Client-side fuzzy search (installed, not yet integrated) |
| Vitest             | 4.x                         | Test runner (configured, minimal tests) |
| pnpm               |                              | Package manager                       |
| Node.js ESM        |                              | Content sync scripts                  |
| Zod                | via Astro content collections | Frontmatter schema validation         |

---

## Commands

```bash
pnpm dev                  # Local dev server
pnpm build                # Production build to ./dist/
pnpm preview              # Preview production build locally
pnpm test                 # Run tests (vitest run)
pnpm content:sync         # Full Obsidian-to-repo sync pipeline
pnpm content:sync:dry-run # Dry-run analysis only (no mutations)
pnpm content:validate     # Frontmatter/markdown validation only
pnpm content:git          # Git pull/commit/push only
```

---

## Project Structure

```
/
├── config/                     # User-local configuration (gitignored sync config)
├── docs/                       # User-facing documentation (content ingestion guide)
├── plans/                      # Architecture Decision Records & planning docs
│   └── adrs/                   # Formal MADR-format decision records (4 ADRs)
├── public/                     # Static assets (favicon, hero image)
├── scripts/
│   └── content-sync/           # Node.js ESM modules for Obsidian content ingestion
├── src/
│   ├── adapters/               # External data source adapters (intentionally empty, see ADR-0004)
│   ├── assets/images/          # Optimized images (Astro asset pipeline)
│   ├── components/             # Reusable Astro components (~20)
│   ├── content/                # Markdown content collections (11 collections)
│   ├── content.config.ts       # Central schema definitions for ALL collections
│   ├── contracts/              # Domain DTOs/wire types (intentionally empty, see ADR-0004)
│   ├── data/spells/            # Static JSON data (GURPS sorcerer spells)
│   ├── layouts/                # Astro layout components (~12, composition hierarchy)
│   ├── pages/                  # File-based routing (~30 page files)
│   ├── services/               # Business logic layer (intentionally empty, see ADR-0004)
│   ├── styles/global.css       # Authoritative CSS: Tailwind v4 @theme + DaisyUI themes
│   └── utils/content-filter.ts # Content filtering utilities
├── astro.config.mjs            # Astro framework config
├── tsconfig.json               # TypeScript config with path aliases
├── wrangler.jsonc              # Cloudflare Workers/Pages deployment config
├── aletheia-worldbulding-charter.md  # Immutable world canon constraints
└── package.json
```

---

## Three-Domain Model

The site is organized into three logical domains, each with its own layout hierarchy, navigation, and content collections:

### 1. Canon — World of Aletheia
Stable reference material: lore, places, sentients, bestiary, flora, factions.
- Routes: `/lore`, `/places`, `/sentients`, `/bestiary`, `/flora`, `/factions`
- Layout chain: `BaseLayout → WorldAletheiaLayout → WorldAletheiaContentLayout`

### 2. Using Aletheia
Documentation, game systems, meta-content, how-to guides.
- Routes: `/about`, `/systems`, `/systems/gurps/*`, `/meta`
- Layout chain: `BaseLayout → UsingAletheiaLayout → UsingAletheiaContentLayout`

### 3. Campaigns
Campaign overviews and session logs. This is the **first domain targeted for interactive features** (Astro Islands) and eventual extraction as an independent service.
- Routes: `/campaigns`, `/campaigns/[campaign]/sessions/*`
- Layout chain: `BaseLayout → CampaignsLayout → CampaignsContentLayout`
- Sessions are nested under campaigns in the filesystem and linked via a `campaign` string field (foreign key to campaign slug)

---

## Architecture & Key Patterns

### Obsidian-First Content Pipeline (ADR-0001)
Content flows one way: **Obsidian vault → Git repo → Astro build → Cloudflare deploy**. The Obsidian vault is the single source of truth. The sync pipeline (`scripts/content-sync/`) handles diffing, stale file management, frontmatter validation, and git operations. Do not introduce bidirectional sync or CMS patterns.

### Content Collections & Schemas
All 11 collections are defined in `src/content.config.ts` using Astro's glob loaders with Zod schemas. A shared `baseSchema` defines common fields; each collection extends it via `baseSchema.extend()`. Campaigns use `baseSchema.omit({ status: true }).extend()` to replace the status enum entirely. The `pages` collection has its own standalone schema with no base fields.

### Layout Hierarchy (Composition Chain)
```
BaseLayout (HTML shell, theme script, BaseHead + Footer)
├── MainSiteLayout (+GlobalNavigation, for top-level pages)
├── WorldAletheiaLayout (+WorldAletheiaNav + WorldAletheiaHeader)
│   └── WorldAletheiaContentLayout (+ContentHeader with parentChain/relationships)
├── CampaignsLayout (+CampaignsNav)
│   └── CampaignsContentLayout (+CampaignsContentHeader)
├── UsingAletheiaLayout (+UsingAletheiaNav)
│   └── UsingAletheiaContentLayout (+UsingAletheiaContentHeader)
├── GurpsLayout (GURPS-specific nav)
├── ContentLayout (generic)
└── SimpleContentLayout
```

### Page Pattern (Per Collection)
Each content collection follows a consistent two-file routing pattern:
- `src/pages/{collection}/index.astro` — List page: `getCollection()` → filter → render `ContentCard` grid + `TagCloud`
- `src/pages/{collection}/[...slug].astro` — Detail page: `getStaticPaths()` + `getEntry()` + `render()`

### Path Aliases (from `tsconfig.json`)
Always use these aliases for imports:
```
~/*          → src/*
@components/ → src/components/
@layouts/    → src/layouts/
@pages/      → src/pages/
@styles/     → src/styles/
@utils/      → src/utils/
@data/       → src/data/
@assets/     → src/assets/
@images/     → src/assets/images/
@services/   → src/services/
@adapters/   → src/adapters/
@contracts/  → src/contracts/
```

### YAGNI-Driven Scaffolding (ADR-0004)
`src/adapters/`, `src/services/`, and `src/contracts/` exist as **intentionally empty placeholder files**. Do NOT populate them unless concrete triggers are met:
- Same logic duplicated in 3+ places
- Materially complex auth rules
- A real external API boundary
- A second active data source

Use Astro content APIs (`getCollection`, `getEntry`, `render`) directly in routes as the default approach.

### ADRs
Four formal Architecture Decision Records exist in `plans/adrs/` (MADR format):
- **0001**: Obsidian-first content architecture
- **0002**: Homepage story-first pattern (narrative landing, not navigation index)
- **0003**: Astro Image component policy (`<Picture>` for hero/banner, `<Image>` for inline/cards)
- **0004**: Campaigns native content access (no premature abstractions)

Read these before making architectural changes. New significant decisions should follow the same MADR format.

---

## Content Model (Detailed)

### Base Schema (all collections except `pages`)

| Field          | Type                                                         | Required | Default    |
| -------------- | ------------------------------------------------------------ | -------- | ---------- |
| `status`       | `'draft' \| 'publish' \| 'published' \| 'archive' \| 'archived'` | Yes      | —          |
| `author`       | `string`                                                     | Yes      | —          |
| `secret`       | `boolean`                                                    | Yes      | —          |
| `created`      | `coerce.date()`                                              | No       | —          |
| `created-date` | `coerce.date()`                                              | No       | — (legacy) |
| `modified`     | `coerce.date()`                                              | No       | —          |
| `modified-date`| `coerce.date()`                                              | No       | — (legacy) |
| `tags`         | `string[]`                                                   | No       | `[]`       |
| `campaign`     | `string`                                                     | No       | —          |
| `permissions`  | `'public' \| 'player' \| 'gm' \| 'author'`                  | No       | `'public'` |
| `parentChain`  | `Array<{ label, href }>`                                     | No       | —          |
| `relationships`| `Array<{ label, href, kind?, reason? }>`                     | No       | —          |

### Per-Collection Extensions

Each collection adds `title` (required), `type` enum (required), and `excerpt` (optional), plus collection-specific fields:

| Collection   | Type Enum Values                                                                    | Extra Fields                  |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------- |
| **Lore**     | `mythology`, `history`, `geography`, `culture`, `language`, `warfare`, `domestication`, `magic`, `technology`, `structure`, `other` | — |
| **Places**   | `location`, `landmark`, `dungeon`, `settlement`, `region`, `inhabitants`, `water`   | `coordinates: { x, y }`      |
| **Sentients**| `race`, `species`, `culture`, `organization`, `deity`                               | `alignment`                   |
| **Bestiary** | `monster`, `beast`, `spirit`, `construct`, `elemental`                              | `challengeRating: number`     |
| **Flora**    | `tree`, `flower`, `fungus`, `herb`, `plant`                                         | —                             |
| **Factions** | `guild`, `criminal`, `government`, `religion`, `military`, `police`, `school`, `order` | `alignment`                |
| **Systems**  | `magic`, `combat`, `skill`, `economy`, `social`                                     | —                             |
| **Campaigns**| `campaign`, `adventure`, `quest`, `story`                                           | `status` (overridden: `planning \| active \| completed \| on-hold \| cancelled`), `start`, `end` |
| **Sessions** | `session`, `encounter`, `battle`, `roleplay`                                        | `campaign` (required), `date`, `duration` |
| **Meta**     | *(no type field)*                                                                   | —                             |
| **Pages**    | *(standalone schema, no base fields)* — `title`, `description`, `tldr`              | —                             |

### Campaign/Session Structure

Campaigns and sessions load from the **same base directory** (`src/content/campaigns/`) using complementary glob patterns:
- `campaigns` collection: `['**/*.md', '!**/sessions/*.md']` — everything except session files
- `sessions` collection: `*/sessions/*.md` — only session files

File structure:
```
src/content/campaigns/
  sample-campaign/
    index.md              ← campaign entry
    sessions/
      session-01.md       ← session entry (requires campaign: "sample-campaign")
```

---

## Relationships & Navigation — Core Product Concern

Relationships between content entries are a **first-class product feature**, not an afterthought. The schema, rendering, and UX design all treat them as central to the user experience.

### `parentChain` — Hierarchical Breadcrumbs
Array of `{ label: string, href: string }`. Represents containment hierarchy (e.g., Nation > Province > Settlement). Rendered as a breadcrumb navigation bar in `WorldAletheiaContentHeader.astro`.

### `relationships` — Cross-References
Array of `{ label: string, href: string, kind?: 'partOf' | 'connectedTo', reason?: string }`.

- **`partOf`**: hierarchical containment (a city is part of a region)
- **`connectedTo`**: lateral association (a faction is connected to a location). This is the implicit default when `kind` is omitted.

Rendered in `WorldAletheiaContentHeader` as a "Related in the world" panel with two subsections. Also rendered by `RelatedContent.astro` component with cards grouped by relationship kind.

### Current State
The schema and rendering are fully implemented, but **no content files currently populate these fields**. This is infrastructure ready for active use. When adding or modifying content, populating `parentChain` and `relationships` is encouraged.

### Future Direction
Planned enhancements include relationship-grouped recommendations on discovery cards, containment breadcrumb chains, associative link types (allegiance, allied with, opposed by, located near, appears in campaign), and relationship graph navigation.

---

## Search, Filtering, Sorting, Grouping

These capabilities are central to the product vision. Current state and direction:

| Capability          | Current State                                                        | Planned Direction                              |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| **Search**          | Fuse.js installed but unused; `/search` route linked but doesn't exist | Pagefind static search integration             |
| **Filter by type**  | Not implemented; all index pages show a "future-ready" banner        | Multi-facet filtering UI with state persistence |
| **Filter by status**| Inline `status === 'publish'` checks in each index page             | Centralize via `content-filter.ts`             |
| **Sort**            | Date-based on homepage and sessions only                             | Alphabetical, recency, grouped views           |
| **Group by type**   | Not implemented                                                      | Type-based grouping on index pages             |
| **Tags**            | `TagCloud` component renders tags; `/tags/*` routes don't exist      | Tag-based filtering and tag index pages        |

`src/utils/content-filter.ts` provides `shouldIncludeContent()`, `getFilteredCollection()`, `getAuthorEntries()`, and `getCampaignEntries()` — but **index pages currently use inline filtering instead**. Centralizing filtering through this utility is a desired improvement.

---

## Styling & Theming

### Theme System
Four DaisyUI themes using OKLCH color space:
- `savanna-days` — light (default)
- `lake-days` — light (alternate)
- `savanna-nights` — dark
- `jungle-nights` — dark

Theme persistence: `localStorage` key `aletheia-theme`. An inline `<script is:inline>` in `BaseLayout` sets `data-theme` on `<html>` before paint to prevent FOUC. Theme pickers use `.js-theme-picker` class selector.

### Design Tokens
- **Backgrounds**: `paper-*` palette
- **Text**: `ink-*` palette
- **Accent**: `primary-*` (bronze), `dusty-*` (rose), `warm-stone-*` (earthy neutral)
- **Semantic**: `success-*`, `warning-*`, `danger-*`, `info-*`

### Fonts
- **Body & headings**: Lora (serif)
- **UI elements**: Inter (sans-serif)

### CSS Architecture
- `src/styles/global.css` is the **authoritative** stylesheet (imported by BaseLayout)
- Uses Tailwind v4 `@theme {}` block for design tokens
- Uses `@plugin "daisyui/theme"` for each theme definition
- Theme-specific overrides use `[data-theme='...']` selectors
- Custom utility classes: `.reading-prose`, `.content-container`, `.meta-muted`, `.tag-chip`, `.content-card`, `.nav-readable`, `.focus-ring`
- A root-level `global.css` exists but is an older version without DaisyUI — prefer `src/styles/global.css`

---

## Naming Conventions

| Context                   | Convention    | Examples                                             |
| ------------------------- | ------------- | ---------------------------------------------------- |
| Astro components/layouts  | PascalCase    | `ContentCard.astro`, `WorldAletheiaContentLayout.astro` |
| Page files                | kebab-case    | `aletheia-world-canon.astro`, `[...slug].astro`      |
| TypeScript variables/fns  | camelCase     | `pickCreated`, `shouldIncludeContent`, `getFilteredCollection` |
| TypeScript types/interfaces| PascalCase   | `DiscoveryItem`, `Props`, `HeroImageProps`           |
| Zod schema variables      | camelCase     | `baseSchema`, `loreSchema`, `campaignsSchema`        |
| CSS classes (custom)      | kebab-case    | `content-card`, `tag-chip`, `hero-image-title`       |
| CSS custom properties     | `--color-*`, `--font-*` | `--color-paper-500`, `--font-family-body`  |
| Script files              | kebab-case `.mjs` | `fs-diff.mjs`, `apply-sync.mjs`, `git-stage.mjs` |
| JSON data keys            | snake_case    | `spell_name`, `casting_roll`, `full_cost`            |
| DaisyUI themes            | kebab-case    | `savanna-days`, `jungle-nights`                      |
| Content files (markdown)  | Title Case with spaces or kebab-case | `The Calendar of Aletheia.md`, `sample.md` |

### Component Conventions
- Props defined with `interface Props` in the frontmatter fence (not always exported)
- Default values via destructuring: `const { tags, maxTags = 10 } = Astro.props;`
- Backward-compat data access: `const data = content.data || content;`
- Always use path alias imports: `import Layout from '@layouts/MainSiteLayout.astro';`

---

## Commit Conventions

- Lowercase, action-oriented descriptions (no conventional commit prefixes for manual commits)
- Content sync commits use: `chore(content): sync Obsidian content`
- No PR/issue references in commit messages
- Examples:
  - `add assets folder and move images inside assets folder`
  - `refactor to simplify using Astro content collections`
  - `significant UI and some UX refactoring`

---

## Content Sync Pipeline

The `scripts/content-sync/` directory contains a standalone Node.js ESM pipeline for syncing Obsidian vault content into the repo:

| Module            | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `index.mjs`       | Entry point, CLI argument parsing, orchestration  |
| `config.mjs`      | Loads & validates `config/content-sync.config.json` |
| `fs-diff.mjs`     | Compares vault vs repo, builds diff report        |
| `apply-sync.mjs`  | Applies file changes (copy/delete/backup)         |
| `validate.mjs`    | Validates frontmatter and markdown quality        |
| `git-stage.mjs`   | Git operations (pull, commit, push)               |
| `prompt.mjs`      | Interactive CLI prompts (stale file decisions)     |
| `utils.mjs`       | Logging helpers with support codes                |

Scripts use only Node.js built-ins (`node:fs/promises`, `node:path`). Debug mode: `CONTENT_SYNC_DEBUG=1`. Error support codes follow the pattern `CONFIG-MISSING`, `VALIDATION-FAILED`, etc.

Config location: `config/content-sync.config.json` (gitignored, user-specific). Example at `config/content-sync.config.example.json`.

---

## Worldbuilding Charter

The file `aletheia-worldbulding-charter.md` defines **immutable canon constraints** for the world of Aletheia. Any agent working on content, lore-adjacent features, or narrative elements should be aware of these core principles:

- **Grounded medieval realism** — believable hierarchies, practical daily life, political tension
- **Not grimdark** — life is hard but not hopeless; heroism and reform are possible
- **Magic's Burden** — magic is powerful, costly, politically sensitive; never casual
- **The Lattice** — all magic operates through a non-sentient metaphysical structure
- **The Cataclysm** — a distant catastrophic magical collapse that shapes all institutions
- **Social inequality** — class, education, institutions shape lives more than individual virtue
- **Polytheistic religion** — gods are real, worship is practical/situational
- **Living memory** — long-lived peoples retain direct Cataclysm memory

The charter is a **constraint framework**, not a campaign outline. It defines what kind of world Aletheia is.

---

## Key Files Reference

| File                               | Purpose                                          |
| ---------------------------------- | ------------------------------------------------ |
| `astro.config.mjs`                 | Astro framework configuration                    |
| `src/content.config.ts`            | All 11 collection schemas (Zod + glob loaders)   |
| `tsconfig.json`                    | TypeScript config with path aliases               |
| `wrangler.jsonc`                   | Cloudflare Workers/Pages deployment config        |
| `src/styles/global.css`            | Authoritative CSS (Tailwind v4 + DaisyUI themes)  |
| `src/utils/content-filter.ts`      | Content filtering utilities                       |
| `scripts/content-sync/index.mjs`   | Content sync pipeline entry point                 |
| `plans/adrs/`                      | Architecture Decision Records (MADR format)       |
| `plans/`                           | Implementation planning docs & checklists         |
| `aletheia-worldbulding-charter.md` | Immutable world canon constraints                 |
| `docs/content-ingestion-user-guide.md` | User guide for Obsidian sync workflow         |

---

## Future Direction

The project is evolving through planned phases:

1. **Foundation** (largely complete) — Astro site, content collections, sync pipeline, layouts, theming
2. **CI/CD** (in progress) — GitHub Actions, multi-environment Cloudflare deployment
3. **Search & Discovery** — Pagefind search, tag filtering, breadcrumbs, table of contents, cross-collection relationship resolution
4. **UI/UX & Relationship Navigation** — Typography refinements, relationship panels, containment breadcrumbs, metadata policy changes, relationship-grouped recommendations
5. **Progressive Interactivity (Campaigns only)** — Astro Islands for live session stats, initiative tracker, campaign timeline filter; Canon and Using domains remain fully static
6. **Permissions & Authentication** — Better Auth with Cloudflare D1, Discord OAuth, hierarchical permissions (world → campaign → content level)
7. **Campaigns Domain Extraction** — Adapter boundaries, strangler migration pattern, portable contracts (triggered only when concrete criteria are met)

---

## Known Gaps

- **No linting or formatting config** — no ESLint, Prettier, or EditorConfig
- **No CI/CD pipeline** — GitHub Actions planned but not yet configured
- **No test files** — Vitest is configured (`pnpm test`) but no `*.test.*` files exist
- **`content-filter.ts` is unused** — index pages inline their own `status === 'publish'` checks instead of using the centralized utility
- **Dead links in UI** — `/search` and `/tags/*` routes are linked in Footer/TagCloud but don't exist as pages
- **`review` status mismatch** — handled in `content-filter.ts` but not present in any Zod schema enum
- **Meta design doc vs. schema divergence** — the `Content Model of Aletheia Site.md` meta document proposes type values that differ from the Zod schemas in `content.config.ts`; the Zod schema is the runtime source of truth

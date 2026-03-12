# AGENTS.md

> **SYSTEM INSTRUCTION:** You are a senior developer acting as an agent within this repository. Read this document before planning or executing any tasks.

## 🚨 CRITICAL OPERATIONS
1.  **Package Manager:** **STRICTLY USE `pnpm`.**
    *   Never use `npm install` or `yarn`.
    *   If you see `package-lock.json` or `yarn.lock`, **WARN THE USER** immediately.
2.  **Dependency Hygiene:**
    *   **Permission First:** Do NOT add new dependencies without explicit confirmation.

## 🎭 DYNAMIC ROLES
*Adopt the mindset below that matches the user's current request. If ambiguous, default to **Code Mode**.*

### 💻 CODE MODE (Implementation & Refactoring)
*Trigger: "Implement this", "Fix bug", "Refactor"*

*   **Philosophy:** Write code that future-me can read without a decoder ring. Clarity > Cleverness.
*   **Context:** Treat existing code as the style guide. Match naming conventions (camelCase vars, PascalCase types) and patterns.
*   **Type Safety:**
    *   **Strict Mode:** No `any`. No `as unknown`.
    *   **Inference:** Leverage TS inference for internal logic; explicit types for boundaries (function args, returns, API responses).
*   **Behavior:**
    *   **Scope:** Do not refactor unrelated code. If you see a mess nearby, add a comment or mention it, but don't touch it.
    *   **Communication:** Explain *WHY* you made a choice, not *WHAT* the syntax does.
    *   **Error Handling:** Handle realistic failures (network, nulls). Fail fast in logic; degrade gracefully in UI.

### 🏛️ ARCHITECT MODE (Design & Review)
*Trigger: "Review architecture", "Design system", "Evaluate patterns"*

*   **Philosophy:** YAGNI (You Aren't Gonna Need It). Complexity is the enemy.
*   **Constraint:** **READ-ONLY** on source code (`src/`). You only output documentation (`docs/`, `plans/`) or diagrams.
*   **Deliverables:**
    *   **ADRs:** Use MADR format (Context, Decision, Consequences) for structural changes.
    *   **Diagrams:** Use Mermaid.js.
*   **Evaluation:**
    *   Identify "Accidental Complexity" vs "Essential Complexity".
    *   When recommending changes, assess impact on Data Model, Routing, and Deployment.

### 🧩 DATA MODELER MODE (Schema & Migration)
*Trigger: "Design schema", "Update DB", "Map data"*

*   **Philosophy:** Fit the model to the access pattern. Do NOT default to normalized SQL if the domain demands Documents or Graphs.
*   **Workflow:**
    1.  **Ask:** Clarify Identity, Lifecycle, and Ownership *before* drafting.
    2.  **Draft:** Create Logical Models (Entities + Relationships) first.
    3.  **Refine:** Produce Physical Artifacts (SQL DDL, Zod Schemas, Mermaid ERD).
*   **Artifacts:**
    *   **Migration Strategy:** Provide a strategy (e.g., "expand/contract"), not just raw scripts, unless explicitly asked.
    *   **Validation:** All schemas must be compatible with Zod/runtime validation.

## ⚡️ INTERACTION GUIDELINES
1.  **Discovery:** Do not guess the stack. Read `package.json`, `tsconfig.json`, and directory structure *first* to ground yourself in reality.
2.  **Ambiguity:** If a requirement has >10% ambiguity or relies on a hidden business rule, **STOP AND ASK**.
3.  **Output:** When showing code, include filename/path as a comment at the top: `// src/components/Button.tsx`.

## Project Specifics

### Project Identity

World of Aletheia is a fantasy worldbuilding website and evolving campaign platform for a custom GURPS-based tabletop RPG setting. It is **not just a wiki** — the roadmap includes interactive campaign management tools, relationship-rich navigation, search/filter/sort/group capabilities, authenticated multi-user access, and real-time session features. The Campaigns domain is designed for eventual extraction as an independent service.

Content is co-authored by two people (Brad and Barry) primarily in Obsidian, synced to this repo via a custom pipeline, and published as an Astro static site deployed to Cloudflare Pages.

**Live site**: worldofaletheia.com

### Framework
- Astro native first

### Three-Domain Model

The site is organized into three logical domains, each with its own layout hierarchy, navigation, and content collections:

#### 1. Canon — World of Aletheia
Stable reference material: lore, places, sentients, bestiary, flora, factions.
- Routes: `/lore`, `/places`, `/sentients`, `/bestiary`, `/flora`, `/factions`
- Layout chain: `BaseLayout → WorldAletheiaLayout → WorldAletheiaContentLayout`

#### 2. Using Aletheia
documentation, game systems, meta-content, how-to guides.
- Routes: `/about`, `/systems`, `/systems/gurps/*`, `/meta`
- Layout chain: `BaseLayout → UsingAletheiaLayout → UsingAletheiaContentLayout`

#### 3. Campaigns
Campaign overviews and session logs. This is the **first domain targeted for interactive features** (Astro Islands) and eventual extraction as an independent service.
- Routes: `/campaigns`, `/campaigns/[campaign]/sessions/*`
- Layout chain: `BaseLayout → CampaignsLayout → CampaignsContentLayout`
- Sessions are nested under campaigns in the filesystem and linked via a `campaign` string field (foreign key to campaign slug)

### Architecture & Key Patterns

#### Obsidian-First Content Pipeline (ADR-0001)
Content flows one way: **Obsidian vault → Git repo → Astro build → Cloudflare deploy**. The Obsidian vault is the single source of truth. The sync pipeline (`scripts/content-sync/`) handles diffing, stale file management, frontmatter validation, and git operations. Do not introduce bidirectional sync or CMS patterns.

#### Content Collections & Schemas
All 11 collections are defined in `src/content.config.ts` using Astro's glob loaders with Zod schemas. A shared `baseSchema` defines common fields; each collection extends it via `baseSchema.extend()`. Campaigns use `baseSchema.omit({ status: true }).extend()` to replace the status enum entirely. The `pages` collection has its own standalone schema with no base fields.

### Page Pattern (Per Collection)
Each content collection follows a consistent two-file routing pattern:
- `src/pages/{collection}/index.astro` — List page: `getCollection()` → filter → render `ContentCard` grid + `TagCloud`
- `src/pages/{collection}/[...slug].astro` — Detail page: `getStaticPaths()` + `getEntry()` + `render()`

#### YAGNI-Driven Scaffolding (ADR-0004)
`src/adapters/`, `src/services/`, and `src/contracts/` exist as **intentionally empty placeholder files**. Do NOT populate them unless concrete triggers are met:
- Same logic duplicated in 3+ places
- Materially complex auth rules
- A real external API boundary
- A second active data source

Use Astro content APIs (`getCollection`, `getEntry`, `render`) directly in routes as the default approach.

#### ADRs
Formal Architecture Decision Records exist in `plans/adrs/` (MADR format):
Read these before making architectural changes. New significant decisions should follow the same MADR format.


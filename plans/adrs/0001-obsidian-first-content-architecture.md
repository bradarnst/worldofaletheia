# Obsidian-First Content Architecture

## Status

- **Date:** 2026-02-11
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

The World of Aletheia project maintains content in two places: an Obsidian vault for authoring and a Git repository for the Astro website. Currently, content is manually copied between these systems, leading to:

- **Sync drift**: Content becomes inconsistent between Obsidian and the website
- **Double maintenance**: Updates require changes in both systems
- **Format fragmentation**: Obsidian uses wiki-links and plugins; Astro uses frontmatter and markdown
- **Metadata loss**: Obsidian-specific features (tags, backlinks, canvas) don't translate to the web

We need a clear source-of-truth strategy that:
1. Preserves the Obsidian authoring experience
2. Enables automated website generation
3. Maintains content integrity across systems
4. Supports future extraction of the Campaigns domain

## Decision Drivers

- **Authoring velocity**: Writers should use familiar Obsidian tools without web-dev friction
- **Content portability**: Content should not be locked into proprietary formats
- **Build reliability**: The website build should not break due to content structure changes
- **SEO and performance**: Web output must remain optimized
- **Future extraction**: Campaigns domain may become a separate service

## Considered Options

### Option 1: Obsidian as Source of Truth (Chosen)

Obsidian vault is the primary authoring system. Content is ingested into Astro with minimal transformation.

**Approach:**
- Maintain canonical content in Obsidian vault
- Use YAML frontmatter for structured metadata
- Ingest via Astro's content collections with custom loaders
- Store pass-through metadata for Obsidian-specific features
- Git-sync the vault or use export scripts

**Pros:**
- Writers work in their preferred environment
- Obsidian plugins (dataview, graph view) remain functional
- Content remains portable (plain markdown + YAML)
- Minimal transformation reduces ingestion errors
- Bases views and other Obsidian features preserved

**Cons:**
- Requires discipline in frontmatter schema compliance
- Wiki-links need resolution during ingestion
- Binary assets (images) need path translation
- Requires export/sync workflow

### Option 2: Git Repository as Source of Truth

The Astro content folder (`src/content/`) is canonical. Writers edit markdown files directly or via a CMS.

**Approach:**
- Content lives in `src/content/` as markdown files
- Writers use Git workflow or headless CMS
- Obsidian vault is a read-only mirror or abandoned

**Pros:**
- Simple build pipeline (no ingestion step)
- Git history tracks all changes
- Direct control over file structure

**Cons:**
- Writers need Git knowledge or CMS access
- Loses Obsidian's local-first, offline-capable workflow
- Friction for quick edits and brainstorming
- Breaks existing Obsidian-based workflows

### Option 3: Bidirectional Sync

Maintain sync between Obsidian vault and Git repository in both directions.

**Approach:**
- Changes in Obsidian sync to Git
- Changes in Git sync to Obsidian
- Conflict resolution required

**Pros:**
- Flexibility for different workflows
- Writers can use either interface

**Cons:**
- Complex sync logic
- Merge conflicts likely
- Risk of data loss
- Difficult to maintain

### Option 4: API-Based CMS

Replace Obsidian with a headless CMS (Strapi, Sanity, etc.).

**Approach:**
- Content stored in CMS database
- Astro fetches via API at build time
- Rich editor for non-technical writers

**Pros:**
- Structured content validation
- Role-based access control
- Asset management

**Cons:**
- Vendor lock-in
- Hosting costs
- Loses Obsidian's graph view and local files
- Overkill for current scale

## Decision Outcome

**Chosen option:** Option 1 - Obsidian as Source of Truth

The Obsidian vault remains the primary authoring environment. Content is ingested into Astro with minimal transformation, preserving the writer's workflow while enabling automated website generation.

### Implementation Details

1. **Content Contract**: Define canonical frontmatter fields that map to Astro schemas
2. **Ingestion Pipeline**: Astro loaders read from `src/content/` (synced from vault)
3. **Pass-Through Metadata**: Unsupported Obsidian fields are preserved in `meta` objects
4. **File Ownership**: Two global co-authors for shared content; campaign-level overrides allowed
5. **Error Policy**: Warn on non-critical schema drift; fail on route identity breakage

## Consequences

### Positive

- Writers continue using Obsidian without workflow disruption
- Content remains portable (markdown + YAML)
- Minimal transformation reduces bugs
- Obsidian Bases compatibility maintained
- Clear separation: Obsidian for authoring, Astro for publishing

### Negative

- Requires manual or scripted sync from vault to repo
- Writers must follow frontmatter conventions
- Wiki-links need processing during ingestion
- Image paths need translation

### Neutral

- Git history will reflect sync commits, not original authoring
- Content changes require two-step process (Obsidian → Git → Deploy)

## Validation

This decision is validated by:

1. **Existing workflow preservation**: Writers don't need to change tools
2. **Build success**: Astro can ingest Obsidian markdown without errors
3. **Content integrity**: Round-trip (Obsidian → Astro → display) preserves meaning
4. **Future extraction**: Campaigns domain can be extracted without content migration

## Links

- [MADR Project](https://adr.github.io/madr/)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Obsidian Publish](https://obsidian.md/publish) (alternative we chose not to use)
- Related: [Campaigns Architecture Implementation](../campaigns-architecture-implementation-checklist.md)

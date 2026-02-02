# Content Publishing System Implementation Tasks

This task list covers the complete implementation of the content publishing system for World of Aletheia, organized by priority and dependency order.

## Phase 1: Foundation (Immediate)

### Astro Content Collections Setup
- [ ] Create `src/content/config.ts` with all 8 collection definitions using Zod validation
- [ ] Implement base frontmatter schema with status, author, created, secret, tags, campaign, and permissions fields
- [ ] Add collection-specific schemas for lore, places, sentients, creatures, factions, systems, campaigns, and sessions
- [ ] Verify all schemas include `status: 'draft' | 'published' | 'archived'` and `secret: boolean` fields

### Content Structure & Migration
- [ ] Create the complete folder structure in `src/content/` with all 8 collections
- [ ] Create migration script to copy Obsidian vault content to `src/content/` with frontmatter injection
- [ ] Implement wiki-link conversion from `[[wiki links]]` to standard Markdown links
- [ ] Set up vault configuration file (`vault.config.json`) with author-specific vault paths

### Content Filtering System
- [ ] Create `src/utils/content-filter.ts` with `shouldIncludeContent()` function
- [ ] Implement `getFilteredCollection()` utility for environment-aware content filtering
- [ ] Create `getAuthorEntries()` and `getCampaignEntries()` helper functions
- [ ] Add build-time filtering to all collection access points in page components

### Layouts & Components
- [ ] Create `src/layouts/ContentLayout.astro` for wiki-style content pages
- [ ] Create `src/layouts/CampaignLayout.astro` for campaign-specific content
- [ ] Build `src/components/ContentCard.astro` for content previews
- [ ] Create `src/components/RelatedContent.astro` with cross-collection reference resolution
- [ ] Implement `src/components/TagCloud.astro` for tag-based filtering

### Routing & Pages
- [ ] Create index pages for all 8 collections (`src/pages/lore/index.astro`, etc.)
- [ ] Implement dynamic `[...slug].astro` routes for all collection types
- [ ] Set up campaign-specific routing for sessions (`src/pages/campaigns/[campaign]/sessions/[...slug].astro`)
- [ ] Create homepage integration to showcase latest published content

## Phase 2: CI/CD & Deployment

### GitHub Actions Configuration
- [ ] Create `.github/workflows/deploy-production.yml` for main branch deployments
- [ ] Create `.github/workflows/deploy-preview.yml` for PR preview deployments
- [ ] Create `.github/workflows/validate-content.yml` for content validation
- [ ] Configure GitHub secrets for Cloudflare deployment credentials

### Cloudflare Configuration
- [ ] Update `wrangler.jsonc` with production, preview, and staging environments
- [ ] Configure Cloudflare routes for worldofaletheia.com and preview.worldofaletheia.com
- [ ] Set up Cloudflare assets configuration for static site hosting

### Build Process Integration
- [ ] Add `prebuild` script to `package.json` that runs content sync before builds
- [ ] Add `sync` script to `package.json` for manual vault synchronization
- [ ] Update `.gitignore` to ignore generated content folders while preserving config files

## Phase 3: Search & Discovery

### Pagefind Integration
- [ ] Install and configure `astro-pagefind` integration
- [ ] Create `pagefind.config.js` with proper filtering for published content only
- [ ] Build `src/pages/search.astro` with Pagefind UI integration
- [ ] Add search functionality to main site layout

### Site Navigation & Filtering
- [ ] Implement tag-based filtering on all collection index pages
- [ ] Create breadcrumbs component for hierarchical navigation
- [ ] Build table of contents component for long-form content
- [ ] Add author badge component to display author attribution
- [ ] Create status badge component to show draft/published/secret status

## Phase 4: Authentication & Permissions (Future)

### Authentication System Setup
- [ ] Research and select authentication library (Better Auth recommended)
- [ ] Set up Cloudflare D1 database for user management
- [ ] Create `src/lib/auth.ts` with authentication configuration
- [ ] Implement role-based permission system (public, player, gm, author)

### Auth-Integrated Content Access
- [ ] Modify content filtering to respect user permissions instead of just environment
- [ ] Create login/logout flows and authentication pages
- [ ] Build author-specific dashboard for content management
- [ ] Migrate secret content handling from build-time filtering to auth-based access control

## Phase 5: Obsidian Integration

### Vault Sync Automation
- [ ] Create `scripts/sync-vaults.ts` with complete vault scanning and processing logic
- [ ] Implement configurable secret handling (exclude, rename, or separate-folder)
- [ ] Add wiki-link resolution using `remark-wiki-link` plugin
- [ ] Implement image asset relocation and path rewriting
- [ ] Add validation for species/race/culture references against their respective collections

### Obsidian Plugin Configuration
- [ ] Document recommended Obsidian plugins for content management
- [ ] Create templates for each content type matching Astro schemas
- [ ] Set up Linter plugin for frontmatter auto-formatting
- [ ] Configure Templater plugin for content creation workflows

## Priority Order

1. Phase 1 Foundation (all items)
2. Phase 2 CI/CD & Deployment (all items)
3. Phase 3 Search & Discovery (all items)
4. Phase 5 Obsidian Integration (all items)
5. Phase 4 Authentication & Permissions (future work)
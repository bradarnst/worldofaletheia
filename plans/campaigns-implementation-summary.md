# Campaigns Architecture Implementation Summary

## Overview
This document outlines the implementation plan for treating **Campaigns** as a first-class internal domain within the single Astro project. The goal is to create modular boundaries now that allow for future extraction without over-engineering.

---

## Current State

### Content Structure (Flat)
```
src/content/
├── campaigns/
│   └── sample.md           # Campaign entries
└── sessions/
    └── sample.md           # Session entries (with campaign field)
```

### Current Issues
- Sessions exist as a separate top-level collection
- Direct `getCollection()` calls scattered across pages
- No service layer abstraction
- No typed DTOs or contracts
- No clear domain boundaries

---

## Target State

### Content Structure (Nested)
```
src/content/campaigns/
├── sample-campaign/
│   ├── index.md            # Campaign overview
│   └── sessions/
│       └── session-01.md   # Session notes nested under campaign
└── another-campaign/
    ├── index.md
    └── sessions/
        └── session-01.md
```

### Architecture Layers
```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ /campaigns  │ │ /campaigns/ │ │ /campaigns/:id/     │   │
│  │ /index      │ │ :id         │ │ sessions/:sessionId │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ CampaignService  │  │ CampaignRepository             │  │
│  │ (Query/Commands) │  │ (Interface: getById, list)     │  │
│  └──────────────────┘  └────────────────────────────────┘  │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ SessionService   │  │ SessionRepository              │  │
│  │ (Query/Commands) │  │ (Interface: getByCampaignId)   │  │
│  └──────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                     Adapter Layer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          AstroContentAdapter (current)                 │ │
│  │  - Reads from src/content/campaigns/**/*.md            │ │
│  │  - Transforms frontmatter to DTOs                      │ │
│  │  - Filters by permissions/environment                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Future: ApiAdapter or DbAdapter               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
src/
├── contracts/                    # DTOs and type definitions
│   └── campaigns/
│       ├── index.ts              # Export all types
│       ├── campaign.dto.ts       # Campaign DTOs
│       └── session.dto.ts        # Session DTOs
├── services/                     # Service interfaces and implementations
│   └── campaigns/
│       ├── index.ts              # Service exports
│       ├── campaign.service.ts   # Campaign service interface
│       ├── session.service.ts    # Session service interface
│       └── impl/                 # Implementations
│           └── astro-campaign.service.ts
├── adapters/                     # Data source adapters
│   └── campaigns/
│       ├── index.ts              # Adapter exports
│       ├── campaign.adapter.ts   # Campaign adapter interface
│       └── astro-content.adapter.ts
├── content/
│   └── campaigns/                # Nested campaign content
│       └── [campaign-slug]/
│           ├── index.md
│           └── sessions/
│               └── [session-slug].md
└── pages/
    └── campaigns/
        ├── index.astro           # Campaign list
        ├── [...slug].astro       # Campaign detail
        └── [campaign]/
            └── sessions/
                ├── index.astro   # Sessions list for campaign
                └── [...slug].astro  # Session detail
```

---

## Domain Model

### Three Primary Domains

| Domain | Purpose | URL Prefix | Content Types |
|--------|---------|------------|---------------|
| **World of Aletheia** | Canon lore, places, creatures | `/lore`, `/places`, `/creatures`, etc. | Reference material, stable |
| **Using Aletheia** | Meta-content, how-to guides | `/about`, `/systems` | Documentation, guides |
| **Campaigns** | Game sessions, campaign content | `/campaigns/**` | Ephemeral, permission-sensitive |

### Campaign Domain Entities

**Campaign**
- id/slug (unique identifier)
- title
- status: planning | active | completed | on-hold | cancelled
- type: campaign | adventure | quest | story
- start/end dates
- permissions: public | player | gm | author
- authors/owners
- excerpt/description

**Session**
- id/slug (unique within campaign)
- campaignId (parent campaign)
- title
- date
- duration
- type: session | encounter | battle | roleplay
- permissions: public | player | gm | author
- secret flag
- tags

---

## URL Strategy

### Route Ownership Map

| Route | Owner | Description |
|-------|-------|-------------|
| `/campaigns` | Campaigns | List all campaigns |
| `/campaigns/:slug` | Campaigns | Campaign detail page |
| `/campaigns/:slug/sessions` | Campaigns | List sessions for campaign |
| `/campaigns/:slug/sessions/:sessionId` | Campaigns | Session detail page |

### No Legacy Compatibility (Alpha Phase)
- Remove `/sessions/**` top-level routes
- No redirects needed during alpha
- All session content accessed through campaign context

---

## Data Contracts (DTOs)

### CampaignSummary
```typescript
interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  type: CampaignType;
  excerpt?: string;
  startDate?: Date;
  permissions: PermissionLevel;
  authors: string[];
  sessionCount: number;
}
```

### CampaignDetail
```typescript
interface CampaignDetail extends CampaignSummary {
  description: string;
  endDate?: Date;
  tags: string[];
  sessions: SessionSummary[];
  relatedContent: RelatedContent[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    sourcePath: string;
    lastIngestedAt: Date;
  };
}
```

### SessionSummary
```typescript
interface SessionSummary {
  id: string;
  slug: string;
  campaignSlug: string;
  title: string;
  date?: Date;
  duration?: number;
  type: SessionType;
  permissions: PermissionLevel;
  excerpt?: string;
}
```

### SessionDetail
```typescript
interface SessionDetail extends SessionSummary {
  content: string;  // Markdown body
  tags: string[];
  secret: boolean;
  relatedContent: RelatedContent[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    sourcePath: string;
    author: string;
  };
}
```

---

## Permissions Model

### Permission Levels
| Level | Access |
|-------|--------|
| `public` | Visible to all visitors |
| `player` | Campaign participants only |
| `gm` | Game masters only |
| `author` | Content authors only |

### Permission Evaluation
- Evaluated at service layer, not page level
- Environment-aware (dev shows more than prod)
- Secret content always filtered in production

---

## Obsidian-First Content Architecture

### Source of Truth
- Obsidian vault is the primary authoring system
- Markdown files consumed as-is with minimal transformation
- YAML frontmatter maps directly to schema fields

### Ingestion Pipeline
```
Obsidian Vault
      │
      ▼
Markdown + Frontmatter
      │
      ▼
Astro Content Loader (glob)
      │
      ▼
Adapter Normalization
      │
      ▼
DTOs → Service Layer → Pages
```

### Frontmatter Contract
Campaigns expect these frontmatter fields:
```yaml
---
title: "Campaign Title"
type: campaign
status: active
start: 2026-01-15
permissions: player
author: gm-name
secret: false
tags: [tag1, tag2]
excerpt: "Brief description"
---
```

Sessions expect:
```yaml
---
title: "Session Title"
type: session
campaign: campaign-slug
date: 2026-01-15
duration: 240
permissions: player
author: gm-name
secret: false
tags: [tag1, tag2]
---
```

---

## Extraction Readiness

### Adapter Boundary
The adapter layer ensures the data source can be swapped:
- `AstroContentAdapter` (current) - reads from filesystem
- `ApiAdapter` (future) - reads from REST API
- `DbAdapter` (future) - reads from database

### Contracts for Externalization
- Service interfaces are framework-agnostic
- DTOs are serializable plain objects
- No Astro-specific types leak through service boundary
- Permission checks centralized in service layer

---

## Implementation Phases

### Phase 1: Foundation
1. Create folder structure (services/, adapters/, contracts/)
2. Add path aliases to tsconfig
3. Reorganize content structure (nested sessions)
4. Update content.config.ts schemas

### Phase 2: Contracts & Services
1. Define DTO types
2. Create service interfaces
3. Implement Astro content adapter
4. Add permission normalization

### Phase 3: Page Refactoring
1. Refactor campaign pages to use services
2. Create nested session routes
3. Remove legacy /sessions routes

### Phase 4: Validation
1. Add contract tests
2. Verify domain isolation
3. Document extraction readiness

---

## Success Metrics

- [ ] Campaign routes have no direct dependency on Canon/Using internals
- [ ] 80%+ of Campaign data access goes through service interfaces
- [ ] No breaking URL changes during migration
- [ ] All session content accessible via `/campaigns/:slug/sessions/**`
- [ ] Service layer is testable without Astro runtime
- [ ] Adapter can be swapped without page changes

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Overengineering early | Keep adapters thin; ship value each phase |
| UX drift between domains | Shared shell contracts + design tokens |
| Contract churn | Versioned DTOs + compatibility tests |
| Content migration complexity | Gradual migration; keep existing content working |

---

## Next Steps

1. **Create folder structure** and path aliases
2. **Reorganize content** to nested campaign structure
3. **Define contracts** (DTOs and service interfaces)
4. **Implement adapter** for Astro content
5. **Refactor pages** to use service layer
6. **Add tests** for contract validation

Ready for implementation in Code mode.

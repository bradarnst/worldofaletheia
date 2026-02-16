# UI UX Readability and Relationship Navigation Plan

## Purpose
This revised plan focuses on text-first reading quality and fast scanning for a growing worldbuilding knowledge base.

Primary goals:
1. Make long-form reading comfortable on desktop and mobile
2. Improve skim speed with clear title and tag hierarchy
3. Treat relationship modeling and relationship UX as a core product function now
4. Keep architecture future-ready for filtering, sorting, grouping, and larger content volume
5. Improve visual tone without harming readability

## Current state and key constraints from reviewed code

Observed in [`global.css`](../global.css), [`ContentLayout`](../src/layouts/ContentLayout.astro), [`WorldAletheiaContentLayout`](../src/layouts/WorldAletheiaContentLayout.astro), [`ContentCard`](../src/components/ContentCard.astro), [`RelatedContent`](../src/components/RelatedContent.astro), [`GlobalNavigation`](../src/components/GlobalNavigation.astro), and screenshots in [`screenshots`](../screenshots).

### Confirmed pain points
- Long-form body text baseline remains effectively small for sustained reading for many users
- Heading rhythm is present but not fully tuned for dense prose scanning
- Cards expose metadata in a way that competes with core reading signal
- Visible publish status is redundant in public list contexts
- Relationship UX is underdeveloped and mostly implicit
- Navigation lacks search and filters now, but immediate requirement is future-ready IA rather than full feature rollout

## Strategic product decisions

### Metadata policy now
- Keep and emphasize tags as first-class scan signals in cards and article headers
- Remove visible publish status from user-facing cards and article metadata on public pages
- Keep date and recency as secondary metadata only
- Treat tag cloud as optional, not default

### Discovery scope now versus later
- Do not implement full search, filtering, sorting, or quick-find UI now
- Implement component and IA structure so future filters by type, subtype, and tag can be added without redesign
- Ensure list models and card anatomy support alphabetical sorting and grouped views later

### Relationship UX policy
- Relationship model and relationship surfaces are core in this phase
- Introduce simple relationship patterns now
- Defer advanced graph exploration and multi-hop tooling until content volume and data quality justify it

## Typography decision revision

Readability remains top priority, but genre fit for fantasy gaming is nearly equal priority.

### Revised font recommendation
Keep a serif-led editorial voice, but avoid cliché fantasy display aesthetics.

Candidate ranking for body text:
1. Source Serif 4 as first test candidate
2. Literata as second test candidate
3. Newsreader as fallback candidate if first two feel either too academic or too stylized
4. Lora retained as fallback only if readability and tone testing outperform alternatives after spacing changes

Heading strategy:
- Keep heading serif restrained and modern
- Avoid decorative fantasy forms
- If Lora fails tone or spacing tests, test a neutral heading option with either Source Serif 4 semibold or Inter semibold for UI-heavy sections

UI font strategy:
- Keep Inter for controls, nav, chips, and utility metadata

Decision criteria:
1. Long paragraph comfort
2. Heading to body harmony
3. Genre fit that signals serious worldbuilding, not themed ornamentation
4. Mobile rendering consistency

## Relationship UX model to introduce now

### Relationship types in scope now
- Hierarchical containment
  - person to settlement
  - settlement to province
  - province to nation
- Associative links
  - allegiance to faction
  - allied with
  - opposed by
  - located near
  - appears in campaign

### Immediate relationship UI patterns
1. Article relationship panel
   - Add a compact block near article header titled Related in the world
   - Split into two lists: Part of and Connected to
   - Each row includes relation label and destination link

2. Breadcrumb-like world chain
   - On applicable articles, show one clear containment chain
   - Example pattern: Nation > Province > Settlement

3. Relationship cards section near article end
   - Replace generic related list with grouped relationship sections
   - Show short reason labels such as Same province or Political allegiance

4. Discovery page relationship hints
   - On content cards, include up to two compact relationship chips
   - Keep tags visually stronger than relationship chips

### Deferred relationship complexity
- Multi-hop graph explorer
- Complex edge weighting controls
- User-selectable relationship query builder
- Dense network visualizations

## Immediate actions and deferred actions

## Immediate actions next

### A. Readability foundation
1. Increase long-form body typography baseline
   - Target article body around 17px mobile and 18px desktop equivalent
   - Increase line-height toward 1.72 to 1.8 for paragraphs
2. Constrain article measure with character width target
   - Target approximately 65ch to 72ch depending on breakpoint
3. Tighten heading spacing rhythm
   - Improve heading margin logic so section boundaries scan quickly

### B. Metadata and card hierarchy
4. Remove visible publish status on public card and article contexts
   - Update [`ContentCard`](../src/components/ContentCard.astro)
   - Update [`RelatedContent`](../src/components/RelatedContent.astro)
   - Update article header metadata in layouts where status is shown
5. Elevate tags as primary scan metadata
   - Increase visual differentiation and consistency of tag chips
   - Keep date smaller and secondary

### C. Relationship UX first release
6. Introduce reusable RelationshipPanel component
   - Sections: Part of and Connected to
   - Supports relation label plus destination title
7. Add containment breadcrumb pattern on applicable articles
8. Replace generic related content block with relationship-grouped recommendations

### D. Future-ready IA without full filtering UI
9. Standardize card data contract for future filters and sorting
   - Ensure fields exist for type, subtype, tags, title, and relation hints
10. Structure index page toolbar container now as placeholder
   - Include non-functional or minimal hook-ready shell for future search and filter controls
   - No full search/filter interaction yet

### E. Visual style refinement without noise
11. Add subtle section color variation using existing tokens
12. Include imagery now in controlled form
   - Add section hero or title image on key section index pages
   - Add optional small thumbnail slot on discovery cards
   - Allow placeholder images first, then replace with final curated assets
13. Keep imagery tasteful and sparse to preserve text-first reading

## Deferred actions
- Full search with fuzzy matching
- Multi-facet filtering UI and state persistence
- Sorting controls including alphabetical and recency toggle
- Grouped discovery experiences by type and subtype
- Advanced relationship graph navigation
- Automatic relevance ranking optimization

## Specific UI changes to make next

1. Article pages
   - Increase body size and line-height
   - Improve heading spacing rhythm
   - Add containment breadcrumb where data exists
   - Add Related in the world panel near top
   - Keep tags visible and stronger
   - Remove visible publish status

2. Card components
   - Title first
   - One concise excerpt line group
   - Tags prominent and consistent
   - Date secondary
   - Remove status badge in public contexts
   - Add optional relationship chips and optional thumbnail slot

3. Related content experience
   - Group by relationship reason rather than generic similarity only
   - Show reason labels that explain why item is connected

4. Index pages
   - Keep current simplicity
   - Prepare toolbar zone for future search and filters
   - Keep tag cloud optional and low priority

## Impact and effort ranking for immediate phase

### High impact and low to medium effort
1. Body readability adjustments
2. Tag prominence plus status removal
3. Card hierarchy cleanup

### High impact and medium effort
4. RelationshipPanel and containment breadcrumb
5. Relationship-grouped related content

### Medium impact and low effort
6. Semantic color normalization where hardcoded gray remains
7. Optional image slot scaffolding

### Medium impact and medium effort
8. Future-ready toolbar shell and normalized discovery data contract

## Implementation-ready sequence

Phase 1
- Typography baseline and measure updates
- Tag prominence and status removal
- Card hierarchy simplification

Phase 2
- RelationshipPanel
- Containment breadcrumb
- Relationship-grouped related content

Phase 3
- Future-ready discovery scaffolding for type subtype tag filter architecture
- Toolbar placeholder pattern on index pages

Phase 4
- Visual polish with subtle palette variation and selective imagery
- Font finalization after readability and tone checks

## Acceptance criteria for this revised scope
- Reading comfort is noticeably improved on long articles across desktop and mobile
- Tags are clearly visible and scannable on cards and article views
- Publish status is no longer shown in public-facing metadata
- Relationship structure is visible and understandable on article pages
- Related content explains connection reasons clearly
- Current IA does not block future filters by type subtype tag, grouped views, and alphabetical sorting
- Visual style gains variety without reducing text-first clarity

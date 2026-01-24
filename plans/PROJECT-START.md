# PROJECT-START.MD

## Project Overview

Create a comprehensive fantasy world-building website that serves as the central hub for a custom tabletop RPG setting. The site will host lore, locations, characters, factions, magic systems, and other world-building content. This main site will integrate with an existing spell index project (currently being deployed separately) and will be built with scalability and content management in mind from the start.

## Technical Stack

### Core Framework
- **Astro 5.x** with static site generation (SSG) as primary mode
- Hybrid rendering capability for future authenticated features (GM tools, player resources)
- File-based routing for content organization

### Styling and UI
- **Tailwind CSS 4.x** with custom fantasy-themed design tokens
- **DaisyUI** component library for consistent UI patterns from day one
- Custom color palette using parchment/ink aesthetic (similar to spell index site)
- Typography: Lora for body text and headings, Inter for UI elements
- Responsive design with mobile-first approach

### Content Management
- **Astro Content Collections** for structured markdown content
- Frontmatter schemas for different content types (locations, characters, factions, lore entries, etc.)
- MDX support for interactive components within content
- Asset management for maps, character portraits, and illustrations

### Search and Discovery
- **Pagefind** for static site search across all content types
- Tag-based filtering and categorization
- Cross-referencing system between related content pieces

### Authentication (Future Phase)
- **Better Auth** for user management when needed
- Role-based access for GM-only content and player resources
- Session management for campaign-specific features

### Deployment
- Static hosting (Netlify, Vercel, or Cloudflare Pages)
- Automated builds on content updates
- Preview deployments for content review

## Content Architecture

### Primary Content Types

**Locations**
- Regions, cities, dungeons, landmarks
- Maps and geographical information
- Notable NPCs and factions present
- Historical significance

**Characters**
- Major NPCs with full backstories
- Character portraits and stat blocks
- Relationship maps
- Quest hooks and plot connections

**Factions**
- Organizations, guilds, governments
- Goals, resources, and influence
- Key members and hierarchy
- Faction relationships and conflicts

**Lore and History**
- Timeline of major events
- Myths, legends, and creation stories
- Cultural traditions and practices
- Historical figures and their impact

**Magic Systems**
- Spell mechanics and limitations
- Magical traditions and schools
- Artifacts and magical items
- Integration with spell index project

**Bestiary**
- Creatures and monsters
- Ecology and behavior
- Stat blocks and encounter suggestions
- Lore and cultural significance

**Rules and Mechanics**
- House rules and modifications
- Character creation guidelines
- Campaign-specific mechanics
- Reference tables and charts

### Content Relationships
- Bidirectional linking between related content
- Automatic "Related Content" sections
- Tag-based discovery
- Visual relationship graphs for complex connections

## Integration with Spell Index

The existing spell index project (GURPS Sorcerer spells database) will be integrated as a linked resource:
- Navigation menu item linking to spell index subdomain or path
- Embedded spell references within lore and magic system content
- Consistent visual design language between both sites
- Shared header/footer components for unified branding

The spell index will remain a separate deployable project but will be presented as a seamless part of the larger world-building ecosystem.

## Initial Site Structure

### Phase 1: Foundation (Placeholder Content)
- Homepage with project introduction and vision
- Basic navigation structure
- Link to spell index project (prominently featured)
- About/Credits page
- Placeholder sections for main content categories
- Search functionality framework

### Phase 2: Core Content
- Populate initial world-building content
- Establish content templates and patterns
- Build out location and faction pages
- Create character profiles for major NPCs

### Phase 3: Enhanced Features
- Interactive maps
- Relationship visualizations
- Timeline views
- Advanced filtering and search

### Phase 4: Community Features
- User authentication
- GM tools and resources
- Player-facing content sections
- Campaign management features

## Design Principles

### Visual Identity
- Fantasy aesthetic with modern usability
- Parchment and ink color scheme for immersive feel
- Clean typography for readability
- Generous whitespace to avoid overwhelming users
- Subtle textures and decorative elements

### User Experience
- Fast page loads (static generation)
- Intuitive navigation with clear hierarchy
- Mobile-responsive for table-side reference
- Accessible to screen readers and assistive technology
- Progressive enhancement for interactive features

### Content Strategy
- Start with placeholder structure to establish patterns
- Iterative content addition without blocking development
- Consistent formatting and metadata across content types
- Clear content ownership and update processes

## Development Workflow

### Project Setup
- Initialize Astro project with TypeScript
- Configure Tailwind CSS 4.x and DaisyUI
- Set up content collections with schemas
- Establish component library structure
- Configure deployment pipeline

### Content Creation
- Markdown files in content collections
- Frontmatter validation via Zod schemas
- Asset organization in public directory
- Version control for all content

### Quality Assurance
- Type checking for content schemas
- Link validation for internal references
- Accessibility testing
- Performance monitoring

## Success Metrics

### Technical Goals
- Lighthouse scores above 90 across all categories
- Build times under 2 minutes for full site
- Search results returned in under 100ms
- Zero broken internal links

### Content Goals
- Comprehensive coverage of core world elements
- Consistent voice and style across content
- Rich interconnections between content pieces
- Regular content updates and expansions

### User Goals
- Easy discovery of relevant information
- Quick reference during game sessions
- Engaging presentation that enhances immersion
- Clear pathways for exploration and learning

## Next Steps

1. Create new Astro project repository
2. Set up basic project structure and configuration
3. Design and implement core layout components
4. Create content collection schemas for primary content types
5. Build placeholder pages for main sections
6. Integrate link to spell index project
7. Deploy initial version for feedback and iteration

## Notes

- This document serves as the project vision and technical specification
- Implementation details and code will be developed in the separate project repository
- The spell index project remains independently deployable but conceptually integrated
- Focus initially on establishing patterns and structure rather than complete content
- Prioritize flexibility and scalability for long-term content growth

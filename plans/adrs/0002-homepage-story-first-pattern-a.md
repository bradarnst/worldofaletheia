# Homepage Information Architecture: Story-First Pattern A

## Status

- **Date:** 2026-02-11
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

The homepage has evolved into a dense set of cards that partially duplicates existing navigation from the global menu and section-level navigation. While functional, this creates UX friction for first-time visitors:

- The page feels like a sitemap instead of an intentional landing experience
- Too many equal-weight options increase cognitive load
- Information hierarchy is weak for newcomers who need orientation first
- The Campaigns section can be visually de-prioritized by viewport constraints

At the same time, returning users typically deep-link into domain pages such as specific Campaigns, reducing the need for the homepage to act as primary utility navigation.

The project needs a homepage pattern that prioritizes onboarding for new visitors while still supporting lightweight discovery and quick continuation for returning readers.

## Decision Drivers

- **New visitor orientation first**: quickly communicate what Aletheia is and where to start
- **Clear hierarchy**: reduce equal-weight UI choices above the fold
- **Cognitive simplicity**: lower decision fatigue on first visit
- **Domain model clarity**: reinforce three-domain model Canon, Using, Campaigns
- **Discovery and personality**: expose freshness and serendipity without clutter
- **Navigation coherence**: preserve global and section nav as primary utility wayfinding

## Considered Options

### Option 1: Utility-first homepage grid

Large set of compact category cards acting as primary navigation.

**Pros**
- Fast direct access for known destinations
- Familiar portal-style layout

**Cons**
- Weak storytelling and onboarding
- Higher cognitive load for new visitors
- Redundant with existing global and section navigation
- Looks dense and less distinctive for a worldbuilding site

### Option 2: Story-first Pattern A (Chosen)

Hero + three domain feature blocks + discovery teasers.

**Pros**
- Strong onboarding narrative for first-time visitors
- Clear top-level hierarchy aligned with domain model
- Navigation redundancy becomes intentional reinforcement
- Better balance of orientation and discovery

**Cons**
- One extra click for some utility navigation tasks
- Requires concise editorial copy for teaser quality

### Option 3: Magazine-first homepage

Hero + latest content lists + secondary domain links.

**Pros**
- Excellent for high-frequency publishing
- Emphasizes freshness

**Cons**
- Can obscure fundamental site orientation for first-time visitors
- Requires stronger content cadence to stay compelling

## Decision Outcome

**Chosen option:** Story-first Pattern A.

The homepage is treated as a narrative landing page, not a primary navigation index.

### Canonical Structure

1. **Hero section**: what the world is, why it matters
2. **Three domain feature blocks**:
   - World of Aletheia Canon
   - Using Aletheia
   - Campaigns
3. **Discovery row**:
   - Latest Article teaser
   - Random Article teaser optional but recommended
4. **Single clear CTA per feature block** to avoid link clutter

## Consequences

### Positive

- Better first impression and onboarding clarity
- Stronger information hierarchy and scanability
- Reduced cognitive load vs dense card navigation
- Reinforces domain boundaries introduced in architecture work

### Negative

- Slightly less direct utility access from homepage for power users
- Requires curation of teaser text and discovery card quality

### Neutral

- Navigation duplication remains, but is purposeful:
  - **Navigation components** provide utility wayfinding
  - **Homepage feature blocks** provide context and motivation

## Implementation Notes

- Keep global and section nav unchanged as utility channels
- Keep homepage cards informational with one CTA each
- Avoid large category matrices above the fold
- Desktop and mobile should keep stable ordering:
  - Hero -> Canon -> Using -> Campaigns -> Latest -> Random

## Acceptance Criteria

- New visitor can understand site purpose and domain structure within first screenful
- Homepage presents exactly three primary domain choices
- Latest and Random discovery teasers appear below primary domain feature blocks
- No section on homepage is visually truncated at common desktop viewport heights
- Global and section nav continue to serve primary utility navigation

## Links

- [MADR Project](https://adr.github.io/madr/)
- Related architecture decision: [0001-obsidian-first-content-architecture.md](plans/adrs/0001-obsidian-first-content-architecture.md)
- Related checklist: [campaigns-architecture-implementation-checklist.md](plans/campaigns-architecture-implementation-checklist.md)

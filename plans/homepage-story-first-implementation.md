# Homepage Story-First Implementation Checklist

## Goal
Implement ADR-0002 Pattern A on the homepage so first-time visitors get immediate orientation, while returning users still have efficient paths via existing navigation.

## Scope
- Primary target: [`src/pages/index.astro`](src/pages/index.astro)
- Optional comparison artifact: [`src/pages/index-with-images.astro`](src/pages/index-with-images.astro)
- Guidance source: [`plans/adrs/0002-homepage-story-first-pattern-a.md`](plans/adrs/0002-homepage-story-first-pattern-a.md)

## Checklist

- [ ] Confirm canonical section order on homepage
  - Hero
  - Canon teaser block
  - Using teaser block
  - Campaigns teaser block
  - Latest Article teaser
  - Random Article teaser

- [ ] Reduce homepage to three primary domain feature blocks only
  - Keep one clear CTA per block
  - Remove dense category-grid behavior above the fold

- [ ] Implement Latest Article teaser
  - Pull one latest entry from curated source set
  - Show title, short excerpt, domain label, and read CTA
  - Ensure fallback state if no content exists

- [ ] Implement Random Article teaser
  - Select one random entry from curated source set
  - Show title, short excerpt, domain label, and explore CTA
  - Ensure deterministic fallback for build/runtime edge cases

- [ ] Ensure clear information hierarchy and scanability
  - Distinct visual priority for hero and domain blocks
  - Discovery teasers visually secondary to domain blocks

- [ ] Validate desktop behavior
  - No section appears visually truncated at common viewport heights
  - Balanced whitespace and card sizing

- [ ] Validate mobile behavior
  - Stable vertical order: Hero -> Canon -> Using -> Campaigns -> Latest -> Random
  - Tap targets and spacing remain comfortable

- [ ] Keep navigation responsibilities consistent
  - Global and section nav remain utility wayfinding
  - Homepage blocks remain contextual teasers, not full nav replacement

- [ ] QA pass
  - Check CTA destination correctness
  - Check empty-content fallback rendering
  - Check visual consistency with Tailwind/DaisyUI design system

## Out of Scope
- Reworking global navigation architecture
- Introducing additional homepage domain sections beyond Canon, Using, Campaigns
- Full content recommendation engine

## Deliverables
- Updated homepage implementation in [`src/pages/index.astro`](src/pages/index.astro)
- Optional comparison page retained in [`src/pages/index-with-images.astro`](src/pages/index-with-images.astro)
- This checklist as implementation handoff document

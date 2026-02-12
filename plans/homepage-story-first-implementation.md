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

- [ ] Add single hero image selection capability with reusable biome and region assets
  - Build image set that can be reused in related lore articles
  - Start with 3 to 6 curated images max for performance
  - Include alt text and region or biome metadata
  - Ensure deterministic fallback if one image is missing

- [ ] Implement simple homepage image strategy no carousel
  - Option A: random single hero image per build request
  - Option B: deterministic daily image rotation using date-based index
  - Keep exactly one hero image visible at a time
  - Keep overlay and CTA readability consistent across all candidate images
  - Keep implementation lightweight and avoid slider UI or heavy client JS

- [ ] QA pass
  - Check CTA destination correctness
  - Check empty-content fallback rendering
  - Check visual consistency with Tailwind/DaisyUI design system
  - Check image loading behavior and no layout shift in hero

## Tone, Imagery, and Lore Alignment Notes

- Emphasize **rebirth after catastrophe** over ancient-ruin nostalgia
- Present the Shattered Lands as reclaimed, uncanny, and evolving
- Avoid heavy visual focus on ruins as primary motif
- Keep visual storytelling grounded in:
  - strange geography
  - lingering lattice oddness
  - fragile recovery and renewal

### Image Direction for Homepage

- Primary optional hero image: [`Shattered_Lands_Landscape01.png`](public/Shattered_Lands_Landscape01.png)
- Use with subtle overlay for readability, not as pure spectacle
- Prioritize environmental mood over architectural ruin close-ups

### AI Prompt Direction if generating additional assets

- “grounded fantasy landscape in a pre-industrial world, wide natural vistas, weathered plains and forests with distant mountains, gritty but hopeful tone, no magical visual effects, no glowing filaments, no rune motifs, no monumental ruins, no text”
- “temperate fantasy frontier at golden hour, resilient ecosystems after a long-ago catastrophe, subtle signs of ecological recovery, cinematic but natural lighting, realistic terrain, no explicit cataclysm epicentre cues, no magical manifestations, no text”

### Hero Image Prompt Color Palette Constraint

Use this explicit palette guidance in prompts:
- muted slate and charcoal shadows
- desaturated earth browns and umber soils
- subdued olive and moss greens
- restrained steel-blue sky tones
- soft warm highlights in amber only for sunlight accents

Prompt suffix example:
- “color palette: muted slate, charcoal, desaturated umber, olive green, steel-blue atmosphere, restrained amber highlights, low saturation, high contrast readability for white overlay text”

## Out of Scope
- Reworking global navigation architecture
- Introducing additional homepage domain sections beyond Canon, Using, Campaigns
- Full content recommendation engine

## Deliverables
- Updated homepage implementation in [`src/pages/index.astro`](src/pages/index.astro)
- Optional comparison page retained in [`src/pages/index-with-images.astro`](src/pages/index-with-images.astro)
- This checklist as implementation handoff document

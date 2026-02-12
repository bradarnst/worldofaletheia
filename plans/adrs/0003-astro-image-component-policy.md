# Astro Image Component Policy: Image vs Picture

## Status

- **Date:** 2026-02-12
- **Status:** Accepted
- **Deciders:** Brad

## Context and Problem Statement

The project uses image-heavy UI surfaces, including a hero image on the homepage and inline images in content pages. We need a consistent rule for when to use Astro image components to balance:

- performance and responsive delivery
- implementation simplicity
- maintainability across layouts and content
- visual consistency with DaisyUI-first page composition

Without a clear policy, image usage can drift into inconsistent patterns such as CSS background image usage where Astro optimization would be better.

## Decision Drivers

- **Performance**: optimized formats and responsive source generation
- **Simplicity**: minimal custom logic and predictable usage patterns
- **Consistency**: reusable rules for homepage, cards, and content pages
- **Accessibility**: explicit alt text and semantic image rendering
- **Maintainability**: clear default that contributors can follow

## Considered Options

### Option 1: Use only `Image`

**Pros**
- Very simple and consistent API
- Works well for most inline images

**Cons**
- Less flexible for responsive art-direction style scenarios
- Fewer options for hero-style multi-size control

### Option 2: Use only `Picture`

**Pros**
- Maximum flexibility for responsive output and format control
- Strong fit for large hero surfaces

**Cons**
- More verbose for routine inline images
- Unnecessary complexity for simple content imagery

### Option 3: Use both by policy (Chosen)

Use `Picture` for large, responsive, high-impact surfaces and `Image` for standard inline and simple decorative content images.

**Pros**
- Best balance of performance and simplicity
- Clear defaults by use case
- Avoids over-engineering basic images

**Cons**
- Requires lightweight team guidance and discipline

## Decision Outcome

**Chosen option:** Option 3 - dual-component policy by use case.

### Policy

- Use **`Picture`** for:
  - homepage hero images
  - prominent banner and masthead images
  - cases needing explicit responsive width sets and format control

- Use **`Image`** for:
  - inline article images
  - standard card/media images
  - simple decorative imagery where one responsive strategy is sufficient

### Additional Guidance

- Keep DaisyUI components as page-structure primitives
- Use Astro image components for image rendering inside DaisyUI containers
- Avoid CSS `background-image` for primary content imagery when semantic image rendering is appropriate
- Always provide meaningful alt text unless image is explicitly decorative

## Consequences

### Positive

- Better performance on hero and large visual surfaces
- Cleaner code for routine image usage
- Consistent contributor expectations
- Improved accessibility and semantic markup

### Negative

- Minor onboarding cost for two-component rule
- Some refactors may be needed where legacy CSS image usage exists

### Neutral

- DaisyUI remains the UI composition layer
- Astro image components remain the image delivery layer

## Acceptance Criteria

- Homepage hero renders with `Picture`
- Standard inline/content images default to `Image`
- New image implementations follow this policy unless a documented exception exists
- Alt text is present for non-decorative images

## Links

- Astro images documentation: https://docs.astro.build/en/guides/images/
- Related homepage IA decision: [0002-homepage-story-first-pattern-a.md](plans/adrs/0002-homepage-story-first-pattern-a.md)
- Related implementation checklist: [homepage-story-first-implementation.md](plans/homepage-story-first-implementation.md)

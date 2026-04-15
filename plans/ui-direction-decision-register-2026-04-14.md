# UI Direction Decision Register (Draft)

## Status

- Date: 2026-04-14
- Status: Draft decision register
- Depends on: `plans/ui-direction-spec-baseline-2026-04-13.md`
- Depends on: `plans/ui-direction-spec-refinement-2026-04-13.md`
- Depends on: `plans/ui-direction-spec-homepage-revision-2026-04-14.md`
- Purpose: capture what is settled, what remains intentionally open, and what should be decided through prototype iteration

---

## 1) Why This Document Exists

The UI revamp now has enough agreed direction that it needs a compact decision register.

This document is meant to prevent two failure modes:

- forgetting what has already been decided,
- prematurely locking visual details that should be tested in prototype form.

This is not a final visual spec.

It is the current working record of:

- settled decisions,
- provisional decisions,
- deferred decisions,
- prototype questions,
- non-goals for the current phase.

---

## 2) Settled Decisions

These decisions should now be treated as the active baseline unless explicitly replaced by a later planning document.

## 2.1 Architecture and implementation

- Astro-native architecture remains unchanged.
- Tailwind remains the styling foundation.
- DaisyUI is to be replaced incrementally, not refined indefinitely.
- Site-owned `.astro` primitives are the target for presentation components.
- No React/Radix/shadcn component adoption is planned for static content domains.

## 2.2 Typography

- Keep `Lora`.
- Keep `Inter`.
- Do not expand scope by changing font families in the first revamp phase.
- Improve hierarchy through spacing, scale, weight, rhythm, and contrast before reconsidering fonts.

## 2.3 Dark theme strategy

- Use one moonlight-led dark foundation.
- Treat `Exotic Wildlife` and `Night Blooms` as accent families, not separate first-pass full themes.
- Reduce the active accent set on any one screen.
- Readability remains the priority over visual flourish.

## 2.4 Homepage strategic role

- Homepage remains story-first.
- Homepage should not become a random/latest content index.
- Homepage should act as an atmospheric gateway into the major domains.
- Guided exploration remains a goal, but it is now carried more by header/nav structure than by immediate below-hero cards alone.

## 2.5 Hero direction

- Full-page or near-full-page hero is now an approved direction.
- Hero media should remain curated Aletheia imagery for now.
- The hero should be treated as a stable layout slot with a swappable media layer.
- That swappable media layer could later become a map without requiring a full homepage redesign.

## 2.6 Navigation direction

- Global navigation should be dropdown-based.
- Dropdown items should behave like compact informational cards.
- Each item should include title and short description.
- Small icons are approved where they help orientation.
- The menu should feel atmospheric and premium, not generic product UI and not heavy like Daisy tabs.
- Header layout should use full-width framing with branding left, main nav centered, and utilities right.
- `Contribute` remains a visible direct destination in the right-side utility cluster, not a dropdown group.
- `Login` should be present in the global header utility cluster.
- Theme switching in the header should be icon-only.
- `GitHub` should not appear in the global header; it remains a footer destination.

## 2.7 Homepage content policy

- Do not place random Canon/Using/Campaign content directly on the first-pass homepage.
- Favor explanatory and curated domain-support sections below the hero.
- `Contribute` should have a dedicated page and remain visible in the global header utility cluster.
- `About` should remain easy to reach and may also appear as a homepage support section.

## 2.8 Card policy

- Cards still matter for collection pages and supporting surfaces.
- Cards should be cleaner, tighter, and calmer than the current implementation.
- Standard automated collection cards should not use default thumbnail images.
- Collection-card atmosphere should come from page-level backgrounds rather than per-card imagery.
- Special/manual content layouts may define explicit image slots when the content type warrants it.
- Whole-card clickability is acceptable where appropriate.

## 2.9 Sidebar policy

- Sidebar remains a utility pattern, not a site-wide default.
- First likely sidebar pilot remains `Reference`, especially `Calendar`.
- Campaigns sidebar remains deferred until content structure justifies it.

## 2.10 Chip taxonomy

The semantic chip model is approved:

- `TagChip`
- `TaxonomyPill`
- `StatusBadge`
- `RelationChip`
- `CountPill`

Detailed visual treatment remains open, but the semantic split is settled.

---

## 2.11 Collection and article surface policy

- Standard collection landing pages may use subtle blurred/tinted image, texture, or gradient backgrounds at the page level.
- Collection backgrounds are image-first in the current design pass.
- Collection cards should remain opaque and scan-friendly.
- Do not use bento layouts for primary paginated collection listings.
- Do not use default thumbnail images on standard automated collection cards.
- Standard article/content pages should not use top hero images.
- Article pages should lead with breadcrumbs, title, summary, and world-context metadata rather than decorative media.
- Collection pages should use a compact site-wide search bar with type and tag filtering.

## 2.12 Footer and glyph flavor policy

- Footer should be compact, restrained, and multi-column rather than large or promotional.
- Footer should include About, Contribute, Contact, GitHub, and copyright, with socials optional later.
- `Contribute` should remain easy to reach from global nav and footer.
- Footer should read as one compact section rather than a stacked primary footer plus separate footer bar.
- Flavor on cards and navigation should gradually come from a curated icon/glyph library rather than heavier visual chrome.
- The target icon system is a custom SVG set rather than a third-party library look.

## 2.13 Summary fallback policy

- Authored summary is preferred whenever available.
- If summary is blank, generate a deterministic build-time or ingest-time fallback.
- Summary fallback should remain reviewable and low-risk rather than highly stylistic.

---
## 3) Provisional Decisions

These are current decisions, but they should be validated in design prototype or first implementation pass before being treated as fixed.

Wireframe validation update:

- homepage, global navigation, collection landing, article shell, compact filter bar, and footer wireframes were approved on 2026-04-15
- the approved outcomes are captured in `plans/ui-component-and-shell-spec-2026-04-15.md`
- the remaining sections below are only the items still intentionally flexible after the approved wireframe pass

## 3.1 Hero height

Current direction:

- full-page or near-full-page hero.

Still to validate:

- exact height on desktop,
- exact height on laptop screens,
- how much of the next section should be visible without scrolling,
- whether the hero should visually bleed into the header or remain more contained.

## 3.2 Hero CTA behavior

Current direction:

- no single dominant CTA,
- one or two light actions at most.

Still to validate:

- whether the hero should have zero buttons and rely on nav alone,
- whether one text-link cluster is better than one or two buttons,
- whether `Contribute` belongs in the hero at all or only in nav/supporting sections.

## 3.3 Dropdown density

Current direction:

- compact card-like menu items,
- likely closer to Wispr Flow than Frankli.

Still to validate:

- one-column vs two-column group layouts,
- item padding density,
- icon size,
- whether descriptions should always appear or collapse at smaller widths,
- whether every top-level group needs the same layout treatment.

## 3.4 Homepage post-hero structure

Current direction:

- explanatory/support sections first,
- curated featured content later if needed.

Still to validate:

- whether the first section after the hero should be a four-domain panel set,
- whether `Contribute` and `About` should be their own bands or integrated into a supporting grid,
- whether one curated featured-content strip improves the page or adds noise.

## 3.5 Card imagery on homepage domain panels

Current direction:

- background imagery is allowed selectively.

Still to validate:

- whether domain panels should use image-backed treatments at all,
- how often image-backed panels should appear,
- whether image-backed panels clash with the full hero,
- whether a text-first approach is stronger below the hero.

## 3.6 Canon personality variation

Current direction:

- subtle per-collection personality is approved.

Still to validate:

- how much icon variation is enough,
- how much accent variation is too much,
- whether personality should be expressed more through imagery than through color,
- whether some collections should remain almost identical for clarity.

---

## 4) Explicitly Deferred Decisions

These are intentionally not being finalized now.

## 4.1 Map-based homepage hero

Deferred because:

- it is compatible with the current hero-slot model,
- it would require meaningful design and interaction work,
- it should not block the current revamp.

Current rule:

- design the hero container so the media layer can later become a map.

## 4.2 Campaigns sidebar and campaign-specific shell

Deferred because:

- campaign content structure is not mature enough,
- the site should not invent workflow UI ahead of real need.

## 4.3 Chip styling details

Deferred because:

- the semantic model is already enough to proceed,
- exact visual differentiation is best decided during component pass.

## 4.4 Utility sidebar variants beyond Reference

Deferred because:

- Reference provides the clearest first use case,
- broader utility-sidebar decisions should follow real implementation feedback.

## 4.5 Large-scale homepage content modules

Deferred because:

- homepage should first establish atmosphere and orientation,
- live content modules are useful only if they clearly improve the landing experience.

---

## 5) Prototype Questions

These questions should be answered by design mockups or first implementation experiments, not by abstract debate alone.

## 5.1 Header and hero integration

Questions:

- Should the header sit transparently over the hero at the top?
- When does the header become solid on scroll?
- How much contrast support does the nav need over varying hero imagery?

## 5.2 Dropdown behavior

Questions:

- Should dropdowns open on hover, click, or both depending on device?
- How much motion is acceptable before the interaction feels flashy?
- Should dropdown panels have subtle panel chrome or almost disappear into the hero/header system?

## 5.3 Hero copy length

Questions:

- How short can the hero copy be while still orienting first-time visitors?
- Does one framing paragraph outperform a title + subtitle + links pattern?
- Does the copy need to acknowledge Obsidian/worldbuilding/campaign play, or is that better left to below-the-fold sections?

## 5.4 Post-hero explanation blocks

Questions:

- Should the four major domains be presented as equal peers below the hero?
- Should Canon receive more prominence than the others?
- Should Contribute and About be their own support row or part of a secondary grid?

## 5.5 Card treatment

Questions:

- Are borders enough, or do cards need a surface/lift difference to read clearly?
- When are image-backed panels worth using?
- Should collection cards use quiet trailing affordances instead of explicit buttons everywhere?

---

## 6) Non-Goals for the Current Pass

The following should not expand the scope of the current UI direction work:

- redesigning content schemas,
- changing routing architecture,
- inventing a complex app shell for all domains,
- treating the homepage like a live content feed,
- designing the interactive map navigation now,
- designing campaign-specific workflow UI before the content supports it,
- perfecting every chip/status/detail before header/hero/card direction is stable.

---

## 7) Decision Rules for Iteration

When prototype feedback arrives, use these rules:

1. Prefer readability over spectacle.
2. Prefer orientation over novelty.
3. Prefer site-owned patterns over imported library conventions.
4. Prefer one strong atmospheric move over many small decorative moves.
5. Prefer curation on the homepage over randomness.
6. Prefer future compatibility for the hero media slot so image and map can share the same structural frame.

---

## 8) What Should Be Specified Next

The next concrete planning artifact should lock:

1. header-over-hero behavior
2. dropdown panel anatomy
3. dropdown item/card anatomy
4. hero wireframe and copy zones
5. homepage post-hero section order
6. first-pass content rule for explanatory vs curated sections
7. collection card variants
8. Reference sidebar pilot wireframe

---

## 9) Short Form Summary

Settled now:

- Astro + Tailwind owned UI
- `Lora` + `Inter`
- one moonlight-led dark foundation
- full-page or near-full-page hero
- compact card-like dropdown nav items with title + description + icon support
- no random homepage articles
- explanatory and curated homepage sections instead
- hero media slot should remain compatible with a future map
- cards stay important but become lighter and calmer
- Reference sidebar first, Campaigns later

Still to prove in prototype:

- exact hero height
- exact dropdown density
- exact hero CTA pattern
- exact post-hero section composition
- exact level of Canon collection personality variation

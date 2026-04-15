# UI Component and Shell Spec

## Status

- Date: 2026-04-15
- Status: Approved wireframe capture
- Purpose: record the approved prototype decisions in implementation-ready component and shell terms
- Source of approval: static prototype pass approved by user on 2026-04-15
- Related documents:
  - `plans/ui-implementation-handoff-plan-2026-04-14.md`
  - `plans/ui-direction-decision-register-2026-04-14.md`
  - `plans/ui-collection-and-article-surface-spec-2026-04-14.md`

---

## 1) Scope

This artifact captures the approved first-cut direction for:

- global header and dropdown navigation
- homepage hero shell and support sections
- collection landing shell
- article header, context block, and prose column
- compact search/type/tag bar
- compact footer

It is intentionally about structure, hierarchy, spacing behavior, and style rules.

It is not a final visual-token document for exact numeric blur, tint, or motion values.

---

## 2) Global Surface Rules

Apply these rules across the approved shells:

- keep corner radii restrained; avoid oversized pill shapes and overly soft cards
- prefer calm borders and light depth over heavy chrome
- let atmosphere live in page-level imagery, gradients, and motifs rather than in stacked component ornament
- keep text hierarchy stronger than decorative treatments
- use small SVG glyphs as orientation aids, not as primary decoration
- keep layouts centered on readable content columns rather than broad dashboard framing

---

## 3) Global Header and Navigation

## 3.1 Header frame

Approved header structure:

- full-width bar across the viewport
- branding locked to the far left
- primary grouped navigation centered
- search placed between the centered nav and the right utility cluster
- right utility cluster contains icon-only theme toggle, `Login`, and `Contribute`
- `GitHub` does not appear in the header

The homepage header may sit atmospherically over hero media, but the shell remains the same.

## 3.2 Header content rules

Branding block should include:

- logo/wordmark slot
- world/site title
- optional small overline or archive descriptor

Utilities should follow these rules:

- theme is icon-only
- `Login` is a direct destination, not a dropdown
- `Contribute` is a direct destination, not a dropdown
- search remains a compact utility affordance rather than a dominant input

## 3.3 Dropdown groups

Approved top-level groups:

- World of Aletheia
- Using Aletheia
- Reference
- Campaigns

Dropdown treatment:

- items read like compact informational cards
- each item uses icon + title + short description
- larger groups may use two columns; smaller groups may use one
- dropdown panels feel premium and editorial, not like generic app mega-menus
- the current compact card treatment from the approved wireframe is the baseline to implement

## 3.4 Navigation style constraints

- keep the bar slim; avoid fat nav pills and oversized controls
- maintain a full-width frame with clear left / center / right alignment
- dropdown descriptions stay visible in desktop panels
- mobile can collapse to grouped accordions/drawer structure without changing the IA

---

## 4) Homepage Shell

## 4.1 Hero structure

Approved homepage hero direction:

- full-page or near-full-page hero
- atmospheric header over hero
- hero copy centered
- title, summary, and links sit directly on the hero media
- no bordered card, glass slab, badge pile, or framed text container around hero copy

## 4.2 Hero copy rules

- keep the copy block simple and centered
- one heading, one framing paragraph, and one light link cluster are enough
- do not add badges, taxonomy chips, or extra metadata inside the hero
- keep CTA treatment light; text-link or very restrained action treatment is preferred

## 4.3 Post-hero support sections

Below the hero, retain support sections for:

- Canon
- Using Aletheia
- Campaigns
- Reference
- Contribute
- About

These remain explanatory support panels, not random/latest article modules.

---

## 5) Compact Filter Bar

Approved structure:

- search input
- type filter
- tag filter
- optional compact result/count affordance

Approved treatment:

- compact and opaque
- restrained radius, not pill-heavy
- self-explanatory without an intro heading/description block
- can stand alone as a reusable utility surface

Layout intent:

- one row on wider screens where possible
- can wrap compactly at smaller breakpoints
- should feel like a utility control, not a hero module

---

## 6) Collection Landing Shell

## 6.1 Hero zone

Approved collection-page header direction:

- atmospheric image-first background at the page level
- collection title and short explanation overlay the hero/background directly
- no separate intro card
- no badge or tag pile in the intro zone
- optional small icon/motif is acceptable if subdued

## 6.2 Filter bar placement

Approved placement:

- directly below the hero section
- visually tied to the listing/cards section rather than floating as part of the hero

## 6.3 Card grid

Approved collection-card baseline:

- opaque cards
- no thumbnails
- no bento
- predictable scan-first rhythm
- tags only when useful and kept quiet
- atmosphere comes from the page background, not card imagery

---

## 7) Article Shell

## 7.1 Top-of-page order

Approved article order:

- breadcrumbs
- title
- summary
- subtle world-context metadata block
- prose body

No top hero image should be added.

## 7.2 Column alignment

Approved layout rule:

- breadcrumbs, title, summary, metadata, and prose all align to the same left margin
- use one shared readable-width column for the article shell
- avoid making the header or metadata block wider than the prose column

## 7.3 Metadata/world-context block

Approved treatment:

- subtle, integrated, and structured
- feels like front matter / world context, not a separate dashboard card
- light rule or slight background shift is enough

Approved content structure:

- taxonomy and relationships on the main side
- related links and tags on the narrower secondary side

Secondary-column rules:

- keep it narrower than the main metadata column
- truncate long related-link labels with ellipsis
- expose the full related-link title via hover tooltip/title attribute
- allow tags to wrap naturally

---

## 8) Footer

Approved footer direction:

- one compact footer section only
- no stacked main footer plus separate lower footer bar
- multi-column, restrained, text-first
- `GitHub` remains here rather than in the global header

Required destinations remain:

- About
- Contribute
- Contact
- GitHub
- copyright

Heading treatment:

- footer column headings remain semantic headings
- keep them extremely small and quiet compared with body text
- avoid large heading defaults that make the footer feel promotional

---

## 9) Still Deferred After Wireframe Approval

These remain open enough for production implementation judgment:

- exact blur/tint/overlay numeric values
- exact hero height values by breakpoint
- final collection background image assignments
- full custom SVG backlog across all type enums
- any later Reference sidebar pilot

These do not block production implementation of the approved shells.

---

## 10) Prototype Lifecycle Note

The approved prototype routes were intentionally removed after this capture so they do not remain as public/internal website surfaces.

This document is now the durable reference for the approved wireframe pass.

# Contributors and Attribution Implementation Plan

## Status

- Date: 2026-05-29
- Updated: 2026-05-30
- Status: Draft plan for review
- Related HLD: `plans/features/contributors-and-attribution-hld-2026-05-29.md`


## Relational Attribution Follow-Up

This plan is extended by `plans/features/contributor-relational-attribution-implementation-plan-2026-05-30.md` and ADR `plans/adrs/0022-relational-contributor-attribution-index.md`. That follow-up plan covers the required D1 migration, sync writer changes, exact `/search?contributor={id}` semantics, and staging/production migration-before-sync deployment sequence.

## Delivery Strategy

Deliver the feature in small, independently useful phases:

1. Contributor data-model foundation and vault migration support
2. Contributors MVP pages
3. Article-level contributor credits and profile contribution listings
4. Image attribution convention and content sync validation
5. Site-wide single-image full-size viewing enhancement

The first public UI phase can ship without the image viewer. The image viewer should be implemented as a reusable site-wide enhancement, not as contributor-specific behavior.

## Architecture Guardrails

1. Use Astro content collections directly.
2. Do not populate `src/services/`, `src/adapters/`, or `src/contracts/` for this work.
3. Use `.astro` components unless genuine client-side state is needed.
4. Use Astro `<Image>` for avatars, cards, thumbnails, and inline content images.
5. Use Astro `<Picture>` only for hero/banner/high-impact responsive surfaces.
6. Keep contributor pages public and static unless a later runtime source-mode constraint requires otherwise.
7. Respect existing visibility rules when listing contributions.
8. Do not add dependencies without explicit approval.
9. Keep Obsidian as the source of truth; sync reports validation issues rather than silently rewriting frontmatter in the MVP.

## Phase 0 — Data-Model Foundation and Vault Migration Support

### Goal

Normalize authorship metadata before adding contributor-specific features.

### Implementation Tasks

1. Brute-force migrate the Obsidian vault from `author:` to `authors:`.
2. Update site schemas to prefer/require `authors`.
3. Do not keep a long-term legacy `author` fallback after the vault migration; any temporary compatibility should be removed before the feature is considered complete.
4. Update code references from `author` to `authors` across page metadata, cards, layouts, and utilities.
5. Update sync/index metadata mapping to preserve `authors` where applicable.
6. Confirm existing content reload/sync behavior after the vault rename.

### Acceptance Criteria

- Content uses `authors:` rather than `author:`.
- Build/runtime code reads `authors` for article authorship.
- `authors` supports multiple contributor ids.
- `pnpm build` passes after content migration.

## Phase 1 — Contributors MVP Pages

### Goal

Add public contributor recognition pages discoverable from the footer and optional support pages.

### Implementation Tasks

1. Add a `contributors` collection to `src/content.config.ts`.
2. Define contributor schema fields:
   - `title`
   - `displayName`
   - `status`
   - `avatar`
   - `bioExcerpt`
   - `socials[]`
   - `profileMode` with values `standard` or `featured`
   - optional `featuredContributions[]`
3. Do not add `roleSummary`; contributor roles come from article-level contribution metadata.
4. Add initial contributor markdown entries.
5. Set Brad and Barry to `profileMode: featured` from the beginning.
6. Create `/contributors/index.astro`.
7. Create `/contributors/[...slug].astro` or equivalent contributor detail route.
8. Reuse existing layout/navigation so users can always return to the main site.
9. Add footer link to `Contributors`.
10. Optionally add contextual links from `/about` and `/contribute`.
11. Render one unified contributor card grid with avatar, excerpt, and profile link.
12. Render contributor profile with bio and social links.

### Acceptance Criteria

- `/contributors` builds and lists published contributors in one unified list.
- `/contributors/{slug}` builds for each published contributor.
- Contributor pages use the normal public layout/header/footer.
- Footer includes a Contributors link.
- No client-side JavaScript is required for this phase.
- `pnpm build` passes.

## Phase 2 — Article-Level Contributor Credits and Profile Listings

### Goal

Support article authorship and non-author contribution credits as separate concepts.

### Implementation Tasks

1. Add structured `contributors` field to the shared content schema.
2. Use `roles: []` because a contributor can have multiple roles in the same article.
3. Use role nouns:
   - `artist`
   - `editor`
   - `researcher`
   - `consultant`
   - `cartographer`
   - `photographer`
   - `other`
4. Do not include `author` as a contributor role; derive author treatment from `authors`.
5. Add validation that `authors[]` ids and `contributors[].id` ids reference existing contributor entries where practical.
6. Update contributor detail pages to query public content where:
   - `authors` contains the contributor slug, or
   - `contributors[].id` equals the contributor slug.
7. Render contribution cards using existing `ContentCard` patterns where possible.
8. Add a contributor search link to every contributor profile. The intended search semantics are `authors contains contributor OR contributors contains contributor`.
9. For `standard` profiles, list all matching public authored/contributed entries plus the search link.
10. For `featured` profiles, list only curated `featuredContributions` plus the search link.
11. Keep curation in contributor profile frontmatter, not in individual article frontmatter.

### Acceptance Criteria

- Existing content does not break when `contributors` is absent.
- Multiple authors are supported through `authors`.
- Non-author contributor credits can be represented with `roles: []`.
- Contributor profile pages show linked public contributions according to `profileMode`.
- Brad and Barry profile pages do not dump every authored article.
- Every contributor profile includes a search link for all matching authored/contributed content.
- Protected campaign content does not appear for unauthorized/public users.
- `pnpm build` passes.

## Phase 3 — Image Attribution Convention and Content Sync Validation

### Goal

Establish a reader-visible and machine-checkable convention for crediting image contributors.

### Required Authoring Convention

Use Obsidian-friendly Markdown. The credit caption must immediately follow the image, separated only by whitespace/linefeeds:

```md
![Avenholm market at dusk](./avenholm-market.jpg)

*Art by [Example Artist](../contributors/example-artist.md). Used with permission.*
```

This convention preserves:

1. visible credit immediately after the image,
2. a contributor id/link that can resolve to a contributor page,
3. compatibility with Obsidian authoring,
4. a simple sync-time validation pattern.

### Implementation Tasks

1. Document the image attribution convention in contributor/content authoring docs.
2. Add content sync validation for contributor references.
3. Detect image credits by looking for:
   - a Markdown image line,
   - optional whitespace-only lines,
   - a following caption line containing a Markdown link whose `()` target includes `contributors/`.
4. Add initial warnings for:
   - image credit links that do not resolve to contributor entries,
   - `authors[]` ids that do not resolve,
   - `contributors[].id` ids that do not resolve,
   - `contributors[].roles` containing `artist` without a matching immediate image caption credit for that contributor,
   - image captions crediting a contributor who is not listed in frontmatter with `roles` containing `artist`,
   - missing alt text for non-decorative images.
5. After convention stabilizes, promote critical broken contributor references from warnings to failures.
6. Do not auto-populate frontmatter during sync in the MVP; report the mismatch and fix the Obsidian source.
7. Consider rendering image credits with a shared figure/caption component if Markdown transformation can detect the convention reliably.

### Acceptance Criteria

- Image attribution guidance is documented.
- Contributor ids in article frontmatter can be checked during content sync.
- Broken image contributor references are at least warned.
- Artist/frontmatter and caption mismatch produces at least a warning.
- The convention remains usable in Obsidian.
- Sync reports problems rather than silently rewriting source metadata.
- No dependency is added for caption parsing unless explicitly approved.

## Phase 4 — Site-Wide Single-Image Full-Size Viewing Enhancement

### Goal

Add simple, accessible full-size viewing for article images and thumbnails without replacing Astro image optimization.

### Implementation Direction

Use progressive enhancement around semantic links:

```astro
<a href={fullSizeSrc} data-lightbox>
  <Image src={thumbnailSrc} alt={alt} />
</a>
```

### Implementation Tasks

1. Identify image surfaces eligible for full-size viewing:
   - article inline images,
   - contributor avatars/thumbnails if useful,
   - content cards only if UX remains clean.
2. Add a reusable Astro component or rendering pattern that wraps eligible images in a full-size link.
3. Add a vanilla TypeScript single-image lightbox enhancement.
4. Support:
   - close button,
   - ESC close,
   - backdrop click close,
   - focus return to opener,
   - alt/caption/credit display where available.
5. Do not add gallery previous/next controls in the MVP.
6. Ensure no-JS fallback opens the image URL normally.
7. Test in at least one light and one dark theme.
8. Validate keyboard and screen-reader behavior.

### Acceptance Criteria

- Eligible images still render through Astro `<Image>` or `<Picture>` as appropriate.
- No-JS fallback works.
- ESC and close button close the overlay.
- Focus returns to the clicked image/link.
- Overlay does not trap users or break page scroll restoration.
- No gallery state is required in the MVP.
- `pnpm build` passes.

## Suggested File/Component Surface

Potential implementation files, subject to current repository structure:

- `src/content.config.ts`
- `src/content/contributors/*.md`
- `src/pages/contributors/index.astro`
- `src/pages/contributors/[...slug].astro`
- `src/components/ContributorCard.astro`
- `src/components/ContributorProfileHeader.astro`
- `src/components/ContributionCredits.astro`
- `src/components/LightboxImage.astro` or similarly named wrapper
- `src/scripts/lightbox.ts` or current equivalent client-script location
- footer/navigation component that owns support links
- `scripts/content-sync/*` validation modules for contributor and image-attribution checks

## Rollout Notes

1. Phase 0 should happen before contributor fields are widely used.
2. Phase 1 can ship with only a few contributor profiles.
3. Phase 2 should be careful with `authors` migration and existing display surfaces.
4. Phase 3 should begin with warnings while the image credit syntax is refined.
5. Phase 4 should be treated as a separate UX enhancement and can be postponed if contributor pages are the priority.

## Validation Commands

Use project-standard commands after implementation:

```bash
pnpm build
```

If tests exist or are added for validation logic, also run:

```bash
pnpm test
```

## Open Decisions Before Coding

1. Exact contributor collection schema field names beyond the draft fields.
2. Exact search URL/query parameter contract for contributor profile search links.
3. Whether contributor profiles show role badges in the MVP or defer them.
4. Which content sync validation failures begin as warnings versus hard failures.
5. Where contributor/content authoring documentation should live.
6. Whether implementation needs a very short temporary `author` compatibility check during the migration branch, with removal before completion.

## Recommended MVP Cut

For the first implementation pass, ship:

1. `author` -> `authors` data-model migration.
2. `contributors` collection.
3. `/contributors` index.
4. `/contributors/[slug]` profile pages.
5. Footer link.
6. Basic social links and bio rendering.
7. `standard` and `featured` profile modes.
8. Contributor profile search links.
9. Optional manual `featuredContributions` display.

Defer image attribution validation and full-size image viewing until the initial IA and contributor profile UX have been reviewed, unless content onboarding requires artist attribution checks immediately.

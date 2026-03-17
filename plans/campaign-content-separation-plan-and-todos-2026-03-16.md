# Campaign Content Separation Plan and TODOs (2026-03-16)

## Status

- Date: 2026-03-16
- Scope: planning and sequencing only (no code changes in this step)
- Priority: immediate release blocker for making repository public

## Problem Statement

The repository is intended to become public, but campaign markdown and campaign assets include private content that must not be disclosed via Git history or repository browsing.

Current route-level authorization is necessary but not sufficient for this requirement, because private source content is still in the repository.

## Agreed Direction

1. Keep one Astro app and current route surface (`/campaigns/**`).
2. Move campaign private content source out of Git-tracked repository files.
3. Store campaign private content in private Cloudflare storage.
4. Resolve campaign content at request-time behind Better Auth + D1 authorization checks.
5. Preserve optionality for later full campaign app extraction.

## Cloudflare Storage Decision (Locked Before Code Handoff)

### Primary Storage and Access Model

- Use **Cloudflare R2** as canonical storage for campaign private content:
  - markdown source content
  - campaign images
  - occasional PDFs
- Keep **D1** as source of truth for identity and authorization decisions (Better Auth + campaign membership/GM rules).
- Serve campaign content through Worker/Astro request-time paths only after authz checks.
- Do not expose direct public URLs for protected campaign assets.

### Cost and Product Selection Rationale

- **R2** is the best cost/complexity fit for mostly markdown + images + occasional PDFs.
- **D1** remains relational metadata/authz storage only, not blob storage.
- **KV** is not selected for campaign source content storage.
- Keep product surface small by default: avoid adding Cloudflare Images unless required later.

### Image Handling Strategy (Default + Optional Upgrades)

- **Default (selected):** pre-generate image variants during sync (for example `thumb`, `detail`, `fullscreen`) and store variants in R2.
- **Optional later (not required):** Worker on-the-fly image resizing if pre-generated variants become operationally limiting.
- **Optional later (not required):** Cloudflare Images product if traffic/transform volume justifies managed image pipeline costs.

### Storage Path Conventions

- `campaigns/{campaignSlug}/index.md`
- `campaigns/{campaignSlug}/sessions/{sessionSlug}.md`
- `campaigns/{campaignSlug}/assets/images/original/...`
- `campaigns/{campaignSlug}/assets/images/variants/{size}/...`
- `campaigns/{campaignSlug}/assets/docs/...pdf`

### Optionality Clarification

- Runtime storage separation and pre-generated R2 variants are in-scope now.
- Any additional image delivery phase beyond that is explicitly optional and should be adopted only if concrete pain appears.

## Why This Direction

- Satisfies the immediate confidentiality requirement before public-repo release.
- Minimizes architecture churn versus full service/app extraction.
- Keeps current UX and route structure stable.
- Aligns with Obsidian-first pipeline and Cloudflare-first deployment posture.
- Defers higher-complexity decisions until justified by usage and ops pain.

## Explicit Non-Goals (This Phase)

- No full campaigns microservice/app split.
- No framework migration for UI interactivity.
- No broad auth model redesign as part of storage separation.
- No migration of all public canonical content to cloud storage.

## Alternatives Considered

### A) Build-time private injection only

- Pros: fastest path, least code churn.
- Cons: still coupled to build pipeline and weaker long-term extraction seam.
- Verdict: acceptable temporary fallback only.

### B) Runtime private storage for campaign content (chosen)

- Pros: keeps private source out of repo, preserves route UX, supports protected media delivery and extraction readiness.
- Cons: introduces second active data source and runtime fetch/caching complexity.
- Verdict: best balance for current needs.

### C) Full campaigns separation now

- Pros: strongest isolation and independent evolution.
- Cons: highest immediate complexity and delivery risk.
- Verdict: defer until split triggers are met.

## Execution Plan

### Phase 0 - Decision and docs (now)

- Write ADR for campaign content source separation.
- Publish implementation handoff doc with concrete deliverables and acceptance criteria.

### Phase 1 - Blocker removal (must change now)

- Ensure campaign private content is no longer Git-tracked in this repository.
- Add content-sync mode for campaign push to private cloud storage.
- Keep public domain content workflow unchanged.

### Phase 2 - Runtime read path (should change soon)

- Add campaign content resolver path: `authz -> content fetch -> render`.
- Enforce deny-by-default on resolver/storage errors.
- Keep existing campaign route URLs and IA.

### Phase 3 - Protected assets and image delivery (should change soon; advanced phases optional)

- Serve campaign images through authorized path (no direct public private-asset URLs).
- Add resize strategy using pre-generated variants in R2 (default).
- Support full-screen image view while preserving auth boundaries.

### Phase 4 - Hardening and cleanup (consider after initial rollout)

- Add operational verification scripts/checklists for storage + authz behavior.
- Reconcile docs that still assume campaign markdown in repo.
- Reevaluate Option 3 unified-role migration after storage separation stabilizes.

## Priority TODO List

## Must Change Now

- [ ] Accept ADR for campaign source separation.
- [ ] Implement campaign-private content removal from Git-tracked source.
- [ ] Add content-sync capability to publish campaign content directly to private cloud storage.
- [ ] Confirm campaign routes do not depend on Git-tracked private markdown.

## Should Change Soon

- [ ] Implement runtime campaign content resolver behind Better Auth + D1 checks.
- [ ] Add deny-by-default behavior for storage/read failures.
- [ ] Add protected image delivery path and resizing strategy for campaign media.
- [ ] Exclude protected campaign content from public search indexing.

## Consider for Future (Optional)

- [ ] Evaluate moving all content sources to cloud storage (public + protected) if benefits justify migration.
- [ ] Evaluate full campaigns app/service extraction when split triggers are met.
- [ ] Execute Option 3 unified membership role model after storage separation hardens.

## Risks and Mitigations

- Risk: dual-source complexity (repo content + cloud campaign content)
  - Mitigation: campaign-only separation first; keep contracts narrow and explicit.
- Risk: auth bypass via direct asset URLs
  - Mitigation: private bucket plus authorized serving path, no direct public links for private assets.
- Risk: runtime dependency outages
  - Mitigation: deny-by-default plus targeted caching and runbooks.

## Success Criteria

1. Repository can be public without exposing campaign private content in tracked files/history.
2. Campaign content remains accessible only through authorized routes.
3. Campaign URL structure and core UX remain stable.
4. Team can continue Obsidian-first authoring with sync automation.

## Related References

- `plans/potential-todos-2026-03-16.md`
- `plans/adrs/0001-obsidian-first-content-architecture.md`
- `plans/adrs/0004-campaigns-astro-native-content-access-policy.md`
- `plans/auth-production-account-management-mvp-options-2026-03.md`
- `plans/content-sync-workflow-plan.md`

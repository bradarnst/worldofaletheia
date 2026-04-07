# SEO and Crawler Governance Policy: Discoverability with Layered Bot Control

## Status

Accepted

## Context and Problem Statement

World of Aletheia must be discoverable through mainstream search while also limiting unwanted crawling and scraping behavior.

The current platform already has:

- Astro-native rendering and metadata foundation,
- cloud-backed content delivery and indexing infrastructure,
- campaign access boundaries with fail-closed behavior for protected content.

What is missing is a formal policy that defines:

- which surfaces should be indexed,
- which surfaces must never be indexed,
- and how crawler pressure is controlled without harming legitimate discovery.

## Decision Drivers

- Improve discoverability for target topics (worldbuilding, tabletop RPG, GURPS, campaign tooling, Obsidian workflow).
- Preserve campaign privacy and fail-closed access semantics.
- Avoid relying on robots directives as a security control.
- Keep implementation Astro-native and operationally simple.
- Establish a durable cross-domain policy (Canon, Using Aletheia, Campaigns).

## Considered Options

### Option 1: Open crawl policy with minimal controls

Allow broad indexing and rely mostly on default crawler behavior.

**Pros**

- Lowest implementation effort.
- Maximum crawl access for search engines.

**Cons**

- Higher scraper/bot pressure risk.
- Weak control over indexing of low-value auth/account surfaces.
- No clear governance for protected or sensitive endpoints.

### Option 2: Broad bot blocking and aggressive crawl suppression

Attempt to block most crawlers and heavily restrict bot traffic.

**Pros**

- Reduces some scraper pressure.

**Cons**

- Directly harms legitimate search discoverability.
- Conflicts with product goal of being findable.
- Increases false-positive operational risk.

### Option 3: Selective indexability with layered crawler governance (Chosen)

Index public knowledge surfaces, noindex auth/session/account surfaces, and enforce anti-abuse at edge while keeping legitimate search crawling available.

**Pros**

- Balances discoverability and abuse control.
- Preserves campaign privacy boundaries.
- Works with existing Astro + Cloudflare architecture.

**Cons**

- Requires explicit ongoing policy and rule maintenance.
- Bot controls need periodic tuning to avoid false positives.

## Decision Outcome

Chosen option: Option 3 - selective indexability with layered crawler governance.

### Policy

1. Public Canon and Using Aletheia surfaces are indexable by default.
2. Reference routes (`/references/calendar`, `/references/timeline`, `/references/maps`) are indexable when publicly available.
3. Auth/account/session-facing routes use `noindex,nofollow`.
4. Protected campaign/member content remains inaccessible and non-indexable by access control, independent of crawler directives.
5. `robots.txt` provides advisory crawl rules and sitemap references but is not treated as a security boundary.
6. Edge controls (WAF, bot management, rate limiting) are authoritative for abusive crawler behavior.
7. Staging environments are noindex by default.

### Consequences

#### Positive

- Better alignment between SEO goals and access-control posture.
- Improved query discoverability for target subject areas.
- Lower operational risk from naive over-blocking.

#### Negative

- Additional operational work for crawler-rule tuning.
- Requires ongoing monitoring of bot behavior and index coverage.

#### Neutral

- Does not change Obsidian-first content authoring flow.
- Does not introduce new service/adaptor/contract layers.
- Aligns with the four-layer information architecture after ADR-0018 and does not otherwise change content-source or service boundaries.

# SEO Telemetry Runbook: Search Console and Bing

This runbook covers Phase 4 measurement for World of Aletheia SEO and crawler governance.

## Search Properties

Create and verify:

- Google Search Console property for `https://worldofaletheia.com`
- Bing Webmaster Tools property for `https://worldofaletheia.com`

Preferred verification method: DNS record at the zone level.

## Initial Submission

After verification:

1. Submit `https://worldofaletheia.com/sitemap.xml`
2. Confirm `https://worldofaletheia.com/robots.txt` is reachable
3. Request indexing for:
   - `/`
   - `/about`
   - `/lore`
   - `/systems`
   - `/calendar`
   - `/timeline`

## Query Themes to Watch

Track impressions/clicks for:

- worldbuilding
- tabletop RPG / TTRPG
- fantasy setting
- GURPS
- campaign setting
- Obsidian markdown workflow
- custom calendar / fantasy timeline

## Coverage Checks

Review monthly:

- indexed pages count
- excluded pages count
- noindex compliance for `/login`, `/account`, `/logout`
- crawl anomalies on `/api/*` or protected campaign routes
- duplicate title/description warnings

## Operational Metrics

Review in parallel with Cloudflare analytics:

- top crawled paths
- bot score / challenge events
- rate-limit triggers
- country/ASN concentration for scrape traffic
- false positives affecting real users or search bots

## Iteration Loop

When telemetry shows weak performance:

1. improve page title/description specificity
2. strengthen internal links between canon, systems, calendar, and timeline surfaces
3. tighten or loosen Cloudflare rules based on observed abuse
4. re-submit affected URLs after meaningful metadata or content updates

## Reporting Cadence

Use a lightweight monthly review with:

- top gaining queries
- top landing pages
- pages excluded by design
- bot pressure changes
- recommended next SEO action

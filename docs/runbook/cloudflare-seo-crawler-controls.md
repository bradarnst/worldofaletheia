# Cloudflare SEO and Crawler Controls Runbook

This runbook defines the Phase 2 edge-control baseline for World of Aletheia.

## Goal

Allow legitimate search indexing while reducing abusive scrape and bot pressure.

## Principles

- `robots.txt` is advisory, not security.
- Protected campaign content stays fail-closed through application access control.
- Edge rules focus on challenge/rate-limit before broad blocking.
- Rollback must be fast and low-risk.

## Rule Groups

### 1. Managed bot and WAF baseline

Enable Cloudflare managed WAF rules and Bot Fight Mode or equivalent bot management features that are already available on the zone plan.

### 2. Rate limits by path class

Recommended initial thresholds:

- `/api/auth/*`
  - 20 requests per minute per IP
  - action: managed challenge, then block on repeated abuse
- `/api/search`
  - 60 requests per minute per IP
  - action: managed challenge
- `/api/contact`
  - 10 requests per minute per IP
  - action: block
- `/api/campaign-media/*`
  - 120 requests per minute per IP
  - action: managed challenge
- `/campaigns/*`
  - 120 requests per minute per IP
  - action: managed challenge

Tune thresholds after observing real traffic.

### 3. Custom WAF expressions

Start with challenge rules for:

- empty or missing user-agent on non-asset requests
- obviously automated high-frequency API access
- repeated 4xx/403 behavior against protected campaign routes
- ASN/IP patterns seen in logs to be scraping aggressively

### 4. Optional AI crawler handling

If stricter crawler governance is desired, add challenge or block rules for selected user-agent signatures after log validation. Recommended starting point is `managed challenge`, not immediate block.

Candidate signatures to review before enforcement:

- `GPTBot`
- `ClaudeBot`
- `CCBot`
- `Bytespider`
- `PerplexityBot`
- `Amazonbot`
- `Google-Extended`

Do not block mainstream search crawlers such as Googlebot or Bingbot without an explicit product decision.

## Deployment Procedure

1. Apply rules in staging first.
2. Validate public browsing, auth flows, and campaign access in staging.
3. Review Cloudflare security events for false positives.
4. Promote the same rule set to production.
5. Re-check:
   - `/robots.txt`
   - `/sitemap.xml`
   - `/login`
   - `/account`
   - `/api/search?q=test`
   - one public campaign URL
   - one protected campaign URL

## Rollback

Rollback order:

1. Disable newest custom WAF rules first.
2. Relax rate limits on affected path class.
3. Re-test public browsing and auth.
4. Leave app-level protections unchanged.

## Ownership

- Application policy: repository ADRs and route metadata
- Edge enforcement: Cloudflare dashboard configuration
- Verification: Cloudflare security events + application logs

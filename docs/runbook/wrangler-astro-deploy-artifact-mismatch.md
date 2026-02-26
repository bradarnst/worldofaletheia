# Runbook: Wrangler Deploy Artifact Mismatch (`dist/server/wrangler.json`)

Use this when deploy/dev fails with errors like:

- `There is a deploy configuration at ".wrangler/deploy/config.json"`
- `redirected configuration path ... "dist/server/wrangler.json" does not exist`

## Why this happens

After Astro/Wrangler/Cloudflare updates, deploy metadata in [`.wrangler/deploy/config.json`](../../.wrangler/deploy/config.json) can point to server artifacts that are missing if the project built in static mode or build failed before server output generation.

In this repo, Cloudflare deploy expects server output from [`astro.config.mjs`](../../astro.config.mjs).

## Fast diagnosis

1. Check Astro output mode in [`astro.config.mjs`](../../astro.config.mjs).
   - For Cloudflare deploy flow, it should be `output: 'server'`.
2. Check if server deploy artifact exists:

```bash
test -f dist/server/wrangler.json && echo OK || echo MISSING
```

3. If missing, run a build and inspect first failure:

```bash
pnpm build
```

## Deterministic recovery

1. Clear stale wrangler deploy redirect state:

```bash
rm -rf ./.wrangler/deploy
```

2. Ensure server output is configured in [`astro.config.mjs`](../../astro.config.mjs):

```js
output: 'server'
```

3. Rebuild:

```bash
pnpm build
```

4. Verify artifact was generated:

```bash
test -f dist/server/wrangler.json && echo SERVER_WRANGLER_PRESENT
```

5. Deploy:

```bash
pnpm wrangler deploy
```

## If build fails before deploy

Fix the first build error first (example from this repo: invalid image path in markdown content), then repeat the recovery steps above.

## Prevention after dependency upgrades

After bumping Astro/Wrangler/Cloudflare packages:

1. Run:

```bash
pnpm build
pnpm wrangler deploy
```

2. If either fails with deploy-artifact mismatch, run the recovery sequence in this runbook.

3. Keep Cloudflare deploy path aligned with server output expectations in [`astro.config.mjs`](../../astro.config.mjs).

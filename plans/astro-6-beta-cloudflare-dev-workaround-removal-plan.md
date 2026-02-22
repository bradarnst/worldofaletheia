# Astro 6 Beta + Cloudflare Dev Workaround Removal Plan

## Context

During the upgrade to [`astro@6.0.0-beta.14`](../package.json:20), local dev with [`@astrojs/cloudflare`](../package.json:17) under pnpm hit repeated dev-only regressions:

- `Expected miniflare to be defined` from [`@cloudflare/vite-plugin`](../node_modules/.pnpm/@cloudflare+vite-plugin@1.25.2_vite@7.3.1_jiti@2.6.1_lightningcss@1.31.1_yaml@2.8.2__wo_0ae2933e6fef2f21a70c34440aae4aea/node_modules/@cloudflare/vite-plugin/dist/index.mjs:1734)
- `require is not defined` from [`picomatch/index.js`](../node_modules/.pnpm/picomatch@4.0.3/node_modules/picomatch/index.js:3)
- Missing chunks in [`node_modules/.vite/deps_ssr`](../node_modules/.vite/deps_ssr)

Temporary stabilization was applied:

- Conditional adapter in dev at [`adapter: isDevCommand ? undefined : cloudflare()`](../astro.config.mjs:19)
- Direct dev dependency [`miniflare`](../package.json:31)
- Workers compatibility flag [`nodejs_compat`](../wrangler.jsonc:3)

This document defines exactly how to remove temporary workarounds after upstream fixes land (e.g., a later beta).

---

## Target End State (Normal Configuration)

1. Unconditional Cloudflare adapter in [`astro.config.mjs`](../astro.config.mjs:19):
   - `adapter: cloudflare()`
2. No command-based adapter gating logic in [`astro.config.mjs`](../astro.config.mjs:9)
3. No temporary Vite SSR workarounds (`optimizeDeps.exclude` / `ssr.noExternal`) in [`astro.config.mjs`](../astro.config.mjs:12)
4. Optional: remove direct [`miniflare`](../package.json:31) if no longer needed
5. Keep [`nodejs_compat`](../wrangler.jsonc:3) unless release notes explicitly confirm safe removal

---

## Version Alignment Rules

When testing workaround removal, upgrade Astro and Cloudflare adapter together:

- Keep prerelease lines aligned between [`astro`](../package.json:20) and [`@astrojs/cloudflare`](../package.json:17)
- Do **not** mix Astro 6 beta with Cloudflare adapter lines that peer against Astro 5

Pre-check commands:

```bash
pnpm info @astrojs/cloudflare@latest peerDependencies --json
pnpm why astro @astrojs/cloudflare wrangler
```

Upgrade command:

```bash
pnpm up astro@6.0.0-beta.15 @astrojs/cloudflare@latest wrangler@latest
pnpm install
```

---

## Removal Procedure

### Step 1 — Re-enable normal adapter behavior

In [`astro.config.mjs`](../astro.config.mjs:19):

- Remove [`isDevCommand`](../astro.config.mjs:9)
- Replace conditional adapter with unconditional:
  - `adapter: cloudflare()`

### Step 2 — Keep direct miniflare temporarily for first pass

Keep [`miniflare`](../package.json:31) for the first verification cycle to reduce variables.

### Step 3 — Clear dev optimizer cache and run dev

```bash
rm -rf node_modules/.vite
pnpm run dev -- --force
```

Expected results:

- No `Expected miniflare to be defined` from [`@cloudflare/vite-plugin`](../node_modules/.pnpm/@cloudflare+vite-plugin@1.25.2_vite@7.3.1_jiti@2.6.1_lightningcss@1.31.1_yaml@2.8.2__wo_0ae2933e6fef2f21a70c34440aae4aea/node_modules/@cloudflare/vite-plugin/dist/index.mjs:1734)
- No `require is not defined` from [`picomatch`](../node_modules/.pnpm/picomatch@4.0.3/node_modules/picomatch/index.js:3)
- No recurring missing files in [`deps_ssr`](../node_modules/.vite/deps_ssr)

### Step 4 — Production path verification

```bash
pnpm build
pnpm preview
```

Expected results:

- Build completes with Cloudflare adapter active from [`cloudflare()`](../astro.config.mjs:19)
- Preview serves key routes without runtime import failures

### Step 5 — Remove direct miniflare (only after green pass)

```bash
pnpm remove -D miniflare
rm -rf node_modules/.vite
pnpm run dev -- --force
pnpm build
```

Expected results remain green after removing [`miniflare`](../package.json:31).

---

## Rollback Trigger and Fast Recovery

If any of the following reappear during removal:

- `Expected miniflare to be defined`
- `require is not defined` in [`picomatch`](../node_modules/.pnpm/picomatch@4.0.3/node_modules/picomatch/index.js:3)
- repeated missing SSR chunks in [`node_modules/.vite/deps_ssr`](../node_modules/.vite/deps_ssr)

Immediately rollback:

1. Restore conditional adapter in [`astro.config.mjs`](../astro.config.mjs:19):
   - `adapter: isDevCommand ? undefined : cloudflare()`
2. Restore or keep direct [`miniflare`](../package.json:31)
3. Keep current known-good version pair in [`package.json`](../package.json:17) and [`package.json`](../package.json:20)
4. Re-run:

```bash
rm -rf node_modules/.vite
pnpm run dev -- --force
```

---

## Notes

- Campaign/session empty warnings are separate from runtime tooling and come from collection availability under [`src/content.config.ts`](../src/content.config.ts:136).
- This plan is focused strictly on removing temporary runtime/tooling workarounds safely.

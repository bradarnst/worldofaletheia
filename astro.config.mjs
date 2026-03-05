// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// Keep local dev on Astro's default adapter/runtime to avoid Cloudflare worker-runner CJS interop failures.
// @ts-ignore - process is available in Node when evaluating Astro config
const isDevCommand = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: isDevCommand ? undefined : cloudflare(),
});

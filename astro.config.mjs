// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';
import { viteAliases } from './config/vite-aliases.mjs';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://worldofaletheia.com',
  integrations: [],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: viteAliases,
    },
  },

  adapter: cloudflare({
    imageService: 'passthrough',
  }),
});

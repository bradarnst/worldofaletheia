// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

/**
 * @param {string} value
 */
const fromRoot = (value) => decodeURIComponent(new URL(value, import.meta.url).pathname);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: 'https://worldofaletheia.com',
  integrations: [],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': fromRoot('./src'),
        '@components': fromRoot('./src/components'),
        '@layouts': fromRoot('./src/layouts'),
        '@pages': fromRoot('./src/pages'),
        '@styles': fromRoot('./src/styles'),
        '@utils': fromRoot('./src/utils'),
        '@data': fromRoot('./src/data'),
        '@assets': fromRoot('./src/assets'),
        '@images': fromRoot('./src/assets/images'),
        '@services': fromRoot('./src/services'),
        '@adapters': fromRoot('./src/adapters'),
        '@contracts': fromRoot('./src/contracts'),
      },
    },
  },

  adapter: cloudflare({
    imageService: 'passthrough',
  }),
});

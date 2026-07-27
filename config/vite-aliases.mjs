// config/vite-aliases.mjs
// Shared Vite aliases for Astro and Vitest. Keep this module adapter-free so
// Vitest can load Astro's Vite config without initializing the Cloudflare adapter.

/**
 * @param {string} value
 */
const fromRoot = (value) => decodeURIComponent(new URL(`../${value}`, import.meta.url).pathname);

export const viteAliases = {
  '~': fromRoot('src'),
  '@components': fromRoot('src/components'),
  '@layouts': fromRoot('src/layouts'),
  '@pages': fromRoot('src/pages'),
  '@styles': fromRoot('src/styles'),
  '@utils': fromRoot('src/utils'),
  '@data': fromRoot('src/data'),
  '@assets': fromRoot('src/assets'),
  '@images': fromRoot('src/assets/images'),
  '@services': fromRoot('src/services'),
  '@adapters': fromRoot('src/adapters'),
  '@contracts': fromRoot('src/contracts'),
};

import { getViteConfig } from 'astro/config';
import { viteAliases } from './config/vite-aliases.mjs';

// Load the Astro Vite plugins and project aliases so component tests exercise
// browser-facing `.astro` output through Astro's supported Container API.
export default getViteConfig(
  {
    resolve: {
      alias: viteAliases,
    },
  },
  {
    configFile: false,
    site: 'https://worldofaletheia.com',
    integrations: [],
  },
);

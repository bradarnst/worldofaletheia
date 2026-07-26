import { getViteConfig } from 'astro/config';

const fromRoot = (value: string) => decodeURIComponent(new URL(value, import.meta.url).pathname);

// Load the Astro Vite plugins and project aliases so component tests exercise
// browser-facing `.astro` output through Astro's supported Container API.
export default getViteConfig(
  {
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
  {
    configFile: false,
    site: 'https://worldofaletheia.com',
    integrations: [],
  },
);

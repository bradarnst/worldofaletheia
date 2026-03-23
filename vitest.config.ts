import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (value: string) => fileURLToPath(new URL(value, import.meta.url));

export default defineConfig({
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
});

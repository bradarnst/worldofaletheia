import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function resolveWranglerCommand() {
  try {
    return join(dirname(require.resolve('wrangler/package.json')), 'bin', 'wrangler.js');
  } catch {
    return 'wrangler';
  }
}

import type { APIRoute } from 'astro';
import { getAuth } from '~/lib/auth';
import { getNoIndexHeaders } from '@utils/seo';

const REQUIRED_AUTH_ENV_KEYS = [
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

async function getAuthEnvDiagnostics(): Promise<{
  hasRuntimeEnv: boolean;
  hasDbBinding: boolean;
  requiredVarStatus: { key: string; present: boolean }[];
}> {
  let runtimeEnv: Record<string, unknown> | null = null;

  // Astro v6 (Cloudflare): use cloudflare:workers module directly
  try {
    const { env: cfEnv } = await import('cloudflare:workers');
    runtimeEnv = cfEnv as Record<string, unknown>;
  } catch {
    // cloudflare:workers not available (should not happen in Cloudflare runtime)
    runtimeEnv = null;
  }

  const hasDbBinding =
    !!runtimeEnv &&
    typeof runtimeEnv === 'object' &&
    'DB' in runtimeEnv &&
    !!(runtimeEnv as Record<string, unknown>).DB;

  const requiredVarStatus = REQUIRED_AUTH_ENV_KEYS.map((key) => {
    const value = runtimeEnv?.[key];

    return {
      key,
      present: typeof value === 'string' && value.length > 0,
    };
  });

  return {
    hasRuntimeEnv: !!runtimeEnv,
    hasDbBinding,
    requiredVarStatus,
  };
}

export const ALL: APIRoute = async ({ request, locals }) => {
  try {
    const auth = await getAuth(locals);
    const response = await auth.handler(request);

    if (!response) {
      const diagnostics = await getAuthEnvDiagnostics();
      console.error('auth.handler.returned_null', {
        path: new URL(request.url).pathname,
        method: request.method,
        diagnostics,
      });
      return new Response(JSON.stringify({ error: 'auth_handler_null' }), {
        status: 500,
        headers: getNoIndexHeaders('application/json'),
      });
    }

    response.headers.set('x-robots-tag', 'noindex, nofollow');
    return response;
  } catch (error) {
    const diagnostics = await getAuthEnvDiagnostics();
    console.error('auth.route.unhandled_error', {
      message: error instanceof Error ? error.message : 'unknown error',
      path: new URL(request.url).pathname,
      diagnostics,
    });

    return new Response(JSON.stringify({ error: 'authentication_unavailable' }), {
      status: 500,
      headers: getNoIndexHeaders('application/json'),
    });
  }
};

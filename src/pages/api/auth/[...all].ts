import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/auth';

const REQUIRED_AUTH_ENV_KEYS = [
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

function getAuthEnvDiagnostics(locals: unknown) {
  const runtimeEnv =
    locals && typeof locals === 'object'
      ? ((locals as { runtime?: { env?: Record<string, unknown> } }).runtime?.env ?? null)
      : null;

  const hasDbBinding =
    !!runtimeEnv &&
    typeof runtimeEnv === 'object' &&
    'DB' in runtimeEnv &&
    !!(runtimeEnv as Record<string, unknown>).DB;

  const requiredVarStatus = REQUIRED_AUTH_ENV_KEYS.map((key) => ({
    key,
    present: typeof runtimeEnv?.[key] === 'string' && runtimeEnv[key].length > 0,
  }));

  return {
    hasRuntimeEnv: !!runtimeEnv,
    hasDbBinding,
    requiredVarStatus,
  };
}

export const ALL: APIRoute = async ({ request, locals }) => {
  try {
    const auth = getAuth(locals);
    return await auth.handler(request);
  } catch (error) {
    console.error('auth.route.unhandled_error', {
      message: error instanceof Error ? error.message : 'unknown error',
      path: new URL(request.url).pathname,
      diagnostics: getAuthEnvDiagnostics(locals),
    });

    return new Response(JSON.stringify({ error: 'authentication_unavailable' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};


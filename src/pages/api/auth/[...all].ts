import type { APIRoute } from 'astro';
import { getAuth } from '~/lib/auth';
import { normalizeEmail } from '~/lib/email-normalization';
import { getNoIndexHeaders } from '@utils/seo';

const REQUIRED_AUTH_ENV_KEYS = [
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'PASSWORD_HASH_PEPPER',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

const EMAIL_NORMALIZED_AUTH_PATHS = new Set([
  '/api/auth/sign-in/email',
  '/api/auth/sign-up/email',
  '/api/auth/request-password-reset',
]);

function cloneHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers(headers);
  nextHeaders.delete('content-length');
  return nextHeaders;
}

function getContentType(headers: Headers): string {
  return headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
}

function createRequestWithBody(request: Request, body: BodyInit, contentType: string): Request {
  const headers = cloneHeaders(request.headers);
  headers.set('content-type', contentType);

  return new Request(request.url, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
    signal: request.signal,
  });
}

async function normalizeCredentialEmailRequest(request: Request): Promise<Request> {
  if (request.method.toUpperCase() !== 'POST') {
    return request;
  }

  const { pathname } = new URL(request.url);
  if (!EMAIL_NORMALIZED_AUTH_PATHS.has(pathname)) {
    return request;
  }

  const contentType = getContentType(request.headers);

  try {
    if (contentType === 'application/json') {
      const body = (await request.clone().json()) as unknown;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return request;
      }

      const nextBody = { ...body } as Record<string, unknown>;
      if (typeof nextBody.email === 'string') {
        nextBody.email = normalizeEmail(nextBody.email);
      }

      return createRequestWithBody(request, JSON.stringify(nextBody), 'application/json');
    }

    if (contentType === 'application/x-www-form-urlencoded' || contentType === '') {
      const params = new URLSearchParams(await request.clone().text());
      const email = params.get('email');
      if (email !== null) {
        params.set('email', normalizeEmail(email));
      }

      return createRequestWithBody(request, params, 'application/x-www-form-urlencoded');
    }

    if (contentType === 'multipart/form-data') {
      const formData = await request.clone().formData();
      const email = formData.get('email');
      if (typeof email === 'string') {
        formData.set('email', normalizeEmail(email));
      }

      const headers = cloneHeaders(request.headers);
      headers.delete('content-type');

      return new Request(request.url, {
        method: request.method,
        headers,
        body: formData,
        redirect: request.redirect,
        signal: request.signal,
      });
    }
  } catch {
    return request;
  }

  return request;
}

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
    const authRequest = await normalizeCredentialEmailRequest(request);
    const response = await auth.handler(authRequest);

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

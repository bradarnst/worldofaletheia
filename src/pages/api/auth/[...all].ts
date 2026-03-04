import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/auth';

export const ALL: APIRoute = async ({ request, locals }) => {
  try {
    const auth = getAuth(locals);
    return await auth.handler(request);
  } catch (error) {
    console.error('auth.route.unhandled_error', {
      message: error instanceof Error ? error.message : 'unknown error',
      path: new URL(request.url).pathname,
    });

    return new Response(JSON.stringify({ error: 'authentication_unavailable' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};


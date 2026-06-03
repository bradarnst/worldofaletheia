import type { APIRoute } from 'astro';
import { getD1BindingFromLocals } from '~/lib/d1';
import { requestPasswordReset } from '~/lib/password-reset';
import { getNoIndexHeaders } from '@utils/seo';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '');
  const db = await getD1BindingFromLocals(locals);
  const { env } = await import('cloudflare:workers');

  await requestPasswordReset({
    db,
    env: env as Record<string, unknown>,
    email,
    clientIp: request.headers.get('cf-connecting-ip') ?? undefined,
  });

  const response = redirect('/forgot-password?sent=1', 303);
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
};

export const GET: APIRoute = async () =>
  new Response(null, {
    status: 405,
    headers: getNoIndexHeaders(),
  });

import type { APIRoute } from 'astro';
import { getD1BindingFromLocals } from '~/lib/d1';
import { completePasswordReset } from '~/lib/password-reset';
import { getNoIndexHeaders } from '@utils/seo';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const db = await getD1BindingFromLocals(locals);
  const { env } = await import('cloudflare:workers');

  const result = await completePasswordReset({
    db,
    env: env as Record<string, unknown>,
    token,
    newPassword,
    confirmPassword,
  });

  const response = redirect(result.ok ? '/reset-password?status=complete' : '/reset-password?status=invalid', 303);
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
};

export const GET: APIRoute = async () =>
  new Response(null, {
    status: 405,
    headers: getNoIndexHeaders(),
  });

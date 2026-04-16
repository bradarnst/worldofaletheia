import type { APIRoute } from 'astro';
import { PRODUCTION_SITE_ORIGIN, isProductionHostname } from '@utils/seo';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);

  if (!isProductionHostname(url.hostname)) {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  }

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /login',
    'Disallow: /account',
    'Disallow: /logout',
    '',
    `Sitemap: ${PRODUCTION_SITE_ORIGIN}/sitemap.xml`,
  ].join('\n');

  return new Response(`${body}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};

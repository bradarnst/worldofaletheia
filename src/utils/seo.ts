export const PRODUCTION_SITE_ORIGIN = 'https://worldofaletheia.com';
const PRODUCTION_HOSTNAMES = new Set(['worldofaletheia.com', 'www.worldofaletheia.com']);
const AUTO_NOINDEX_PATHS = new Set(['/login', '/account', '/logout']);

export function isProductionHostname(hostname: string): boolean {
  return PRODUCTION_HOSTNAMES.has(hostname);
}

export function buildCanonicalUrl(pathname: string): string {
  return new URL(pathname || '/', PRODUCTION_SITE_ORIGIN).toString();
}

export function shouldNoindexByPath(pathname: string): boolean {
  return AUTO_NOINDEX_PATHS.has(pathname);
}

export function getDefaultRobotsDirective(url: URL): string | undefined {
  if (!isProductionHostname(url.hostname) || shouldNoindexByPath(url.pathname)) {
    return 'noindex, nofollow';
  }

  return undefined;
}

export function getNoIndexHeaders(contentType?: string): HeadersInit {
  return {
    ...(contentType ? { 'content-type': contentType } : {}),
    'x-robots-tag': 'noindex, nofollow',
  };
}

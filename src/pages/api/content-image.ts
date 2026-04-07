import type { APIRoute } from 'astro';

/**
 * Serve general content images (non-campaign) from R2.
 * Images are stored at content/{collection}/assets/images/{path} in R2.
 * The loader rewrites __ASTRO_IMAGE_ relative paths to this handler's URL.
 */

function guessContentType(assetPath: string): string {
  const extension = assetPath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

async function getContentImageBucket() {
  const { env } = await import('cloudflare:workers');
  const bucket = (env as Record<string, unknown>).woa_campaign_private;
  if (!bucket || typeof (bucket as { get?: unknown }).get !== 'function') {
    throw new Error('R2 binding "woa_campaign_private" is unavailable in runtime environment');
  }
  return bucket as {
    get(key: string): Promise<{
      body: ReadableStream<Uint8Array> | null;
      httpEtag?: string;
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
        contentDisposition?: string;
        contentEncoding?: string;
        contentLanguage?: string;
      };
      writeHttpMetadata?: (headers: Headers) => void;
    } | null>;
  };
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key || typeof key !== 'string') {
    return new Response('Missing key parameter', { status: 400 });
  }

  // Security: ensure key is a safe R2 object key (no absolute paths, no traversal)
  const normalizedKey = key
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !segment.startsWith('.') && segment !== '..')
    .join('/');

  if (!normalizedKey || normalizedKey !== key) {
    return new Response('Invalid key', { status: 400 });
  }

  let bucket;
  try {
    bucket = await getContentImageBucket();
  } catch (err) {
    console.error('content-image.bucket_unavailable', {
      key,
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response('Service Unavailable', { status: 503 });
  }

  let object;
  try {
    object = await bucket.get(normalizedKey);
  } catch (err) {
    console.error('content-image.read_failed', {
      key: normalizedKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!object || !object.body) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === 'function') {
    object.writeHttpMetadata(headers);
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', object.httpMetadata?.contentType ?? guessContentType(normalizedKey));
  }

  if (!headers.has('cache-control')) {
    headers.set('cache-control', object.httpMetadata?.cacheControl ?? 'public, max-age=86400');
  }

  if (object.httpEtag && !headers.has('etag')) {
    headers.set('etag', object.httpEtag);
  }

  return new Response(object.body, { status: 200, headers });
};

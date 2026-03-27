export interface CampaignMediaObjectLike {
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
}

export interface CampaignMediaBucketLike {
  get(key: string): Promise<CampaignMediaObjectLike | null>;
}

export type CampaignMediaVariant = 'thumb' | 'detail' | 'fullscreen' | 'original';

function isCampaignMediaBucketLike(candidate: unknown): candidate is CampaignMediaBucketLike {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'get' in candidate &&
    typeof (candidate as { get?: unknown }).get === 'function'
  );
}

// Astro v6 (Cloudflare): use cloudflare:workers directly rather than locals.cfContext,
// since cfContext is not reliably populated on Astro.locals for API routes.
async function getCampaignMediaBucketFromEnv(): Promise<CampaignMediaBucketLike> {
  try {
    const { env } = await import('cloudflare:workers');
    const bucket = (env as Record<string, unknown>).woa_campaign_private;
    if (!isCampaignMediaBucketLike(bucket)) {
      throw new Error('Cloudflare R2 binding "woa_campaign_private" is unavailable in runtime environment');
    }
    return bucket;
  } catch (err) {
    if (err instanceof Error && err.message.includes('unavailable')) {
      throw err;
    }
    throw new Error('Cloudflare R2 binding "woa_campaign_private" is unavailable in runtime environment');
  }
}

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
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export function normalizeCampaignMediaVariant(value: string | undefined): CampaignMediaVariant | null {
  return value === 'thumb' || value === 'detail' || value === 'fullscreen' || value === 'original' ? value : null;
}

export function normalizeCampaignMediaAssetPath(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (normalized.length === 0 || normalized.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return normalized.join('/');
}

export function buildCampaignImageObjectKey(options: {
  campaignSlug: string;
  variant: CampaignMediaVariant;
  assetPath: string;
}): string {
  const basePath = `campaigns/${options.campaignSlug}/assets/images`;
  if (options.variant === 'original') {
    return `${basePath}/original/${options.assetPath}`;
  }

  return `${basePath}/variants/${options.variant}/${options.assetPath}`;
}

export async function getCampaignMediaBucketFromLocals(_locals: unknown): Promise<CampaignMediaBucketLike> {
  // locals parameter kept for API compatibility but ignored —
  // cloudflare:workers env is the canonical source in Astro v6 Cloudflare.
  return getCampaignMediaBucketFromEnv();
}

export function createCampaignMediaResponse(object: CampaignMediaObjectLike, assetPath: string): Response {
  const headers = new Headers();
  if (typeof object.writeHttpMetadata === 'function') {
    object.writeHttpMetadata(headers);
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', object.httpMetadata?.contentType ?? guessContentType(assetPath));
  }

  if (!headers.has('cache-control')) {
    headers.set('cache-control', object.httpMetadata?.cacheControl ?? 'private, max-age=300');
  }

  if (object.httpEtag && !headers.has('etag')) {
    headers.set('etag', object.httpEtag);
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

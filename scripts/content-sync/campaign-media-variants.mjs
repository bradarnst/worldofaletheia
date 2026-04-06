import path from 'node:path';
import sharp from 'sharp';

export const CAMPAIGN_IMAGE_VARIANTS = {
  thumb: { width: 480, height: 480 },
  detail: { width: 1280, height: 1280 },
  fullscreen: { width: 2560, height: 2560 },
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function normalizeRelativePath(relativePath) {
  return String(relativePath).trim().split('\\').join('/').replace(/^\/+/, '');
}

function getContentTypeForExtension(extension) {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

async function renderVariantBuffer(sourceAbs, extension, size) {
  const pipeline = sharp(sourceAbs).rotate().resize({
    width: size.width,
    height: size.height,
    fit: 'inside',
    withoutEnlargement: true,
  });

  switch (extension) {
    case '.png':
      return pipeline.png().toBuffer();
    case '.jpg':
    case '.jpeg':
      return pipeline.jpeg({ mozjpeg: true }).toBuffer();
    case '.webp':
      return pipeline.webp().toBuffer();
    default:
      throw new Error(`Unsupported campaign image variant extension: ${extension}`);
  }
}

export function getCampaignImageVariantPlan(relativePath) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const match = /^([^/]+)\/assets\/images\/original\/(.+)$/i.exec(normalizedRelativePath);
  if (!match) {
    return null;
  }

  const assetPath = match[2];
  const extension = path.extname(assetPath).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return null;
  }

  const variants = Object.entries(CAMPAIGN_IMAGE_VARIANTS).map(([variant, size]) => ({
    variant,
    size,
    relativePath: `${match[1]}/assets/images/variants/${variant}/${assetPath}`,
    contentType: getContentTypeForExtension(extension),
  }));

  return {
    campaignSlug: match[1],
    assetPath,
    extension,
    originalRelativePath: normalizedRelativePath,
    variants,
  };
}

export async function buildCampaignImageVariantUploads(sourceAbs, variantPlan) {
  return Promise.all(
    variantPlan.variants.map(async (variant) => ({
      variant: variant.variant,
      relativePath: variant.relativePath,
      contentType: variant.contentType,
      body: await renderVariantBuffer(sourceAbs, variantPlan.extension, variant.size),
    })),
  );
}

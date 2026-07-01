import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { isPublicSpellApiError, listSpells } from '@adapters/public-spell-api';
import { SPELLS_PAGE_SIZE, getSpellListPageHref } from '@utils/spell-browser';
import { getAllCampaignFamilyEntries, type CampaignFamilyEntry } from '@utils/campaign-content';
import {
  extractCampaignFamilySlugFromEntryId,
  extractCampaignSlugFromEntryId,
  getCampaignFamilySegmentByCollection,
} from '@utils/campaign-collections';
import { getFilteredCollection } from '@utils/content-filter';
import { buildCanonicalUrl, getNoIndexHeaders, isProductionHostname } from '@utils/seo';

interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
}

interface SitemapEntryDataLike {
  createdAt?: Date;
  updatedAt?: Date;
  start?: Date;
  end?: Date;
  date?: Date;
  campaign?: string;
  visibility?: string;
}

interface SitemapCollectionEntryLike {
  id: string;
  data: SitemapEntryDataLike;
}

function toIsoDate(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createUrlEntry(pathname: string, lastmod?: string): SitemapUrlEntry {
  return {
    loc: buildCanonicalUrl(pathname),
    lastmod,
  };
}

function pickEntryDate(data: SitemapEntryDataLike): string | undefined {
  return toIsoDate(data.updatedAt ?? data.createdAt);
}

function appendCollectionEntries<T extends SitemapCollectionEntryLike>(
  entries: SitemapUrlEntry[],
  collectionName: string,
  collection: T[],
): void {
  for (const entry of getFilteredCollection(collection)) {
    entries.push(createUrlEntry(`/${collectionName}/${entry.id}`, pickEntryDate(entry.data)));
  }
}

function pickCampaignDate(data: SitemapEntryDataLike): string | undefined {
  return toIsoDate(data.end ?? data.start ?? data.updatedAt ?? data.createdAt);
}

function pickDatedEntryDate(data: SitemapEntryDataLike): string | undefined {
  return toIsoDate(data.date ?? data.updatedAt ?? data.createdAt);
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  if (!isProductionHostname(url.hostname)) {
    return new Response('Not Found', {
      status: 404,
      headers: getNoIndexHeaders('text/plain; charset=utf-8'),
    });
  }

  const [
    lore,
    places,
    sentients,
    bestiary,
    flora,
    factions,
    systems,
    meta,
    campaigns,
    familyEntries,
  ] = await Promise.all([
    getCollection('lore'),
    getCollection('places'),
    getCollection('sentients'),
    getCollection('bestiary'),
    getCollection('flora'),
    getCollection('factions'),
    getCollection('systems'),
    getCollection('meta'),
    getCollection('campaigns'),
    getAllCampaignFamilyEntries(),
  ]);

  // Spell paths come from a runtime API that can be transiently unavailable
  // (429, 503, network errors). A flaky spell API must NOT take the entire
  // sitemap offline — that would degrade SEO for all the lore/places/campaign
  // content too. On failure we log and emit the sitemap without
  // spell paths; the next regeneration will pick them back up.
  let spellListPageCount = 1;
  try {
    const spellFirstPage = await listSpells({ page: 1, pageSize: SPELLS_PAGE_SIZE });
    spellListPageCount = Math.max(1, spellFirstPage.totalPages);
  } catch (error) {
    if (!isPublicSpellApiError(error)) {
      throw error;
    }
    console.warn(
      `[sitemap] Public spell API unavailable (status ${error.status}, error ${error.error}); emitting sitemap without spell paths.`,
    );
  }

  const sorcererSpellPaths = [
    '/systems/gurps/resources/sorcerer-spells',
    '/systems/gurps/resources/sorcerer-spells/all',
    ...Array.from({ length: Math.max(0, spellListPageCount - 1) }, (_, index) => getSpellListPageHref(index + 2)),
  ];

  const staticPaths = [
    '/',
    '/about',
    '/references/calendar',
    '/references/timeline',
    '/references/maps',
    '/campaigns',
    '/lore',
    '/places',
    '/sentients',
    '/bestiary',
    '/flora',
    '/factions',
    '/systems',
    '/meta',
    '/systems/gurps',
    '/systems/gurps/character-creation',
    '/systems/gurps/house-rules',
    '/systems/gurps/external-links',
    '/systems/gurps/resources',
    ...sorcererSpellPaths,
  ];

  const entries: SitemapUrlEntry[] = staticPaths.map((pathname) => createUrlEntry(pathname));

  appendCollectionEntries(entries, 'lore', lore);
  appendCollectionEntries(entries, 'places', places);
  appendCollectionEntries(entries, 'sentients', sentients);
  appendCollectionEntries(entries, 'bestiary', bestiary);
  appendCollectionEntries(entries, 'flora', flora);
  appendCollectionEntries(entries, 'factions', factions);
  appendCollectionEntries(entries, 'systems', systems);
  appendCollectionEntries(entries, 'meta', meta);

  const publicCampaigns = campaigns.filter((entry) => entry.data.visibility === 'public');
  const publicCampaignSlugs = new Set(publicCampaigns.map((entry) => extractCampaignSlugFromEntryId(entry.id)));

  for (const entry of publicCampaigns) {
    const slug = extractCampaignSlugFromEntryId(entry.id);
    entries.push(
      createUrlEntry(`/campaigns/${slug}`, pickCampaignDate(entry.data)),
    );
  }

  const familyIndexPaths = new Set<string>();
  for (const entry of familyEntries as CampaignFamilyEntry[]) {
    if (!publicCampaignSlugs.has(entry.data.campaign) || entry.data.visibility !== 'public') {
      continue;
    }

    const familySegment = getCampaignFamilySegmentByCollection(entry.collection);
    if (!familySegment) {
      continue;
    }

    familyIndexPaths.add(`/campaigns/${entry.data.campaign}/${familySegment}`);
    entries.push(createUrlEntry(`/campaigns/${entry.data.campaign}/${familySegment}/${extractCampaignFamilySlugFromEntryId(entry.id)}`, pickDatedEntryDate(entry.data)));
  }

  for (const pathname of familyIndexPaths) {
    entries.push(createUrlEntry(pathname));
  }

  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    if (seen.has(entry.loc)) {
      return false;
    }

    seen.add(entry.loc);
    return true;
  });

  const body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const entry of uniqueEntries) {
    body.push('  <url>');
    body.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) {
      body.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    }
    body.push('  </url>');
  }
  body.push('</urlset>');

  return new Response(`${body.join('\n')}\n`, {
    headers: {
      ...getNoIndexHeaders('application/xml; charset=utf-8'),
      'cache-control': 'public, max-age=3600',
    },
  });
};

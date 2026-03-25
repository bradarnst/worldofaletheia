export const CAMPAIGN_FAMILY_DEFINITIONS = {
  lore: {
    collection: 'campaignLore',
    label: 'Lore',
    description: 'Campaign-specific discoveries, histories, and living world notes.',
  },
  places: {
    collection: 'campaignPlaces',
    label: 'Places',
    description: 'Campaign-specific locations, regions, landmarks, and settlement notes.',
  },
  sentients: {
    collection: 'campaignSentients',
    label: 'Sentients',
    description: 'Campaign-specific peoples, cultures, organizations, and divine entities.',
  },
  bestiary: {
    collection: 'campaignBestiary',
    label: 'Bestiary',
    description: 'Campaign-specific creatures, monsters, beasts, and other dangerous life.',
  },
  flora: {
    collection: 'campaignFlora',
    label: 'Flora',
    description: 'Campaign-specific plants, crops, fungi, herbs, and natural resources.',
  },
  factions: {
    collection: 'campaignFactions',
    label: 'Factions',
    description: 'Groups, allegiances, and power structures active in the campaign.',
  },
  systems: {
    collection: 'campaignSystems',
    label: 'Systems',
    description: 'Campaign-specific rules, procedures, and play references.',
  },
  meta: {
    collection: 'campaignMeta',
    label: 'Meta',
    description: 'Campaign-facing notes, planning, and other using-the-setting material.',
  },
  characters: {
    collection: 'campaignCharacters',
    label: 'Characters',
    description: 'Player characters, allies, rivals, and other recurring figures.',
  },
  scenes: {
    collection: 'campaignScenes',
    label: 'Scenes',
    description: 'Set pieces, encounters, travel beats, and notable moments in play.',
  },
  adventures: {
    collection: 'campaignAdventures',
    label: 'Adventures',
    description: 'Quests, arcs, missions, and other adventure structures.',
  },
  hooks: {
    collection: 'campaignHooks',
    label: 'Hooks',
    description: 'Rumors, leads, jobs, threats, and open opportunities.',
  },
} as const;

export type CampaignFamilySegment = keyof typeof CAMPAIGN_FAMILY_DEFINITIONS;
export type CampaignFamilyCollection =
  (typeof CAMPAIGN_FAMILY_DEFINITIONS)[CampaignFamilySegment]['collection'];

export const CAMPAIGN_FAMILY_SEGMENTS = Object.keys(
  CAMPAIGN_FAMILY_DEFINITIONS,
) as CampaignFamilySegment[];

export const CAMPAIGN_FAMILY_COLLECTIONS = CAMPAIGN_FAMILY_SEGMENTS.map(
  (segment) => CAMPAIGN_FAMILY_DEFINITIONS[segment].collection,
) as CampaignFamilyCollection[];

export const CAMPAIGN_DOMAIN_COLLECTIONS = [
  'campaigns',
  'sessions',
  ...CAMPAIGN_FAMILY_COLLECTIONS,
] as const;

export type CampaignDomainCollection = (typeof CAMPAIGN_DOMAIN_COLLECTIONS)[number];

export function isCampaignFamilySegment(value: string): value is CampaignFamilySegment {
  return value in CAMPAIGN_FAMILY_DEFINITIONS;
}

export function getCampaignFamilyBySegment(
  segment: string | undefined,
): (typeof CAMPAIGN_FAMILY_DEFINITIONS)[CampaignFamilySegment] | null {
  if (!segment || !isCampaignFamilySegment(segment)) {
    return null;
  }

  return CAMPAIGN_FAMILY_DEFINITIONS[segment];
}

export function getCampaignFamilyByCollection(
  collection: string,
): (typeof CAMPAIGN_FAMILY_DEFINITIONS)[CampaignFamilySegment] | null {
  const segment = CAMPAIGN_FAMILY_SEGMENTS.find(
    (candidate) => CAMPAIGN_FAMILY_DEFINITIONS[candidate].collection === collection,
  );

  return segment ? CAMPAIGN_FAMILY_DEFINITIONS[segment] : null;
}

export function getCampaignFamilySegmentByCollection(
  collection: string,
): CampaignFamilySegment | null {
  return (
    CAMPAIGN_FAMILY_SEGMENTS.find(
      (candidate) => CAMPAIGN_FAMILY_DEFINITIONS[candidate].collection === collection,
    ) ?? null
  );
}

export function isCampaignDomainCollection(collection: string): collection is CampaignDomainCollection {
  return collection === 'campaigns' || collection === 'sessions' || collection.startsWith('campaign');
}

export function extractCampaignSlugFromEntryId(id: string): string {
  return id.split('/')[0] ?? '';
}

export function extractCampaignFamilySlugFromEntryId(id: string): string {
  const parts = id.split('/');
  return parts.slice(2).join('/');
}

export function extractLeafSlugFromEntryId(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? '';
}

export function buildCampaignContentHref(
  collection: string,
  slug: string,
  campaignSlug: string | null,
): string {
  if (collection === 'campaigns') {
    return `/campaigns/${slug}`;
  }

  if (collection === 'sessions') {
    return campaignSlug ? `/campaigns/${campaignSlug}/sessions/${slug}` : `/sessions/${slug}`;
  }

  const familySegment = getCampaignFamilySegmentByCollection(collection);
  if (familySegment && campaignSlug) {
    return `/campaigns/${campaignSlug}/${familySegment}/${slug}`;
  }

  return `/${collection}/${slug}`;
}

export function pickCampaignEntryDate(data: {
  date?: Date;
  modified?: Date;
  'modified-date'?: Date;
  created?: Date;
  'created-date'?: Date;
}): Date {
  return data.date ?? data.modified ?? data['modified-date'] ?? data.created ?? data['created-date'] ?? new Date(0);
}

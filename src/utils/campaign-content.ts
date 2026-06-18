import { getCollection, type CollectionEntry } from 'astro:content';
import type { CampaignFamilyCollection } from '@utils/campaign-collections';
import { getFilteredCollection } from '@utils/content-filter';

export type CampaignFamilyEntry =
  | CollectionEntry<'campaignLore'>
  | CollectionEntry<'campaignPlaces'>
  | CollectionEntry<'campaignSentients'>
  | CollectionEntry<'campaignBestiary'>
  | CollectionEntry<'campaignFlora'>
  | CollectionEntry<'campaignFactions'>
  | CollectionEntry<'campaignSystems'>
  | CollectionEntry<'campaignMeta'>
  | CollectionEntry<'campaignCharacters'>
  | CollectionEntry<'campaignScenes'>
  | CollectionEntry<'campaignAdventures'>
  | CollectionEntry<'campaignHooks'>;

export async function getCampaignFamilyCollectionEntries(
  collection: CampaignFamilyCollection,
): Promise<CampaignFamilyEntry[]> {
  switch (collection) {
    case 'campaignLore':
      return getFilteredCollection(await getCollection('campaignLore'));
    case 'campaignPlaces':
      return getFilteredCollection(await getCollection('campaignPlaces'));
    case 'campaignSentients':
      return getFilteredCollection(await getCollection('campaignSentients'));
    case 'campaignBestiary':
      return getFilteredCollection(await getCollection('campaignBestiary'));
    case 'campaignFlora':
      return getFilteredCollection(await getCollection('campaignFlora'));
    case 'campaignFactions':
      return getFilteredCollection(await getCollection('campaignFactions'));
    case 'campaignSystems':
      return getFilteredCollection(await getCollection('campaignSystems'));
    case 'campaignMeta':
      return getFilteredCollection(await getCollection('campaignMeta'));
    case 'campaignCharacters':
      return getFilteredCollection(await getCollection('campaignCharacters'));
    case 'campaignScenes':
      return getFilteredCollection(await getCollection('campaignScenes'));
    case 'campaignAdventures':
      return getFilteredCollection(await getCollection('campaignAdventures'));
    case 'campaignHooks':
      return getFilteredCollection(await getCollection('campaignHooks'));
  }

  throw new Error(`Unsupported campaign family collection: ${collection}`);
}

export async function getAllCampaignFamilyEntries(): Promise<CampaignFamilyEntry[]> {
  const [
    campaignLore,
    campaignPlaces,
    campaignSentients,
    campaignBestiary,
    campaignFlora,
    campaignFactions,
    campaignSystems,
    campaignMeta,
    campaignCharacters,
    campaignScenes,
    campaignAdventures,
    campaignHooks,
  ] = await Promise.all([
    getCollection('campaignLore'),
    getCollection('campaignPlaces'),
    getCollection('campaignSentients'),
    getCollection('campaignBestiary'),
    getCollection('campaignFlora'),
    getCollection('campaignFactions'),
    getCollection('campaignSystems'),
    getCollection('campaignMeta'),
    getCollection('campaignCharacters'),
    getCollection('campaignScenes'),
    getCollection('campaignAdventures'),
    getCollection('campaignHooks'),
  ]);

  return [
    ...getFilteredCollection(campaignLore),
    ...getFilteredCollection(campaignPlaces),
    ...getFilteredCollection(campaignSentients),
    ...getFilteredCollection(campaignBestiary),
    ...getFilteredCollection(campaignFlora),
    ...getFilteredCollection(campaignFactions),
    ...getFilteredCollection(campaignSystems),
    ...getFilteredCollection(campaignMeta),
    ...getFilteredCollection(campaignCharacters),
    ...getFilteredCollection(campaignScenes),
    ...getFilteredCollection(campaignAdventures),
    ...getFilteredCollection(campaignHooks),
  ];
}

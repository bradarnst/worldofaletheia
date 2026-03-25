import { getCollection, type CollectionEntry } from 'astro:content';
import type { CampaignFamilyCollection } from '@utils/campaign-collections';

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
      return getCollection('campaignLore');
    case 'campaignPlaces':
      return getCollection('campaignPlaces');
    case 'campaignSentients':
      return getCollection('campaignSentients');
    case 'campaignBestiary':
      return getCollection('campaignBestiary');
    case 'campaignFlora':
      return getCollection('campaignFlora');
    case 'campaignFactions':
      return getCollection('campaignFactions');
    case 'campaignSystems':
      return getCollection('campaignSystems');
    case 'campaignMeta':
      return getCollection('campaignMeta');
    case 'campaignCharacters':
      return getCollection('campaignCharacters');
    case 'campaignScenes':
      return getCollection('campaignScenes');
    case 'campaignAdventures':
      return getCollection('campaignAdventures');
    case 'campaignHooks':
      return getCollection('campaignHooks');
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
    ...campaignLore,
    ...campaignPlaces,
    ...campaignSentients,
    ...campaignBestiary,
    ...campaignFlora,
    ...campaignFactions,
    ...campaignSystems,
    ...campaignMeta,
    ...campaignCharacters,
    ...campaignScenes,
    ...campaignAdventures,
    ...campaignHooks,
  ];
}

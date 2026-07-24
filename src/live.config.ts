import { defineLiveCollection } from 'astro:content';
import { z } from 'astro/zod';
import { createCampaignContentLiveLoader } from '~/lib/campaign-content-live-loader';

const campaignContentLiveSchema = z.object({
  collection: z.literal('campaignContent'),
  campaign: z.string().trim().min(1),
  campaignSlug: z.string().trim().min(1),
  collectionKey: z.enum(['pages', 'notes']),
  documentId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  visibility: z.enum(['public', 'campaignMembers', 'gm']),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  type: z.string().trim().min(1),
  subtype: z.string().trim().min(1).optional(),
  excerpt: z.string().trim().min(1).optional(),
  tags: z.array(z.string()),
  authors: z.array(z.string()),
  contributors: z.array(z.string()),
  sourceMarkdown: z.string().optional(),
});

const campaignContent = defineLiveCollection({
  loader: createCampaignContentLiveLoader(),
  schema: campaignContentLiveSchema,
});

export const collections = {
  campaignContent,
};

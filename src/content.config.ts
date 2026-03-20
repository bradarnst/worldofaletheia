import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { createR2MarkdownCollectionLoader } from './lib/r2-content-loader.mjs';
import { resolveCollectionSource } from './lib/content-source-mode';

function createMarkdownLoader(collection: string, pattern: string, base: string) {
  if (resolveCollectionSource(collection) === 'cloud') {
    return createR2MarkdownCollectionLoader(collection);
  }

  return glob({ pattern, base });
}

// Base frontmatter schema for all collections
const baseSchema = z.object({
  status: z.enum(['draft', 'publish', 'published', 'archive', 'archived']),
  author: z.string(),
  created: z.coerce.date().optional(),
  'created-date': z.coerce.date().optional(),
  modified: z.coerce.date().optional(),
  'modified-date': z.coerce.date().optional(),
  // Deprecated: retained only for backward compatibility with existing content files.
  // Access control enforcement must ignore this field.
  secret: z.boolean().optional().default(false),
  tags: z.array(z.string()).default([]),
  campaign: z.string().optional(),
  // Deprecated role label metadata: never used as an authorization gate.
  permissions: z.enum(['public', 'player', 'gm', 'author']).optional().default('public'),
  // Informational only for non-campaign domains (Canon/Using).
  // Never used by authorization checks.
  gmResource: z.boolean().optional().default(false),
  // Legacy informational fields from previous metadata style.
  // Preserved for transition and normalized to gmResource by calling code when needed.
  gm: z.boolean().optional(),
  'gm-date': z.string().optional(),
  'gm-info': z.string().optional(),
  parentChain: z.array(z.object({
    label: z.string(),
    href: z.string(),
  })).optional(),
  relationships: z.array(z.object({
    label: z.string(),
    href: z.string(),
    kind: z.enum(['partOf', 'connectedTo']).optional(),
    reason: z.string().optional(),
  })).optional(),
});

const loreSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['cosmology', 'religion', 'economy', 'history', 'geography', 'food_and_drink', 'culture', 'language', 'warfare', 'domestication', 'magic', 'technology', 'structure', 'other']),
  excerpt: z.string().optional(),
});

const placesSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['location', 'landmark', 'dungeon', 'settlement', 'region', 'inhabitants', 'water']),
  excerpt: z.string().optional(),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
});

const sentientsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['race', 'species', 'culture', 'organization', 'deity']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const bestiarySchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['monster', 'animal', 'beast', 'spirit', 'construct', 'elemental']),
  excerpt: z.string().optional(),
  challengeRating: z.number().optional(),
});

const floraSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['tree', 'flower', 'fungus', 'herb', 'fruit', 'plant', 'crop']),
  excerpt: z.string().optional(),
});

const factionsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['guild', 'criminal', 'government', 'religion', 'military', 'police', 'school', 'order']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const systemsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['general', 'gurps']),
  subtype: z.enum(['magic', 'combat', 'skill', 'language', 'character', 'economy', 'social', 'equipment']),
  excerpt: z.string().optional(),
});

const campaignsSchema = baseSchema.omit({ status: true }).extend({
  title: z.string(),
  type: z.enum(['barry', 'brad']),
  subtype: z.enum(['bestiary', 'adventures', 'hooks', 'scenes', 'factions', 'flora', 'lore', 'meta', 'places', 'sentients', 'characters', 'general']),
  excerpt: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on-hold', 'cancelled']).optional(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('gm'),
  start: z.date().optional(),
  end: z.date().optional(),
});

const sessionsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['session', 'encounter', 'battle', 'note']),
  excerpt: z.string().optional(),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
  date: z.date().optional(),
  duration: z.number().optional(),
});

const lore = defineCollection({
  loader: createMarkdownLoader('lore', '**/*.md', 'src/content/lore'),
  schema: loreSchema,
});

const places = defineCollection({
  loader: createMarkdownLoader('places', '**/*.md', 'src/content/places'),
  schema: placesSchema,
});

const sentients = defineCollection({
  loader: createMarkdownLoader('sentients', '**/*.md', 'src/content/sentients'),
  schema: sentientsSchema,
});

const bestiary = defineCollection({
  loader: createMarkdownLoader('bestiary', '**/*.md', 'src/content/bestiary'),
  schema: bestiarySchema,
});

const flora = defineCollection({
  loader: createMarkdownLoader('flora', '**/*.md', 'src/content/flora'),
  schema: floraSchema,
});

const factions = defineCollection({
  loader: createMarkdownLoader('factions', '**/*.md', 'src/content/factions'),
  schema: factionsSchema,
});

const systems = defineCollection({
  loader: createMarkdownLoader('systems', '**/*.md', 'src/content/systems'),
  schema: systemsSchema,
});

const campaigns = defineCollection({
  loader: createMarkdownLoader('campaigns', '*/*.md', 'src/content/campaigns'),
  schema: campaignsSchema,
});

const sessions = defineCollection({
  loader: createMarkdownLoader('sessions', '*/sessions/*.md', 'src/content/campaigns'),
  schema: sessionsSchema,
});

const metaSchema = baseSchema.extend({
  title: z.string(),
  excerpt: z.string().optional(),
});

const meta = defineCollection({
  loader: createMarkdownLoader('meta', '**/*.md', 'src/content/meta'),
  schema: metaSchema,
});

const pagesSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  tldr: z.string().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: 'src/content' }),
  schema: pagesSchema,
});

export const collections = {
  lore,
  places,
  sentients,
  bestiary,
  flora,
  factions,
  systems,
  campaigns,
  sessions,
  meta,
  pages,
};

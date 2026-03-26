import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { createR2MarkdownCollectionLoader } from './lib/r2-content-loader.mjs';
import { resolveCollectionSource } from './lib/content-source-mode';
import { parseAletheiaDate, toAbsDay } from './lib/aletheia-calendar';

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
  // Preserved as optional honor-system metadata for UI labeling and filtering only.
  gm: z.boolean().optional(),
  'gm-date': z.string().optional(),
  'gm-info': z.union([z.boolean(), z.string()]).optional(),
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

const sharedLoreTypes = ['cosmology', 'religion', 'economy', 'history', 'geography', 'food_and_drink', 'culture', 'language', 'warfare', 'domestication', 'magic', 'technology', 'structure', 'other'] as const;
const loreTypes = [...sharedLoreTypes, 'event'] as const;

const loreSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(loreTypes),
  excerpt: z.string().optional(),
  aletheia_date: z.string().trim().min(1).optional(),
  aletheia_date_end: z.string().trim().min(1).optional(),
}).superRefine((data, ctx) => {
  const hasStartDate = Boolean(data.aletheia_date);
  const hasEndDate = Boolean(data.aletheia_date_end);
  const startDate = hasStartDate ? parseAletheiaDate(data.aletheia_date ?? '') : null;
  const endDate = hasEndDate ? parseAletheiaDate(data.aletheia_date_end ?? '') : null;

  if (data.type === 'event') {
    if (!hasStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date'],
        message: 'Lore entries with type event must define aletheia_date.',
      });
    }

    if (hasStartDate && !startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date'],
        message: 'aletheia_date must be a valid Aletheia calendar date.',
      });
    }

    if (hasEndDate && !endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date_end'],
        message: 'aletheia_date_end must be a valid Aletheia calendar date.',
      });
    }

    if (startDate && endDate && toAbsDay(endDate) < toAbsDay(startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aletheia_date_end'],
        message: 'aletheia_date_end must be on or after aletheia_date.',
      });
    }

    return;
  }

  if (hasStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aletheia_date'],
      message: 'Only lore entries with type event may define aletheia_date.',
    });
  }

  if (hasEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aletheia_date_end'],
      message: 'Only lore entries with type event may define aletheia_date_end.',
    });
  }
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
  type: z.enum(['political', 'guild', 'criminal', 'government', 'religion', 'military', 'police', 'school', 'order']),
  excerpt: z.string().optional(),
  alignment: z.enum(['lawful', 'neutral', 'chaotic', 'good', 'evil', 'any']).optional(),
});

const systemsSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['general', 'gurps']),
  subtype: z.enum(['magic', 'combat', 'skill', 'language', 'character', 'economy', 'social', 'equipment']),
  excerpt: z.string().optional(),
});

const metaSchema = baseSchema.extend({
  title: z.string(),
  excerpt: z.string().optional(),
});

const campaignsSchema = baseSchema.omit({ status: true }).extend({
  title: z.string(),
  type: z.string().trim().min(1).optional().default('campaign'),
  // Legacy field retained for backward compatibility with pre-family campaign metadata.
  // Campaign family is now represented by explicit collections (campaignLore, campaignPlaces, etc.).
  subtype: z.string().trim().min(1).optional(),
  excerpt: z.string().optional(),
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

const campaignLoreSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(sharedLoreTypes),
  excerpt: z.string().optional(),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignPlacesSchema = placesSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignSentientsSchema = sentientsSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignBestiarySchema = bestiarySchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignFloraSchema = floraSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignFactionsSchema = factionsSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignSystemsSchema = systemsSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignMetaSchema = metaSchema.extend({
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignCharactersSchema = sentientsSchema.extend({
  type: z.enum(['pc', 'npc', 'ally', 'adversary', 'patron', 'creature', 'group', 'other']),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
});

const campaignScenesSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['scene', 'combat', 'social', 'travel', 'downtime', 'investigation', 'flashback', 'other']),
  excerpt: z.string().optional(),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
  date: z.date().optional(),
});

const campaignAdventuresSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['arc', 'mission', 'quest', 'contract', 'dungeon', 'journey', 'heist', 'other']),
  excerpt: z.string().optional(),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
  date: z.date().optional(),
});

const campaignHooksSchema = baseSchema.extend({
  title: z.string(),
  type: z.enum(['rumor', 'lead', 'job', 'threat', 'mystery', 'opportunity', 'other']),
  excerpt: z.string().optional(),
  campaign: z.string(),
  visibility: z.enum(['public', 'campaignMembers', 'gm']).optional().default('campaignMembers'),
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
  loader: createMarkdownLoader('campaigns', '*/index.md', 'src/content/campaigns'),
  schema: campaignsSchema,
});

const sessions = defineCollection({
  loader: createMarkdownLoader('sessions', '*/sessions/*.md', 'src/content/campaigns'),
  schema: sessionsSchema,
});

const campaignLore = defineCollection({
  loader: createMarkdownLoader('campaignLore', '*/lore/**/*.md', 'src/content/campaigns'),
  schema: campaignLoreSchema,
});

const campaignPlaces = defineCollection({
  loader: createMarkdownLoader('campaignPlaces', '*/places/**/*.md', 'src/content/campaigns'),
  schema: campaignPlacesSchema,
});

const campaignSentients = defineCollection({
  loader: createMarkdownLoader('campaignSentients', '*/sentients/**/*.md', 'src/content/campaigns'),
  schema: campaignSentientsSchema,
});

const campaignBestiary = defineCollection({
  loader: createMarkdownLoader('campaignBestiary', '*/bestiary/**/*.md', 'src/content/campaigns'),
  schema: campaignBestiarySchema,
});

const campaignFlora = defineCollection({
  loader: createMarkdownLoader('campaignFlora', '*/flora/**/*.md', 'src/content/campaigns'),
  schema: campaignFloraSchema,
});

const campaignFactions = defineCollection({
  loader: createMarkdownLoader('campaignFactions', '*/factions/**/*.md', 'src/content/campaigns'),
  schema: campaignFactionsSchema,
});

const campaignSystems = defineCollection({
  loader: createMarkdownLoader('campaignSystems', '*/systems/**/*.md', 'src/content/campaigns'),
  schema: campaignSystemsSchema,
});

const campaignCharacters = defineCollection({
  loader: createMarkdownLoader('campaignCharacters', '*/characters/**/*.md', 'src/content/campaigns'),
  schema: campaignCharactersSchema,
});

const campaignScenes = defineCollection({
  loader: createMarkdownLoader('campaignScenes', '*/scenes/**/*.md', 'src/content/campaigns'),
  schema: campaignScenesSchema,
});

const campaignAdventures = defineCollection({
  loader: createMarkdownLoader('campaignAdventures', '*/adventures/**/*.md', 'src/content/campaigns'),
  schema: campaignAdventuresSchema,
});

const campaignHooks = defineCollection({
  loader: createMarkdownLoader('campaignHooks', '*/hooks/**/*.md', 'src/content/campaigns'),
  schema: campaignHooksSchema,
});

const campaignMeta = defineCollection({
  loader: createMarkdownLoader('campaignMeta', '*/meta/**/*.md', 'src/content/campaigns'),
  schema: campaignMetaSchema,
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
  meta,
  pages,
};

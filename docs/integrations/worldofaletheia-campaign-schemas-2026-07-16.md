# worldofaletheia.com campaign collection schema handoff

Date captured: 2026-07-16

Status: non-contract input evidence. This handoff records the current `worldofaletheia.com` Astro campaign collection schemas that seeded the authoritative Campaign Content contracts. The OpenAPI files in `docs/contracts/` are authoritative for cross-system API behavior and validation semantics.

## Source files inspected

- `/home/brad/gaming/worldofaletheia/src/content.config.ts`
- `/home/brad/gaming/worldofaletheia/src/lib/content-types.ts`
- `/home/brad/gaming/worldofaletheia/src/utils/campaign-collections.ts`

## Current collection registry

The sister site currently recognizes one root campaign page collection and twelve campaign-family collections. `campaignNotes` is not present in the inspected sister-site Astro schemas; it is carried into the new Campaign Content contract from the existing `woa-admin` Campaign Notes V1 model and must be reconciled through the new generic `notes` collection rather than reverse-engineered from the sister-site schema snapshot.

| URL/folder key | Current Astro collection | Current loader pattern | Notes for woa-admin contract |
| --- | --- | --- | --- |
| `pages` | `campaigns` | `*/index.md` | Legacy sister-site name. New contract uses canonical `campaignPages`; V1 supports root `index.md` and `about.md`. |
| `notes` | not present | not present | Seeded from existing `woa-admin` Campaign Notes V1. New contract uses canonical `campaignNotes`. |
| `lore` | `campaignLore` | `*/lore/**/*.md` | Shares lore type enum. |
| `places` | `campaignPlaces` | `*/places/**/*.md` | Shares places schema and optional coordinates. |
| `sentients` | `campaignSentients` | `*/sentients/**/*.md` | Shares sentients schema. |
| `bestiary` | `campaignBestiary` | `*/bestiary/**/*.md` | Shares bestiary schema. |
| `flora` | `campaignFlora` | `*/flora/**/*.md` | Shares flora schema. |
| `factions` | `campaignFactions` | `*/factions/**/*.md` | Shares factions schema. |
| `systems` | `campaignSystems` | `*/systems/**/*.md` | Shares systems schema. |
| `meta` | `campaignMeta` | `*/meta/**/*.md` | Shares meta schema. |
| `characters` | `campaignCharacters` | `*/characters/**/*.md` | Reuses sentients shape with campaign-character type enum. |
| `scenes` | `campaignScenes` | `*/scenes/**/*.md` | Campaign-specific scene schema with optional date. |
| `adventures` | `campaignAdventures` | `*/adventures/**/*.md` | Campaign-specific adventure schema with optional date. |
| `hooks` | `campaignHooks` | `*/hooks/**/*.md` | Campaign-specific hook schema. |

The sister-site loaders currently allow nested Markdown under most family folders. The Campaign Content Source API V1 intentionally narrows public IDs to one path segment and treats nested Markdown as unsupported until an explicit encoding rule is approved.

## Shared fields observed

The current sister-site `baseSchema` includes these relevant shared fields:

- `collection`: string, narrowed by each collection schema.
- `publication`: optional `preview | publish | archive`.
- `contentState`: optional `stable | mayChange | unfinished`, defaulting to `stable`.
- `audienceWarnings`: optional array containing `gmSpoilers`, defaulting to `[]`.
- `authors`: required non-empty string array.
- `contributors`: optional array of objects with `id` and `roles`.
- `createdAt`: required RFC3339 date-time string transformed to `Date`.
- `updatedAt`: required RFC3339 date-time string transformed to `Date`.
- `tags`: string array, defaulting to `[]`.
- `campaign`: optional in the base schema, required by campaign-family schemas.
- `title`, `type`, and optional `excerpt` on supported content schemas.

Legacy or site-internal fields also exist (`status`, `secret`, `permissions`, `gmResource`, `gm`, `gm-date`, `gm-info`, `parentChain`, `relationships`). The new Campaign Content contract does not make those fields part of the cross-system V1 surface unless explicitly modeled in OpenAPI.

## Current type enums

- Lore: `cosmology`, `religion`, `economy`, `history`, `geography`, `food-drink`, `culture`, `language`, `warfare`, `domestication`, `magic`, `technology`, `structure`, `other`, `event`.
- Places: `location`, `landmark`, `dungeon`, `settlement`, `region`, `country`, `territory`, `water`, `biome`, `dimension`, `world`.
- Sentients: `race`, `species`, `culture`, `organization`, `deity`.
- Bestiary: `monster`, `animal`, `undead`, `spirit`, `construct`, `elemental`.
- Flora: `tree`, `flower`, `fungus`, `herb`, `fruit`, `plant`, `crop`.
- Factions: `political`, `guild`, `criminal`, `government`, `religion`, `military`, `police`, `school`, `order`.
- Systems: `general`, `gurps`.
- Meta: `info`, `technical`, `content`, `reference`, `governance`, `characterCreation`.
- Campaign characters: `pc`, `npc`, `ally`, `adversary`, `patron`, `creature`, `group`, `other`, `relationship`.
- Campaign scenes: `scene`, `combat`, `social`, `travel`, `downtime`, `investigation`, `flashback`, `other`.
- Campaign adventures: `arc`, `mission`, `quest`, `contract`, `dungeon`, `journey`, `heist`, `other`.
- Campaign hooks: `rumor`, `lead`, `job`, `threat`, `mystery`, `opportunity`, `other`.

## Collection-specific fields and refinements observed

- Root campaign pages currently use `collection: campaigns`, `title`, `type` defaulting to `campaign`, optional `subtype`, optional `excerpt`, optional `visibility` defaulting to `gm`, and optional `start`/`end` dates.
- Campaign lore uses the lore type enum and optional legacy snake_case `aletheia_date` and `aletheia_date_end`. Current validation requires `aletheia_date` for `type: event`, validates both values as Aletheia calendar dates, and rejects those fields for non-event lore.
- Campaign places use the places type enum and optional numeric `coordinates: { x, y }`.
- Campaign sentients use the sentients type enum and optional `alignment: lawful | neutral | chaotic | good | evil | any`.
- Campaign bestiary uses the bestiary type enum and optional numeric `challengeRating`.
- Campaign flora uses the flora type enum with no additional fields beyond the shared fields observed above.
- Campaign factions use the factions type enum and optional `alignment: lawful | neutral | chaotic | good | evil | any`.
- Campaign systems use the systems type enum and require `subtype: magic | combat | skill | language | character | economy | social | equipment`.
- Campaign meta uses the meta type enum.
- Campaign characters reuse the sentients field shape, narrow `type` to the campaign-character enum, and may include optional `alignment`.
- Campaign scenes use the campaign-scene type enum and optional `date`.
- Campaign adventures use the campaign-adventure type enum and optional `date`.
- Campaign hooks use the campaign-hook type enum with no additional fields beyond the shared fields observed above.

The current snake_case `aletheia_date` fields are captured as source evidence only. The new `woa-admin` contract uses camelCase field names where those fields are approved for the cross-system API.

## Contract deltas seeded by this handoff

- `campaigns` is a legacy sister-site collection name for root campaign pages. `woa-admin` should expose `campaignPages` as the canonical collection value and `pages` as the collection key.
- `publication`, `visibility`, `campaign`, `collection`, `title`, `type`, `authors`, `createdAt`, and `updatedAt` become required shared Campaign Content frontmatter in the new contract.
- `visibility` is explicit per document and authoritative. Current sister-site defaults must not become API defaults.
- Public API identity is `id`, derived from path. Authored `id` and `documentId` are rejected in Campaign Content frontmatter.
- Structured contributor metadata is simplified to contributor keys in V1. Role-bearing contributor objects remain a sister-site implementation detail unless later approved.
- Legacy snake_case and hyphenated fields are migration inputs only; the new contract uses camelCase.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCollectionMock = vi.fn();
const tryGetD1BindingFromLocalsMock = vi.fn();

vi.mock('astro:content', () => ({
  getCollection: getCollectionMock,
}));

vi.mock('./d1', () => ({
  tryGetD1BindingFromLocals: tryGetD1BindingFromLocalsMock,
}));

describe('loadIndexBackedCollectionPage', () => {
  beforeEach(() => {
    vi.resetModules();
    getCollectionMock.mockReset();
    tryGetD1BindingFromLocalsMock.mockReset();
    tryGetD1BindingFromLocalsMock.mockResolvedValue(null);
  });

  it('groups local discovery by type when no type filter is selected', async () => {
    getCollectionMock.mockResolvedValue([
      {
        id: 'ash-drake',
        collection: 'bestiary',
        data: {
          title: 'Ash Drake',
          type: 'monster',
          tags: ['fire'],
          status: 'published',
          created: new Date('2026-03-10T00:00:00.000Z'),
        },
      },
      {
        id: 'storm-stag',
        collection: 'bestiary',
        data: {
          title: 'Storm Stag',
          type: 'beast',
          tags: ['storm'],
          status: 'publish',
          created: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
      {
        id: 'bog-wisp',
        collection: 'bestiary',
        data: {
          title: 'Bog Wisp',
          type: 'monster',
          tags: ['swamp'],
          status: 'draft',
          created: new Date('2026-03-14T00:00:00.000Z'),
        },
      },
    ]);

    const { loadIndexBackedCollectionPage } = await import('./content-index-page');
    const result = await loadIndexBackedCollectionPage({
      collection: 'bestiary',
      searchParams: new URLSearchParams({ view: 'grouped' }),
      locals: {},
    });

    expect(result.mode).toBe('local');
    expect(result.groups.map((group) => ({ value: group.value, count: group.count, field: group.field }))).toEqual([
      { value: 'beast', count: 1, field: 'type' },
      { value: 'monster', count: 2, field: 'type' },
    ]);
    expect(result.groups[1]?.items.map((item) => item.id)).toEqual(['bog-wisp', 'ash-drake']);
  });

  it('groups local discovery by subtype when a type filter narrows systems entries', async () => {
    getCollectionMock.mockResolvedValue([
      {
        id: 'ritual-casting',
        collection: 'systems',
        data: {
          title: 'Ritual Casting',
          type: 'gurps',
          subtype: 'magic',
          tags: ['gurps'],
          status: 'published',
          created: new Date('2026-03-10T00:00:00.000Z'),
        },
      },
      {
        id: 'wand-duels',
        collection: 'systems',
        data: {
          title: 'Wand Duels',
          type: 'gurps',
          subtype: 'combat',
          tags: ['gurps'],
          status: 'publish',
          created: new Date('2026-03-12T00:00:00.000Z'),
        },
      },
      {
        id: 'spell-fatigue',
        collection: 'systems',
        data: {
          title: 'Spell Fatigue',
          type: 'gurps',
          subtype: 'magic',
          tags: ['gurps'],
          status: 'draft',
          created: new Date('2026-03-14T00:00:00.000Z'),
        },
      },
      {
        id: 'table-etiquette',
        collection: 'systems',
        data: {
          title: 'Table Etiquette',
          type: 'general',
          subtype: 'social',
          tags: ['table'],
          status: 'published',
          created: new Date('2026-03-16T00:00:00.000Z'),
        },
      },
    ]);

    const { loadIndexBackedCollectionPage } = await import('./content-index-page');
    const result = await loadIndexBackedCollectionPage({
      collection: 'systems',
      searchParams: new URLSearchParams({ view: 'grouped', type: 'gurps' }),
      locals: {},
    });

    expect(result.mode).toBe('local');
    expect(result.filters.type).toBe('gurps');
    expect(result.groups.map((group) => ({ value: group.value, count: group.count, field: group.field }))).toEqual([
      { value: 'combat', count: 1, field: 'subtype' },
      { value: 'magic', count: 2, field: 'subtype' },
    ]);
    expect(result.groups[1]?.items.map((item) => item.id)).toEqual(['spell-fatigue', 'ritual-casting']);
  });
});

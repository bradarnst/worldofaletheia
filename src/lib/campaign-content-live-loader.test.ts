import { describe, expect, it, vi } from 'vitest';
import { renderEntry } from 'astro/content/runtime';
import {
  createCampaignContentLiveLoader,
  normalizeCampaignContentEntryId,
  type CampaignContentLiveCollectionFilter,
  type CampaignContentLiveEntryData,
} from '~/lib/campaign-content-live-loader';
import type { CampaignContentSourceClient } from '~/lib/campaign-content-source-boundary';

function createSourceClientStub(): CampaignContentSourceClient {
  return {
    listCampaignContent: vi.fn(),
    getCampaignContentItem: vi.fn(),
  };
}

const accessScope = {
  allowedVisibilities: ['public', 'campaignMembers'] as const,
  actor: { kind: 'authenticated' as const, userId: 'user_123', traceId: 'request_123' },
};

describe('campaign content live loader', () => {
  it('maps live collection filters to source metadata list queries without broadening access', async () => {
    const sourceClient = createSourceClientStub();
    vi.mocked(sourceClient.listCampaignContent).mockResolvedValue({
      ok: true,
      value: {
        campaignSlug: 'brad',
        nextCursor: 'next-page',
        items: [
          {
            campaignSlug: 'brad',
            collectionKey: 'notes',
            documentId: 'session-zero',
            title: 'Session Zero',
            visibility: 'campaignMembers',
            updatedAt: '2026-07-24T12:00:00Z',
            raw: {
              type: 'session',
              subtype: 'recap',
              excerpt: 'Opening table agreements.',
              tags: ['session-zero'],
              authors: ['brad'],
            },
          },
        ],
      },
    });
    const loader = createCampaignContentLiveLoader({ sourceClient });

    const result = await loader.loadCollection({
      collection: 'campaignContent',
      filter: {
        campaignSlug: 'brad',
        collectionKey: 'notes',
        accessScope,
        type: 'session',
        subtype: 'recap',
        tag: ['session-zero', 'table'],
        author: 'brad',
        contributor: ['barry'],
        title: 'zero',
        updatedSince: '2026-07-01T00:00:00Z',
        limit: 25,
        cursor: 'current-page',
      },
    });

    expect(sourceClient.listCampaignContent).toHaveBeenCalledWith({
      campaignSlug: 'brad',
      collectionKey: 'notes',
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: accessScope.actor,
      type: 'session',
      subtype: 'recap',
      tag: ['session-zero', 'table'],
      author: 'brad',
      contributor: ['barry'],
      title: 'zero',
      updatedSince: '2026-07-01T00:00:00Z',
      limit: 25,
      cursor: 'current-page',
    });
    expect('entries' in result ? result.entries : []).toEqual([
      expect.objectContaining({
        id: 'brad/notes/session-zero',
        data: expect.objectContaining({
          collection: 'campaignContent',
          campaign: 'brad',
          campaignSlug: 'brad',
          collectionKey: 'notes',
          documentId: 'session-zero',
          title: 'Session Zero',
          visibility: 'campaignMembers',
          type: 'session',
          subtype: 'recap',
          excerpt: 'Opening table agreements.',
          tags: ['session-zero'],
          authors: ['brad'],
        } satisfies Partial<CampaignContentLiveEntryData>),
      }),
    ]);
    expect('cacheHint' in result ? result.cacheHint : undefined).toMatchObject({
      tags: ['campaign-content:brad', 'campaign-content:brad:notes'],
    });
  });

  it('maps live entry filters to source detail queries and returns renderable detail html', async () => {
    const sourceClient = createSourceClientStub();
    vi.mocked(sourceClient.getCampaignContentItem).mockResolvedValue({
      ok: true,
      value: {
        campaignSlug: 'brad',
        collectionKey: 'pages',
        documentId: 'about',
        title: 'About Brad Campaign',
        visibility: 'public',
        updatedAt: '2026-07-24T12:00:00Z',
        body: '# About\n\nWelcome to the table.',
        raw: {
          type: 'about',
          tags: ['overview'],
          authors: ['brad'],
        },
      },
    });
    const loader = createCampaignContentLiveLoader({ sourceClient });

    const result = await loader.loadEntry({
      collection: 'campaignContent',
      filter: {
        campaignSlug: 'brad',
        collectionKey: 'pages',
        documentId: 'about',
        accessScope,
      },
    });

    expect(sourceClient.getCampaignContentItem).toHaveBeenCalledWith({
      campaignSlug: 'brad',
      collectionKey: 'pages',
      documentId: 'about',
      allowedVisibilities: ['public', 'campaignMembers'],
      actor: accessScope.actor,
    });
    expect(result).toMatchObject({
      id: 'brad/pages/about',
      data: {
        collection: 'campaignContent',
        campaign: 'brad',
        campaignSlug: 'brad',
        collectionKey: 'pages',
        documentId: 'about',
        title: 'About Brad Campaign',
        visibility: 'public',
        type: 'about',
        tags: ['overview'],
        sourceMarkdown: '# About\n\nWelcome to the table.',
      },
      rendered: {
        html: '<h1 id="about">About</h1>\n<p>Welcome to the table.</p>',
      },
    });
    if (!result || 'error' in result) {
      throw new Error('Expected a renderable Campaign Content live entry.');
    }
    const dataEntry: Parameters<typeof renderEntry>[0] = {
      id: result.id,
      data: { ...result.data },
      rendered: result.rendered,
    };
    const astroRenderResult = await renderEntry(dataEntry);
    expect(astroRenderResult.Content).toEqual(expect.any(Function));
    expect(normalizeCampaignContentEntryId({ campaignSlug: 'brad', collectionKey: 'pages', documentId: 'about' })).toBe(
      'brad/pages/about',
    );
  });

  it('rejects missing access scope before source reads', async () => {
    const sourceClient = createSourceClientStub();
    const loader = createCampaignContentLiveLoader({ sourceClient });

    const result = await loader.loadCollection({
      collection: 'campaignContent',
      filter: {
        campaignSlug: 'brad',
        collectionKey: 'notes',
      } as CampaignContentLiveCollectionFilter,
    });

    expect(sourceClient.listCampaignContent).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      error: expect.objectContaining({
        name: 'CampaignContentLiveLoaderError',
        code: 'invalid_filter',
      }),
    });
  });
});

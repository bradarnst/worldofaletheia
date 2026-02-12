import { describe, expect, it } from 'vitest';
import {
  CAMPAIGNS_API_VERSION,
  CampaignStatus,
  CampaignType,
  PermissionLevel,
  SessionType,
  type CampaignSummary,
  type CampaignDetail,
  type SessionSummary,
  type SessionDetail,
} from './index';

describe('campaign contracts', () => {
  it('keeps API contract marker stable', () => {
    expect(CAMPAIGNS_API_VERSION).toBe('v1');
  });

  it('keeps enum wire values stable', () => {
    expect(CampaignStatus.ACTIVE).toBe('active');
    expect(CampaignType.CAMPAIGN).toBe('campaign');
    expect(SessionType.SESSION).toBe('session');
    expect(PermissionLevel.PUBLIC).toBe('public');
  });

  it('validates CampaignSummary shape at compile-time and runtime', () => {
    const summary: CampaignSummary = {
      id: 'sample-campaign',
      slug: 'sample-campaign',
      title: 'Sample Campaign',
      status: CampaignStatus.ACTIVE,
      type: CampaignType.CAMPAIGN,
      excerpt: 'A sample campaign',
      startDate: new Date('2026-02-01'),
      endDate: undefined,
      permissions: PermissionLevel.PUBLIC,
      authors: ['brad'],
      sessionCount: 1,
      tags: ['sample'],
    };

    expect(summary).toHaveProperty('id');
    expect(summary).toHaveProperty('slug');
    expect(summary).toHaveProperty('title');
    expect(summary).toHaveProperty('status');
    expect(summary).toHaveProperty('type');
    expect(summary).toHaveProperty('permissions');
    expect(Array.isArray(summary.authors)).toBe(true);
    expect(Array.isArray(summary.tags)).toBe(true);
  });

  it('validates CampaignDetail shape at compile-time and runtime', () => {
    const sessionSummary: SessionSummary = {
      id: 'sample-campaign/sessions/session-01',
      slug: 'session-01',
      campaignSlug: 'sample-campaign',
      campaignId: 'sample-campaign',
      title: 'Session 01',
      date: new Date('2026-02-01'),
      duration: 180,
      type: SessionType.SESSION,
      permissions: PermissionLevel.PUBLIC,
      excerpt: 'Session excerpt',
      tags: ['session-1'],
      secret: false,
    };

    const detail: CampaignDetail = {
      id: 'sample-campaign',
      slug: 'sample-campaign',
      title: 'Sample Campaign',
      status: CampaignStatus.ACTIVE,
      type: CampaignType.CAMPAIGN,
      excerpt: 'A sample campaign',
      startDate: new Date('2026-02-01'),
      endDate: undefined,
      permissions: PermissionLevel.PUBLIC,
      authors: ['brad'],
      sessionCount: 1,
      tags: ['sample'],
      description: 'Detailed description',
      content: '# Markdown content',
      sessions: [sessionSummary],
      relatedContent: [],
      metadata: {
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-02'),
        sourcePath: 'src/content/campaigns/sample-campaign/index.md',
        lastIngestedAt: new Date('2026-02-02'),
        version: CAMPAIGNS_API_VERSION,
      },
    };

    expect(detail).toHaveProperty('description');
    expect(detail).toHaveProperty('content');
    expect(Array.isArray(detail.sessions)).toBe(true);
    expect(detail).toHaveProperty('metadata.version', 'v1');
  });

  it('validates SessionDetail shape at compile-time and runtime', () => {
    const detail: SessionDetail = {
      id: 'sample-campaign/sessions/session-01',
      slug: 'session-01',
      campaignSlug: 'sample-campaign',
      campaignId: 'sample-campaign',
      title: 'Session 01',
      date: new Date('2026-02-01'),
      duration: 180,
      type: SessionType.SESSION,
      permissions: PermissionLevel.PUBLIC,
      excerpt: 'Session excerpt',
      tags: ['session-1'],
      secret: false,
      content: '# Session markdown',
      relatedContent: [],
      metadata: {
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-02'),
        sourcePath: 'src/content/campaigns/sample-campaign/sessions/session-01.md',
        lastIngestedAt: new Date('2026-02-02'),
        version: CAMPAIGNS_API_VERSION,
        author: 'brad',
      },
    };

    expect(detail).toHaveProperty('campaignSlug', 'sample-campaign');
    expect(detail).toHaveProperty('metadata.author', 'brad');
    expect(Array.isArray(detail.relatedContent)).toBe(true);
  });
});

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import BaseHead from '~/components/BaseHead.astro';
import CampaignContentPageState from '~/components/CampaignContentPageState.astro';

describe('Campaign Content browser behavior', () => {
  it('renders denied content as generic not found without membership details', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(CampaignContentPageState, {
      props: {
        reason: 'not_found',
        notFoundHeading: 'Campaign not found',
        notFoundBody: 'This campaign content was not found in the current publication environment.',
        notFoundBackHref: '/campaigns',
        notFoundBackLabel: 'Back to campaigns',
        unavailableBackHref: '/campaigns',
        unavailableBackLabel: 'Back to campaigns',
      },
    });

    expect(html).toContain('Campaign not found');
    expect(html).not.toContain('restricted');
    expect(html).not.toContain('campaign member');
    expect(html).not.toContain('Sign in');
  });

  it('renders noindex and nofollow into browser-facing metadata', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(BaseHead, {
      request: new Request('https://worldofaletheia.com/campaigns/brad/notes'),
      props: {
        title: 'Campaign notes',
        description: 'Campaign notes',
        robots: 'noindex, nofollow',
      },
    });

    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<meta name="googlebot" content="noindex, nofollow">');
  });
});

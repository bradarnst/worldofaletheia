import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSpellById,
  listSpells,
  listSpellTypes,
  suggestSpells,
} from './public-spell-api';

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');

  return new Response(JSON.stringify(body), {
    headers,
    status: init?.status,
    statusText: init?.statusText,
  });
}

describe('public-spell-api adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('lists spell types from the canonical public API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(['Air Spells', 'Body Spells']));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listSpellTypes();

    expect(result).toEqual(['Air Spells', 'Body Spells']);
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://worldofaletheia.com/api/v1/spell-types'));
  });

  it('builds list query strings with contract parameter names', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
      q: 'Abs',
      type: 'Air Spells',
      sourceName: 'Absorb',
      sourceType: 'Air Spells',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listSpells({
      page: 2,
      pageSize: 100,
      q: 'Abs',
      type: 'Air Spells',
      sourceName: 'Absorb',
      sourceType: 'Air Spells',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toEqual(
      new URL('https://worldofaletheia.com/api/v1/spells?page=2&pageSize=100&q=Abs&type=Air+Spells&sourceName=Absorb&sourceType=Air+Spells'),
    );
  });

  it('looks up a spell by stable spell_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse({
      spell_id: '019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46',
      spell_name: 'Absorb Weapon',
      spell_types: ['Adventurer Spells'],
      keywords: ['Damage'],
      archmagisters_counsel: 'Use when hidden steel matters.',
      source_lineage: {
        source_spell_name: 'Absorb Weapon',
        source_spell_types: ['Adventurer Spells'],
      },
      full_cost: '1 point/level.',
      casting_roll: 'None.',
      range: 'Touch.',
      duration: 'Indefinite.',
      description: 'You can harmlessly absorb a weapon you are touching.',
      statistics: 'Payload 1.',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getSpellById('019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46');

    expect(result.spell_name).toBe('Absorb Weapon');
    expect(fetchMock).toHaveBeenCalledWith(new URL('https://worldofaletheia.com/api/v1/spells/019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46'));
  });

  it('builds suggestion queries with optional filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await suggestSpells({
      q: 'Abs',
      type: 'Adventurer Spells',
      sourceName: 'Absorb',
      sourceType: 'Adventurer Spells',
      limit: 7,
    });

    expect(fetchMock.mock.calls[0][0]).toEqual(
      new URL('https://worldofaletheia.com/api/v1/spell-suggestions?q=Abs&type=Adventurer+Spells&sourceName=Absorb&sourceType=Adventurer+Spells&limit=7'),
    );
  });

  it('preserves invalid detail id responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({
      error: 'invalid_request',
      message: 'spell_id must be a valid UUIDv7.',
    }, { status: 400 })));

    await expect(getSpellById('bad-id')).rejects.toMatchObject({
      status: 400,
      error: 'invalid_request',
      message: 'spell_id must be a valid UUIDv7.',
    });
  });

  it('preserves not found detail responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({
      error: 'not_found',
      message: 'Spell not found.',
    }, { status: 404 })));

    await expect(getSpellById('019e07b7-7aa5-7bd9-b4b4-b1bfd2c74e46')).rejects.toMatchObject({
      status: 404,
      error: 'not_found',
      message: 'Spell not found.',
    });
  });

  it('preserves rate limit retry-after metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({
      error: 'rate_limited',
      message: 'Too many requests. Please retry later.',
    }, {
      status: 429,
      headers: { 'Retry-After': '120' },
    })));

    await expect(listSpellTypes()).rejects.toMatchObject({
      status: 429,
      error: 'rate_limited',
      message: 'Too many requests. Please retry later.',
      retryAfter: '120',
    });
  });

  it('preserves service unavailable retry-after metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
    }, {
      status: 503,
      headers: { 'Retry-After': 'Fri, 22 May 2026 10:00:00 GMT' },
    })));

    await expect(listSpells()).rejects.toMatchObject({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      retryAfter: 'Fri, 22 May 2026 10:00:00 GMT',
    });
  });

  it('converts malformed error responses into adapter errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream exploded', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'Retry-After': '60',
      },
    })));

    await expect(listSpellTypes()).rejects.toMatchObject({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
      retryAfter: '60',
    });
  });

  it('rejects 200 responses that are not JSON (e.g. CDN HTML error pages)', async () => {
    // Simulates a CDN/edge returning an HTML error page with HTTP 200 — without
    // a content-type guard this would hit JSON.parse and surface as an opaque
    // SyntaxError rather than the documented service_unavailable contract.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Edge error</html>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    })));

    await expect(listSpellTypes()).rejects.toMatchObject({
      status: 503,
      error: 'service_unavailable',
      message: 'Public spell data is temporarily unavailable.',
    });
  });

  it('accepts +json content-type subtypes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(['Air Spells']), {
      status: 200,
      headers: { 'content-type': 'application/vnd.aletheia+json' },
    })));

    await expect(listSpellTypes()).resolves.toEqual(['Air Spells']);
  });

  it('honors PUBLIC_SPELL_API_BASE override from import.meta.env', async () => {
    // Trailing slash should be normalized away by the base reader; tests both
    // override path and trim-trailing-slash behavior at once.
    vi.stubEnv('PUBLIC_SPELL_API_BASE', 'https://staging.example.com/api/v1/');

    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await listSpellTypes();

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://staging.example.com/api/v1/spell-types'),
    );
  });
});

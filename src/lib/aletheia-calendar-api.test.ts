import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));
import {
  buildEventProjectionMap,
  normalizeLoreEvents,
} from '~/lib/aletheia-calendar';
import {
  createCalendarDateDiffApiResponse,
  createCalendarMonthApiResponse,
  createCalendarMoonPhaseApiResponse,
  createCalendarWeekApiResponse,
  createCalendarYearApiResponse,
} from '~/lib/aletheia-calendar-api';

function createContext() {
  const events = normalizeLoreEvents([
    {
      id: 'cataclysm',
      collection: 'lore',
      data: {
        title: 'The Cataclysm',
        type: 'event',
        aletheia_date: '1105-Amoris-17',
        aletheia_date_end: '1105-Amoris-19',
        excerpt: 'A realm-shaping disaster.',
        tags: ['history'],
      },
    },
  ]);

  return {
    events,
    eventProjectionMap: buildEventProjectionMap(events),
  };
}

async function parseJson(response: Response) {
  return response.json();
}

describe('Aletheia calendar API helpers', () => {
  it('builds month payloads with projected events', async () => {
    const body = await parseJson(createCalendarMonthApiResponse(new URLSearchParams({ year: '1105', month: 'Amoris' }), createContext()));
    const eventDay = body.data.days.find((day: { date: string }) => day.date === '1105-Amoris-17');

    expect(body.ok).toBe(true);
    expect(body.data.view).toBe('month');
    expect(eventDay.events).toHaveLength(1);
    expect(eventDay.events[0].title).toBe('The Cataclysm');
  });

  it('builds week payloads around a direct date query', async () => {
    const body = await parseJson(createCalendarWeekApiResponse(new URLSearchParams({ date: '1105-Amoris-17' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.view).toBe('week');
    expect(body.data.anchorDate).toBe('1105-Amoris-17');
    expect(body.data.weekdays).toHaveLength(6);
  });

  it('builds year payloads with festival summaries', async () => {
    const body = await parseJson(createCalendarYearApiResponse(new URLSearchParams({ year: '1110' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.view).toBe('year');
    expect(body.data.isLeapYear).toBe(true);
    expect(body.data.festival.days).toContain('1110-Leapday');
  });

  it('builds moon phase payloads for valid dates', async () => {
    const body = await parseJson(createCalendarMoonPhaseApiResponse(new URLSearchParams({ date: '1105-Solis-29' })));

    expect(body.ok).toBe(true);
    expect(body.data.date).toBe('1105-Solis-29');
    expect(typeof body.data.phase).toBe('number');
    expect(body.meta.model).toBe('civil-31.1');
  });

  it('builds date-diff payloads in exclusive mode by default', async () => {
    const body = await parseJson(createCalendarDateDiffApiResponse(new URLSearchParams({ from: '1105-Amoris-17', to: '1105-Solis-29' })));

    expect(body.ok).toBe(true);
    expect(body.data.mode).toBe('exclusive');
    expect(body.data.differenceDays).toBeGreaterThan(0);
  });

  it('returns errors for invalid required parameters', async () => {
    const body = await parseJson(createCalendarMonthApiResponse(new URLSearchParams({ year: 'bad', month: 'Nope' }), createContext()));

    expect(body.ok).toBe(false);
    expect(body.data.error).toContain('requires valid year and month');
  });
});

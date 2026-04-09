import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: vi.fn(),
}));
import {
  buildEventProjectionMap,
  normalizeLoreEvents,
} from '~/lib/aletheia-calendar';
import {
  createCalendarDayApiResponse,
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

  it('exposes eclipse summaries in month payloads', async () => {
    const body = await parseJson(createCalendarMonthApiResponse(new URLSearchParams({ year: '0', month: 'Vernalis' }), createContext()));
    const eclipseDay = body.data.slots.find((slot: { eclipses?: Array<{ kind: string }>; kind: string }) => slot.kind !== 'empty' && (slot.eclipses?.length ?? 0) > 0);

    expect(body.ok).toBe(true);
    expect(body.data.eclipseCount).toBeGreaterThan(0);
    expect(body.data.solarCount).toBeGreaterThan(0);
    expect(eclipseDay.eclipses[0].kind).toBe('solar');
  });

  it('exposes Leap Day placement metadata in month payloads', async () => {
    const yearBody = await parseJson(createCalendarYearApiResponse(new URLSearchParams({ year: '1110' }), createContext()));
    const leapMonth = yearBody.data.months.find((month: { leapDay: object | null; month: string }) => month.leapDay !== null);

    expect(leapMonth).toBeDefined();

    const body = await parseJson(createCalendarMonthApiResponse(new URLSearchParams({ year: '1110', month: leapMonth.month }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.leapDayPlacement).not.toBeNull();
    expect(body.data.leapDayPlacement.festivalPosition).toBe('between-festival-day-3-and-4');
    expect(body.data.slots.some((slot: { kind: string }) => slot.kind === 'leapday')).toBe(true);
  });

  it('builds week payloads around a direct date query', async () => {
    const body = await parseJson(createCalendarWeekApiResponse(new URLSearchParams({ date: '1105-Amoris-17' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.view).toBe('week');
    expect(body.data.anchorDate).toBe('1105-Amoris-17');
    expect(body.data.weekdays).toHaveLength(6);
  });

  it('exposes eclipse summaries in week payloads', async () => {
    const body = await parseJson(createCalendarWeekApiResponse(new URLSearchParams({ date: '0-Vernalis-21' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.eclipseCount).toBeGreaterThan(0);
    expect(body.data.weekdays.some((item: { eclipses: Array<{ kind: string }> }) => item.eclipses.length > 0)).toBe(true);
  });

  it('includes Leap Day as a normal week item when selected', async () => {
    const body = await parseJson(createCalendarWeekApiResponse(new URLSearchParams({ date: '1110-Leapday' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.weekdays).toHaveLength(6);
    expect(body.data.weekdays.some((item: { kind: string }) => item.kind === 'leapday')).toBe(true);
  });

  it('builds year payloads with festival summaries', async () => {
    const body = await parseJson(createCalendarYearApiResponse(new URLSearchParams({ year: '1110' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.view).toBe('year');
    expect(body.data.isLeapYear).toBe(true);
    expect(body.data.festival.days).toContain('1110-Leapday');
    expect(body.data.months.some((month: { leapDay: object | null }) => month.leapDay !== null)).toBe(true);
  });

  it('exposes eclipse summaries in year payloads', async () => {
    const body = await parseJson(createCalendarYearApiResponse(new URLSearchParams({ year: '0' }), createContext()));

    expect(body.ok).toBe(true);
    expect(body.data.eclipseCount).toBeGreaterThan(0);
    expect(body.data.months.some((month: { eclipseCount: number }) => month.eclipseCount > 0)).toBe(true);
  });

  it('builds selected-day payloads for month dates and Leap Day', async () => {
    const monthBody = await parseJson(createCalendarDayApiResponse(new URLSearchParams({ date: '1105-Amoris-17' }), createContext()));
    const leapBody = await parseJson(createCalendarDayApiResponse(new URLSearchParams({ date: '1110-Leapday' }), createContext()));
    const eclipseBody = await parseJson(createCalendarDayApiResponse(new URLSearchParams({ date: '0-Vernalis-21' }), createContext()));

    expect(monthBody.ok).toBe(true);
    expect(monthBody.data.view).toBe('day');
    expect(monthBody.data.kind).toBe('month');
    expect(monthBody.data.events).toHaveLength(1);

    expect(leapBody.ok).toBe(true);
    expect(leapBody.data.kind).toBe('leapday');
    expect(leapBody.data.isLeapDay).toBe(true);
    expect(leapBody.data.weekday).toBeDefined();

    expect(eclipseBody.ok).toBe(true);
    expect(eclipseBody.data.eclipseCount).toBeGreaterThan(0);
    expect(eclipseBody.data.eclipses[0].kind).toBe('solar');
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

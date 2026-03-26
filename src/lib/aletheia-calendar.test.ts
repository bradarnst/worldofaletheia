import { describe, expect, it } from 'vitest';
import {
  buildCalendarWeekData,
  buildEventProjectionMap,
  enrichDate,
  formatAletheiaDate,
  fromAbsDay,
  getMonthReferenceDate,
  isLeapYear,
  normalizeLoreEvent,
  parseAletheiaDate,
  resolveCalendarSelection,
  toAbsDay,
} from './aletheia-calendar';

describe('Aletheia calendar engine', () => {
  it('parses named and numeric month dates', () => {
    expect(parseAletheiaDate('1105-Amoris-17')).toEqual({
      kind: 'month',
      year: 1105,
      monthIndex: 4,
      monthName: 'Amoris',
      day: 17,
    });

    expect(parseAletheiaDate('1105-4-17')).toEqual({
      kind: 'month',
      year: 1105,
      monthIndex: 4,
      monthName: 'Amoris',
      day: 17,
    });
  });

  it('round-trips month dates and leap days through absolute days', () => {
    const monthDate = parseAletheiaDate('1110-Silentium-31');
    if (!monthDate) {
      throw new Error('expected parsed month date');
    }

    expect(fromAbsDay(toAbsDay(monthDate))).toEqual(monthDate);

    const leapDay = parseAletheiaDate('1110-Leapday');
    if (!leapDay) {
      throw new Error('expected parsed leap day');
    }

    expect(fromAbsDay(toAbsDay(leapDay))).toEqual(leapDay);
  });

  it('keeps month start weekdays stable across leap years', () => {
    const yearZero = parseAletheiaDate('0-Brumalis-1');
    const yearFive = parseAletheiaDate('5-Brumalis-1');

    if (!yearZero || !yearFive || yearZero.kind !== 'month' || yearFive.kind !== 'month') {
      throw new Error('expected month dates');
    }

    expect(enrichDate(yearZero).weekday).toBe('Primus');
    expect(enrichDate(yearFive).weekday).toBe('Primus');
    expect(isLeapYear(0)).toBe(true);
    expect(isLeapYear(5)).toBe(true);
  });

  it('supports festival shortcuts and leap day resolution', () => {
    const festivalDay = parseAletheiaDate('1110-Festival-2');
    const leapDay = parseAletheiaDate('1110-Festival-Leapday');

    expect(festivalDay?.kind).toBe('month');
    expect(leapDay).toEqual({ kind: 'leapday', year: 1110 });
  });

  it('normalizes lore events with ranged dates', () => {
    const event = normalizeLoreEvent({
      id: 'cataclysm',
      collection: 'lore',
      data: {
        title: 'The Cataclysm',
        type: 'event',
        aletheia_date: '1105-Amoris-17',
        aletheia_date_end: '1105-Amoris-19',
        tags: ['history'],
      },
    });

    expect(event).not.toBeNull();
    expect(event?.durationDays).toBe(3);
    expect(event?.isSingleDay).toBe(false);
    expect(event?.href).toBe('/lore/cataclysm');
  });

  it('projects ranged events across each covered day', () => {
    const event = normalizeLoreEvent({
      id: 'cataclysm',
      collection: 'lore',
      data: {
        title: 'The Cataclysm',
        type: 'event',
        aletheia_date: '1105-Amoris-17',
        aletheia_date_end: '1105-Amoris-19',
      },
    });

    if (!event) {
      throw new Error('expected normalized event');
    }

    const projections = buildEventProjectionMap([event]);
    expect(projections.get(event.startAbsDay)?.length).toBe(1);
    expect(projections.get(event.startAbsDay + 1)?.length).toBe(1);
    expect(projections.get(event.endAbsDay)?.length).toBe(1);
  });

  it('builds a week view that exposes leap day gaps', () => {
    const selectedDate = parseAletheiaDate('1110-Festival-Leapday');
    if (!selectedDate) {
      throw new Error('expected leap day selection');
    }

    const week = buildCalendarWeekData(selectedDate, new Map());
    expect(week.leapDay?.kind).toBe('leapday');
    expect(week.items.some((item) => item.hasLeapDayAfter)).toBe(true);
  });

  it('resolves direct date query parameters before numeric fields', () => {
    const params = new URLSearchParams({
      date: '1105-Amoris-17',
      year: '1105',
      month: '4',
      day: '1',
      view: 'week',
    });

    const selection = resolveCalendarSelection(params);
    expect(selection.view).toBe('week');
    expect(formatAletheiaDate(selection.date)).toBe('1105-Amoris-17');
    expect(getMonthReferenceDate(selection.date)).toEqual({
      kind: 'month',
      year: 1105,
      monthIndex: 4,
      monthName: 'Amoris',
      day: 17,
    });
  });
});

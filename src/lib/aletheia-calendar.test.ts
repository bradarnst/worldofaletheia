import { describe, expect, it } from 'vitest';
import {
  buildCalendarDayData,
  buildCalendarMonthData,
  buildCalendarWeekData,
  buildCalendarYearData,
  buildEventProjectionMap,
  enrichDate,
  formatAletheiaDate,
  fromAbsDay,
  getMonthReferenceDate,
  getYearNavigationDate,
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

  it('advances weekday progression across Leap Day', () => {
    const festivalDayThree = parseAletheiaDate('1110-Festival-3');
    const leapDay = parseAletheiaDate('1110-Festival-Leapday');
    const festivalDayFour = parseAletheiaDate('1110-Festival-4');

    if (!festivalDayThree || festivalDayThree.kind !== 'month' || !leapDay || leapDay.kind !== 'leapday' || !festivalDayFour || festivalDayFour.kind !== 'month') {
      throw new Error('expected festival dates');
    }

    const enrichedFestivalDayThree = enrichDate(festivalDayThree);
    const enrichedLeapDay = enrichDate(leapDay);
    const enrichedFestivalDayFour = enrichDate(festivalDayFour);

    expect(enrichedLeapDay.weekdayIndex).toBe((enrichedFestivalDayThree.weekdayIndex + 1) % 6);
    expect(enrichedFestivalDayFour.weekdayIndex).toBe((enrichedLeapDay.weekdayIndex + 1) % 6);
    expect(enrichedFestivalDayFour.absDay).toBe(enrichedLeapDay.absDay + 1);
  });

  it('shifts the following year start weekday after leap years', () => {
    const yearZero = parseAletheiaDate('0-Brumalis-1');
    const yearOne = parseAletheiaDate('1-Brumalis-1');
    const yearFive = parseAletheiaDate('5-Brumalis-1');
    const yearSix = parseAletheiaDate('6-Brumalis-1');

    if (!yearZero || !yearOne || !yearFive || !yearSix || yearZero.kind !== 'month' || yearOne.kind !== 'month' || yearFive.kind !== 'month' || yearSix.kind !== 'month') {
      throw new Error('expected month dates');
    }

    expect(enrichDate(yearZero).weekday).toBe('Primus');
    expect(enrichDate(yearOne).weekday).toBe('Secundus');
    expect(enrichDate(yearFive).weekday).toBe('Secundus');
    expect(enrichDate(yearSix).weekday).toBe('Tertius');
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

  it('builds a week view that includes Leap Day as a normal item', () => {
    const selectedDate = parseAletheiaDate('1110-Festival-Leapday');
    if (!selectedDate) {
      throw new Error('expected leap day selection');
    }

    const week = buildCalendarWeekData(selectedDate, new Map());
    expect(week.items).toHaveLength(6);
    expect(week.items.some((item) => item.date.kind === 'leapday')).toBe(true);
  });

  it('exposes Leap Day placement metadata in month and year data', () => {
    const yearData = buildCalendarYearData(1110, new Map());
    const monthWithLeapDay = yearData.find((month) => month.leapDayPlacement?.anchorMonthIndex === month.monthIndex);

    expect(monthWithLeapDay).toBeDefined();
    expect(monthWithLeapDay?.leapDayPlacement?.festivalPosition).toBe('between-festival-day-3-and-4');
    expect(monthWithLeapDay?.leapDayPlacement?.leapDay.kind).toBe('leapday');

    if (!monthWithLeapDay) {
      throw new Error('expected year month with Leap Day placement');
    }

    const monthData = buildCalendarMonthData(1110, monthWithLeapDay.monthIndex, new Map());
    expect(monthData.leapDayPlacement?.afterDate.kind).toBe('month');
    expect(monthData.leapDayPlacement?.beforeDate.kind).toBe('month');
    expect(monthData.slots.some((slot) => slot.kind === 'leapday')).toBe(true);

    const afterIndex = monthData.slots.findIndex((slot) => slot.kind === 'day' && slot.date.absDay === monthWithLeapDay.leapDayPlacement?.afterDate.absDay);
    expect(monthData.slots[afterIndex + 1]?.kind).toBe('leapday');
  });

  it('normalizes Leap Day year navigation to a valid destination date', () => {
    const leapDay = parseAletheiaDate('1110-Leapday');

    if (!leapDay) {
      throw new Error('expected leap day selection');
    }

    expect(getYearNavigationDate(leapDay, -1)).toEqual(getMonthReferenceDate({ kind: 'leapday', year: 1109 }));
    expect(formatAletheiaDate(getYearNavigationDate(leapDay, 5))).toBe('1115-Leapday');
  });

  it('builds selected-day detail data for month dates and Leap Day', () => {
    const monthDate = parseAletheiaDate('1105-Amoris-17');
    const leapDay = parseAletheiaDate('1110-Leapday');

    if (!monthDate || !leapDay) {
      throw new Error('expected selected dates');
    }

    const monthDayData = buildCalendarDayData(monthDate, new Map());
    const leapDayData = buildCalendarDayData(leapDay, new Map());

    expect(monthDayData.date.kind).toBe('month');
    expect(monthDayData.previousDate).not.toBeNull();
    expect(monthDayData.nextDate).not.toBeNull();
    expect(leapDayData.date.kind).toBe('leapday');
    expect(leapDayData.date.weekday).toBeDefined();
    expect(leapDayData.previousDate?.kind).toBe('month');
    expect(leapDayData.nextDate?.kind).toBe('month');
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

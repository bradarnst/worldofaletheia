import { getCollection } from 'astro:content';
import { getFilteredCollection } from '@utils/content-filter';
import {
  buildCalendarMonthData,
  buildCalendarWeekData,
  buildCalendarYearData,
  buildEventProjectionMap,
  enrichDate,
  formatAletheiaDate,
  formatAletheiaDateLabel,
  formatAletheiaDateRange,
  isLeapYear,
  normalizeLoreEvents,
  parseAletheiaDate,
  parseMonthValue,
  resolveCalendarSelection,
  toAbsDay,
  type AletheiaDate,
  type CalendarMonthData,
  type CalendarWeekData,
  type EnrichedAletheiaDate,
  type NormalizedLoreEvent,
} from '~/lib/aletheia-calendar';

interface CalendarApiMetaOptions {
  tz?: string;
  locale?: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface CalendarApiContext {
  events: NormalizedLoreEvent[];
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>;
}

function parseYear(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function getCalendarMeta(options: CalendarApiMetaOptions = {}) {
  const meta: Record<string, string | number | boolean> = {
    calendarSystem: 'aletheia-civil',
    epoch: '0000-Brumalis-1',
  };

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      meta[key] = value;
    }
  }

  return meta;
}

function jsonResponse(data: unknown, metaOptions: CalendarApiMetaOptions = {}, status = 200): Response {
  const response = new Response(JSON.stringify({
    ok: status < 400,
    version: 'v1',
    data,
    meta: getCalendarMeta(metaOptions),
  }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex, nofollow',
    },
  });

  return response;
}

function errorResponse(message: string, metaOptions: CalendarApiMetaOptions = {}, status = 400): Response {
  return jsonResponse({ error: message }, metaOptions, status);
}

function getCommonMeta(searchParams: URLSearchParams) {
  return {
    tz: searchParams.get('tz') ?? 'UTC',
    locale: searchParams.get('locale') ?? 'en',
  };
}

function toEventSummary(event: NormalizedLoreEvent) {
  return {
    id: event.id,
    slug: event.slug,
    href: event.href,
    title: event.title,
    excerpt: event.excerpt,
    rangeLabel: formatAletheiaDateRange(event.startDate, event.endDate),
  };
}

function toMoonSummary(date: EnrichedAletheiaDate) {
  return {
    phase: date.moonPhase,
    label: date.moonPhaseLabel,
    shortLabel: date.moonPhaseShortLabel,
    isFullMoon: date.isFullMoon,
  };
}

function buildFestivalSummary(yearData: CalendarMonthData[], year: number) {
  const festivalDays = yearData
    .flatMap((month) => month.slots)
    .filter((slot): slot is Extract<CalendarMonthData['slots'][number], { kind: 'day' }> => slot.kind === 'day')
    .map((slot) => slot.date)
    .filter((date) => date.isFestivalDay)
    .sort((left, right) => left.absDay - right.absDay)
    .map((date) => formatAletheiaDate(date));

  if (isLeapYear(year)) {
    festivalDays.splice(3, 0, formatAletheiaDate({ kind: 'leapday', year }));
  }

  return {
    anchor: 'first-full-moon-after-midpoint-of-solis',
    days: festivalDays,
  };
}

export async function loadCalendarApiContext(): Promise<CalendarApiContext> {
  const loreEntries = getFilteredCollection(await getCollection('lore'));
  const events = normalizeLoreEvents(loreEntries.filter((entry) => entry.data.type === 'event'));
  return {
    events,
    eventProjectionMap: buildEventProjectionMap(events),
  };
}

export function createCalendarMonthApiResponse(searchParams: URLSearchParams, context: CalendarApiContext): Response {
  const meta = getCommonMeta(searchParams);
  const year = parseYear(searchParams.get('year'));
  const month = parseMonthValue(searchParams.get('month'));

  if (year === null || !month) {
    return errorResponse('Month endpoint requires valid year and month query parameters.', meta);
  }

  const monthData = buildCalendarMonthData(year, month.monthIndex, context.eventProjectionMap);
  const days = monthData.slots
    .filter((slot): slot is Extract<CalendarMonthData['slots'][number], { kind: 'day' }> => slot.kind === 'day')
    .map((slot) => ({
      date: formatAletheiaDate(slot.date),
      label: formatAletheiaDateLabel(slot.date),
      absDay: slot.date.absDay,
      weekday: slot.date.weekday,
      weekdayIndex: slot.date.weekdayIndex,
      moon: toMoonSummary(slot.date),
      festival: slot.date.isFestivalDay
        ? {
            dayNumber: slot.date.festivalDayNumber,
            label: `Festival Day ${slot.date.festivalDayNumber}`,
          }
        : null,
      events: slot.events.map(toEventSummary),
    }));

  return jsonResponse({
    view: 'month',
    year,
    month: month.monthName,
    monthIndex: month.monthIndex,
    monthLength: days.length,
    weekdayColumns: ['Primus', 'Secundus', 'Tertius', 'Quartus', 'Quintus', 'Deorum'],
    leapDay: monthData.leapDay
      ? {
          date: formatAletheiaDate(monthData.leapDay),
          label: formatAletheiaDateLabel(monthData.leapDay, { includeWeekday: false }),
        }
      : null,
    days,
  }, meta);
}

export function createCalendarWeekApiResponse(searchParams: URLSearchParams, context: CalendarApiContext): Response {
  const meta = getCommonMeta(searchParams);
  const selection = resolveCalendarSelection(new URLSearchParams([...searchParams, ['view', 'week']]));
  const weekData = buildCalendarWeekData(selection.date, context.eventProjectionMap);

  return jsonResponse({
    view: 'week',
    anchorDate: formatAletheiaDate(selection.date),
    anchorLabel: formatAletheiaDateLabel(selection.date),
    weekdays: weekData.items.map((item) => ({
      date: formatAletheiaDate(item.date),
      label: formatAletheiaDateLabel(item.date),
      absDay: item.date.absDay,
      weekday: item.date.weekday,
      weekdayIndex: item.date.weekdayIndex,
      moon: toMoonSummary(item.date),
      festival: item.date.isFestivalDay
        ? {
            dayNumber: item.date.festivalDayNumber,
            label: `Festival Day ${item.date.festivalDayNumber}`,
          }
        : null,
      hasLeapDayAfter: item.hasLeapDayAfter,
      events: item.events.map(toEventSummary),
    })),
    leapDay: weekData.leapDay
      ? {
          date: formatAletheiaDate(weekData.leapDay),
          label: formatAletheiaDateLabel(weekData.leapDay, { includeWeekday: false }),
        }
      : null,
  }, meta);
}

export function createCalendarYearApiResponse(searchParams: URLSearchParams, context: CalendarApiContext): Response {
  const meta = getCommonMeta(searchParams);
  const year = parseYear(searchParams.get('year'));
  if (year === null) {
    return errorResponse('Year endpoint requires a valid year query parameter.', meta);
  }

  const yearData = buildCalendarYearData(year, context.eventProjectionMap);

  return jsonResponse({
    view: 'year',
    year,
    isLeapYear: isLeapYear(year),
    months: yearData.map((month) => {
      const firstDaySlot = month.slots.find((slot): slot is Extract<CalendarMonthData['slots'][number], { kind: 'day' }> => slot.kind === 'day');
      const fullMoonDates = month.slots
        .filter((slot): slot is Extract<CalendarMonthData['slots'][number], { kind: 'day' }> => slot.kind === 'day')
        .filter((slot) => slot.date.isFullMoon)
        .map((slot) => formatAletheiaDate(slot.date));

      return {
        month: month.monthName,
        monthIndex: month.monthIndex,
        startWeekday: firstDaySlot?.date.weekday ?? null,
        eventCount: month.eventCount,
        fullMoonDates,
      };
    }),
    festival: buildFestivalSummary(yearData, year),
  }, meta);
}

export function createCalendarMoonPhaseApiResponse(searchParams: URLSearchParams): Response {
  const meta = getCommonMeta(searchParams);
  const rawDate = searchParams.get('date');
  const date = rawDate ? parseAletheiaDate(rawDate) : null;
  if (!date) {
    return errorResponse('Moon phase endpoint requires a valid date query parameter.', meta);
  }

  const enrichedDate = date.kind === 'leapday' ? enrichDate(date) : enrichDate(date);
  return jsonResponse({
    date: formatAletheiaDate(enrichedDate),
    label: formatAletheiaDateLabel(enrichedDate),
    absDay: enrichedDate.absDay,
    phase: enrichedDate.moonPhase,
    moon: toMoonSummary(enrichedDate),
  }, {
    ...meta,
    model: 'civil-31.1',
    tolerance: 0.02,
  });
}

export function createCalendarDateDiffApiResponse(searchParams: URLSearchParams): Response {
  const meta = getCommonMeta(searchParams);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const mode = searchParams.get('mode') === 'inclusive' ? 'inclusive' : 'exclusive';
  const fromDate = from ? parseAletheiaDate(from) : null;
  const toDate = to ? parseAletheiaDate(to) : null;

  if (!fromDate || !toDate) {
    return errorResponse('Date diff endpoint requires valid from and to query parameters.', meta);
  }

  const fromAbsDay = toAbsDay(fromDate);
  const toAbsDayValue = toAbsDay(toDate);
  const rawDifference = toAbsDayValue - fromAbsDay;
  const differenceDays = mode === 'inclusive'
    ? rawDifference + (rawDifference >= 0 ? 1 : -1)
    : rawDifference;

  return jsonResponse({
    from: {
      date: formatAletheiaDate(fromDate),
      label: formatAletheiaDateLabel(fromDate),
      absDay: fromAbsDay,
    },
    to: {
      date: formatAletheiaDate(toDate),
      label: formatAletheiaDateLabel(toDate),
      absDay: toAbsDayValue,
    },
    differenceDays,
    mode,
  }, meta);
}

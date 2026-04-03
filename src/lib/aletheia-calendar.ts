export const MONTHS = [
  'Brumalis',
  'Gelidus',
  'Vernalis',
  'Amoris',
  'Florentis',
  'Solis',
  'Aestivus',
  'Fructoris',
  'Aurelis',
  'Ventorum',
  'Umbrae',
  'Silentium',
] as const;

export const WEEKDAYS = ['Primus', 'Secundus', 'Tertius', 'Quartus', 'Quintus', 'Deorum'] as const;
export const CALENDAR_VIEWS = ['month', 'week', 'year'] as const;

export type MonthName = (typeof MONTHS)[number];
export type WeekdayName = (typeof WEEKDAYS)[number];
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export type MoonPhaseLabel =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

export const DAYS_PER_MONTH = 31;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_WEEK = 6;
export const DATED_DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
export const LEAP_INTERVAL_YEARS = 5;
export const LUNAR_CYCLE_DAYS = 31.1;
export const FULL_MOON_TOLERANCE = 0.02;
export const DEFAULT_ALETHEIA_YEAR = 1105;
export const FESTIVAL_SEARCH_MONTH_INDEX = 6;
export const FESTIVAL_SEARCH_DAY = 16;

const monthLookup = new Map<string, number>(
  MONTHS.map((monthName, index) => [monthName.toLowerCase(), index + 1]),
);

const festivalStartOffsetCache = new Map<number, number>();

export interface MonthDate {
  kind: 'month';
  year: number;
  monthIndex: number;
  monthName: MonthName;
  day: number;
}

export interface LeapDayDate {
  kind: 'leapday';
  year: number;
}

export type AletheiaDate = MonthDate | LeapDayDate;

export interface EnrichedMonthDate extends MonthDate {
  absDay: number;
  weekdayIndex: number;
  weekday: WeekdayName;
  moonPhase: number;
  moonPhaseLabel: MoonPhaseLabel;
  moonPhaseShortLabel: string;
  isFullMoon: boolean;
  isLeapYear: boolean;
  isFestivalDay: boolean;
  festivalDayNumber: number | null;
}

export interface EnrichedLeapDayDate extends LeapDayDate {
  absDay: number;
  moonPhase: number;
  moonPhaseLabel: MoonPhaseLabel;
  moonPhaseShortLabel: string;
  isFullMoon: boolean;
  isLeapYear: true;
  isFestivalLeapDay: true;
}

export type EnrichedAletheiaDate = EnrichedMonthDate | EnrichedLeapDayDate;

export interface NormalizedLoreEvent {
  id: string;
  slug: string;
  href: string;
  title: string;
  excerpt?: string;
  tags: string[];
  startDate: EnrichedAletheiaDate;
  endDate: EnrichedAletheiaDate;
  startAbsDay: number;
  endAbsDay: number;
  durationDays: number;
  isSingleDay: boolean;
}

export interface LoreEventEntryLike {
  id: string;
  collection?: string;
  data: {
    title: string;
    excerpt?: string;
    tags?: string[];
    type?: string;
    aletheia_date?: string;
    aletheia_date_end?: string;
  };
}

export interface CalendarMonthSlotEmpty {
  kind: 'empty';
  key: string;
}

export interface CalendarMonthSlotDay {
  kind: 'day';
  key: string;
  date: EnrichedMonthDate;
  events: NormalizedLoreEvent[];
}

export type CalendarMonthSlot = CalendarMonthSlotEmpty | CalendarMonthSlotDay;

export interface CalendarMonthData {
  year: number;
  monthIndex: number;
  monthName: MonthName;
  slots: CalendarMonthSlot[];
  eventCount: number;
  leapDay: EnrichedLeapDayDate | null;
}

export interface CalendarWeekItem {
  date: EnrichedMonthDate;
  events: NormalizedLoreEvent[];
  hasLeapDayAfter: boolean;
}

export interface CalendarWeekData {
  items: CalendarWeekItem[];
  leapDay: EnrichedLeapDayDate | null;
}

export interface CalendarSelection {
  view: CalendarView;
  date: AletheiaDate;
}

function normalizeModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value);
}

function parseYearToken(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!isNonNegativeInteger(trimmed)) {
    return null;
  }

  return Number.parseInt(trimmed, 10);
}

function parseDayToken(value: string | null | undefined): number | null {
  const parsed = parseYearToken(value);
  if (parsed === null || parsed < 1 || parsed > DAYS_PER_MONTH) {
    return null;
  }

  return parsed;
}

export function isLeapYear(year: number): boolean {
  return year % LEAP_INTERVAL_YEARS === 0;
}

export function getMonthName(monthIndex: number): MonthName {
  const monthName = MONTHS[monthIndex - 1];
  if (!monthName) {
    throw new Error(`Month index '${monthIndex}' is out of range`);
  }

  return monthName;
}

export function parseMonthValue(value: string | null | undefined): { monthIndex: number; monthName: MonthName } | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isNonNegativeInteger(trimmed)) {
    const monthIndex = Number.parseInt(trimmed, 10);
    if (monthIndex < 1 || monthIndex > MONTHS_PER_YEAR) {
      return null;
    }

    return {
      monthIndex,
      monthName: getMonthName(monthIndex),
    };
  }

  const monthIndex = monthLookup.get(trimmed.toLowerCase());
  if (!monthIndex) {
    return null;
  }

  return {
    monthIndex,
    monthName: getMonthName(monthIndex),
  };
}

function getLeapYearsBeforeYear(year: number): number {
  if (year <= 0) {
    return 0;
  }

  return Math.floor((year + LEAP_INTERVAL_YEARS - 1) / LEAP_INTERVAL_YEARS);
}

function getYearStartAbsDay(year: number): number {
  return (year * DATED_DAYS_PER_YEAR) + getLeapYearsBeforeYear(year);
}

function getYearOffsetForMonthDate(date: MonthDate): number {
  return ((date.monthIndex - 1) * DAYS_PER_MONTH) + (date.day - 1);
}

function monthDateFromYearOffset(year: number, yearOffset: number): MonthDate {
  if (yearOffset < 0 || yearOffset >= DATED_DAYS_PER_YEAR) {
    throw new Error(`Year offset '${yearOffset}' is out of range for year '${year}'`);
  }

  const monthIndex = Math.floor(yearOffset / DAYS_PER_MONTH) + 1;
  const day = normalizeModulo(yearOffset, DAYS_PER_MONTH) + 1;

  return {
    kind: 'month',
    year,
    monthIndex,
    monthName: getMonthName(monthIndex),
    day,
  };
}

function getMoonPhaseLabel(phase: number): MoonPhaseLabel {
  if (phase < 0.06 || phase >= 0.94) {
    return 'New Moon';
  }
  if (phase < 0.19) {
    return 'Waxing Crescent';
  }
  if (phase < 0.31) {
    return 'First Quarter';
  }
  if (phase < 0.44) {
    return 'Waxing Gibbous';
  }
  if (phase < 0.56) {
    return 'Full Moon';
  }
  if (phase < 0.69) {
    return 'Waning Gibbous';
  }
  if (phase < 0.81) {
    return 'Last Quarter';
  }

  return 'Waning Crescent';
}

export function getMoonPhaseShortLabel(label: MoonPhaseLabel): string {
  switch (label) {
    case 'New Moon':
      return 'NM';
    case 'Waxing Crescent':
      return 'WC';
    case 'First Quarter':
      return 'FQ';
    case 'Waxing Gibbous':
      return 'WG';
    case 'Full Moon':
      return 'FM';
    case 'Waning Gibbous':
      return 'NG';
    case 'Last Quarter':
      return 'LQ';
    case 'Waning Crescent':
      return 'NC';
  }
}

export function getMoonPhase(absDay: number): number {
  return normalizeModulo(absDay / LUNAR_CYCLE_DAYS, 1);
}

export function isFullMoon(absDay: number): boolean {
  return Math.abs(getMoonPhase(absDay) - 0.5) < FULL_MOON_TOLERANCE;
}

function getFestivalSearchStartOffset(): number {
  return ((FESTIVAL_SEARCH_MONTH_INDEX - 1) * DAYS_PER_MONTH) + (FESTIVAL_SEARCH_DAY - 1);
}

function getFestivalStartOffset(year: number): number {
  const cached = festivalStartOffsetCache.get(year);
  if (cached !== undefined) {
    return cached;
  }

  const searchStartOffset = getFestivalSearchStartOffset();
  const yearStartAbsDay = getYearStartAbsDay(year);

  let bestOffset = searchStartOffset;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let offset = searchStartOffset; offset < searchStartOffset + 62; offset += 1) {
    const phase = getMoonPhase(yearStartAbsDay + offset);
    const distance = Math.abs(phase - 0.5);

    if (distance < FULL_MOON_TOLERANCE) {
      festivalStartOffsetCache.set(year, offset);
      return offset;
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = offset;
    }
  }

  festivalStartOffsetCache.set(year, bestOffset);
  return bestOffset;
}

function getLeapDayAbsDayForYear(year: number): number | null {
  if (!isLeapYear(year)) {
    return null;
  }

  return getYearStartAbsDay(year) + getFestivalStartOffset(year) + 3;
}

function getFestivalDayNumber(date: MonthDate): number | null {
  const festivalStartOffset = getFestivalStartOffset(date.year);
  const yearOffset = getYearOffsetForMonthDate(date);
  const difference = yearOffset - festivalStartOffset;

  if (difference < 0 || difference > 5) {
    return null;
  }

  return difference + 1;
}

export function toAbsDay(date: AletheiaDate): number {
  if (date.kind === 'leapday') {
    const leapDayAbsDay = getLeapDayAbsDayForYear(date.year);
    if (leapDayAbsDay === null) {
      throw new Error(`Year '${date.year}' is not a leap year and has no Leap Day`);
    }

    return leapDayAbsDay;
  }

  const yearOffset = getYearOffsetForMonthDate(date);
  const leapDayOffset = isLeapYear(date.year) && yearOffset >= getFestivalStartOffset(date.year) + 3 ? 1 : 0;

  return getYearStartAbsDay(date.year) + yearOffset + leapDayOffset;
}

export function fromAbsDay(absDay: number): AletheiaDate {
  if (!Number.isInteger(absDay) || absDay < 0) {
    throw new Error(`Absolute day '${absDay}' must be a non-negative integer`);
  }

  let year = Math.floor(absDay / DATED_DAYS_PER_YEAR);

  while (getYearStartAbsDay(year + 1) <= absDay) {
    year += 1;
  }

  while (getYearStartAbsDay(year) > absDay) {
    year -= 1;
  }

  const leapDayAbsDay = getLeapDayAbsDayForYear(year);
  if (leapDayAbsDay !== null && absDay === leapDayAbsDay) {
    return { kind: 'leapday', year };
  }

  let yearOffset = absDay - getYearStartAbsDay(year);
  if (leapDayAbsDay !== null && absDay > leapDayAbsDay) {
    yearOffset -= 1;
  }

  return monthDateFromYearOffset(year, yearOffset);
}

export function enrichDate(date: MonthDate): EnrichedMonthDate;
export function enrichDate(date: LeapDayDate): EnrichedLeapDayDate;
export function enrichDate(date: AletheiaDate): EnrichedAletheiaDate {
  const absDay = toAbsDay(date);
  const moonPhase = getMoonPhase(absDay);
  const moonPhaseLabel = getMoonPhaseLabel(moonPhase);
  const moonPhaseShortLabel = getMoonPhaseShortLabel(moonPhaseLabel);

  if (date.kind === 'leapday') {
    return {
      ...date,
      absDay,
      moonPhase,
      moonPhaseLabel,
      moonPhaseShortLabel,
      isFullMoon: isFullMoon(absDay),
      isLeapYear: true,
      isFestivalLeapDay: true,
    };
  }

  const weekdayIndex = getNonLeapDayIndex(date) % DAYS_PER_WEEK;
  const festivalDayNumber = getFestivalDayNumber(date);

  return {
    ...date,
    absDay,
    weekdayIndex,
    weekday: WEEKDAYS[weekdayIndex],
    moonPhase,
    moonPhaseLabel,
    moonPhaseShortLabel,
    isFullMoon: isFullMoon(absDay),
    isLeapYear: isLeapYear(date.year),
    isFestivalDay: festivalDayNumber !== null,
    festivalDayNumber,
  };
}

export function getNonLeapDayIndex(date: MonthDate): number {
  return (date.year * DATED_DAYS_PER_YEAR) + getYearOffsetForMonthDate(date);
}

export function monthDateFromNonLeapDayIndex(index: number): MonthDate {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Non-leap day index '${index}' must be a non-negative integer`);
  }

  const year = Math.floor(index / DATED_DAYS_PER_YEAR);
  const yearOffset = normalizeModulo(index, DATED_DAYS_PER_YEAR);

  return monthDateFromYearOffset(year, yearOffset);
}

export function formatAletheiaDate(date: AletheiaDate | EnrichedAletheiaDate, options: { numericMonth?: boolean } = {}): string {
  if (date.kind === 'leapday') {
    return `${date.year}-Leapday`;
  }

  const monthPart = options.numericMonth ? String(date.monthIndex) : date.monthName;
  return `${date.year}-${monthPart}-${date.day}`;
}

export function formatAletheiaDateLabel(
  date: AletheiaDate | EnrichedAletheiaDate,
  options: { includeWeekday?: boolean } = {},
): string {
  if (date.kind === 'leapday') {
    return `Leap Day, ${date.year}`;
  }

  const enriched = 'weekday' in date ? date : enrichDate(date);
  if (options.includeWeekday === false) {
    return `${enriched.monthName} ${enriched.day}, ${enriched.year}`;
  }

  return `${enriched.weekday}, ${enriched.monthName} ${enriched.day}, ${enriched.year}`;
}

export function formatAletheiaDateRange(startDate: EnrichedAletheiaDate, endDate: EnrichedAletheiaDate): string {
  if (startDate.absDay === endDate.absDay) {
    return formatAletheiaDateLabel(startDate);
  }

  if (startDate.kind === 'month' && endDate.kind === 'month' && startDate.year === endDate.year && startDate.monthIndex === endDate.monthIndex) {
    return `${startDate.monthName} ${startDate.day}-${endDate.day}, ${startDate.year}`;
  }

  if (startDate.kind === 'month' && endDate.kind === 'month' && startDate.year === endDate.year) {
    return `${startDate.monthName} ${startDate.day} to ${endDate.monthName} ${endDate.day}, ${startDate.year}`;
  }

  return `${formatAletheiaDateLabel(startDate)} to ${formatAletheiaDateLabel(endDate)}`;
}

export function parseAletheiaDate(value: string): AletheiaDate | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('-').map((part) => part.trim()).filter(Boolean);
  const year = parseYearToken(parts[0]);
  if (year === null) {
    return null;
  }

  if (parts.length === 2) {
    const token = parts[1].toLowerCase();
    if (token === 'leapday' || token === 'festival-leapday') {
      return isLeapYear(year) ? { kind: 'leapday', year } : null;
    }

    if (token === 'festival') {
      return getFestivalShortcutDate(year, 1);
    }

    return null;
  }

  if (parts.length === 3 && parts[1].toLowerCase() === 'festival') {
    if (parts[2].toLowerCase() === 'leapday') {
      return isLeapYear(year) ? { kind: 'leapday', year } : null;
    }

    const festivalDayNumber = parseYearToken(parts[2]);
    if (festivalDayNumber === null || festivalDayNumber < 1 || festivalDayNumber > 6) {
      return null;
    }

    return getFestivalShortcutDate(year, festivalDayNumber);
  }

  if (parts.length !== 3) {
    return null;
  }

  const month = parseMonthValue(parts[1]);
  const day = parseDayToken(parts[2]);
  if (!month || day === null) {
    return null;
  }

  return {
    kind: 'month',
    year,
    monthIndex: month.monthIndex,
    monthName: month.monthName,
    day,
  };
}

function getFestivalShortcutDate(year: number, festivalDayNumber: number): MonthDate {
  const festivalStartOffset = getFestivalStartOffset(year);
  const yearOffset = festivalStartOffset + (festivalDayNumber - 1);
  return monthDateFromYearOffset(year, yearOffset);
}

export function normalizeCalendarView(value: string | null | undefined): CalendarView {
  return value === 'week' || value === 'year' ? value : 'month';
}

function hasExplicitDateParams(searchParams: URLSearchParams): boolean {
  return searchParams.has('date') || searchParams.has('year') || searchParams.has('month') || searchParams.has('day');
}

export function resolveCalendarSelection(
  searchParams: URLSearchParams,
  fallbackYear: number = DEFAULT_ALETHEIA_YEAR,
): CalendarSelection {
  const view = normalizeCalendarView(searchParams.get('view'));
  const dateParam = searchParams.get('date');

  if (dateParam) {
    const parsedDate = parseAletheiaDate(dateParam);
    if (parsedDate) {
      return { view, date: parsedDate };
    }
  }

  const year = parseYearToken(searchParams.get('year')) ?? fallbackYear;
  const month = parseMonthValue(searchParams.get('month')) ?? parseMonthValue('1')!;
  const day = parseDayToken(searchParams.get('day')) ?? 1;

  return {
    view,
    date: {
      kind: 'month',
      year,
      monthIndex: month.monthIndex,
      monthName: month.monthName,
      day,
    },
  };
}

export function resolveTimelineStartDate(
  searchParams: URLSearchParams,
  fallbackYear: number = DEFAULT_ALETHEIA_YEAR,
): AletheiaDate | null {
  if (!hasExplicitDateParams(searchParams)) {
    return null;
  }

  return resolveCalendarSelection(searchParams, fallbackYear).date;
}

export function getMonthReferenceDate(date: AletheiaDate): MonthDate {
  if (date.kind === 'month') {
    return date;
  }

  return getFestivalShortcutDate(date.year, 3);
}

export function getPreviousMonthDate(date: AletheiaDate): MonthDate {
  const referenceDate = getMonthReferenceDate(date);
  const previousMonthIndex = referenceDate.monthIndex === 1 ? MONTHS_PER_YEAR : referenceDate.monthIndex - 1;
  const year = referenceDate.monthIndex === 1 ? Math.max(0, referenceDate.year - 1) : referenceDate.year;

  return {
    kind: 'month',
    year,
    monthIndex: previousMonthIndex,
    monthName: getMonthName(previousMonthIndex),
    day: referenceDate.day,
  };
}

export function getNextMonthDate(date: AletheiaDate): MonthDate {
  const referenceDate = getMonthReferenceDate(date);
  const nextMonthIndex = referenceDate.monthIndex === MONTHS_PER_YEAR ? 1 : referenceDate.monthIndex + 1;
  const year = referenceDate.monthIndex === MONTHS_PER_YEAR ? referenceDate.year + 1 : referenceDate.year;

  return {
    kind: 'month',
    year,
    monthIndex: nextMonthIndex,
    monthName: getMonthName(nextMonthIndex),
    day: referenceDate.day,
  };
}

export function getYearViewYear(date: AletheiaDate): number {
  return date.year;
}

export function buildCalendarMonthData(
  year: number,
  monthIndex: number,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
): CalendarMonthData {
  const monthName = getMonthName(monthIndex);
  const slots: CalendarMonthSlot[] = [];
  const eventIds = new Set<string>();
  const firstWeekdayIndex = enrichDate({
    kind: 'month',
    year,
    monthIndex,
    monthName,
    day: 1,
  }).weekdayIndex;

  for (let emptyIndex = 0; emptyIndex < firstWeekdayIndex; emptyIndex += 1) {
    slots.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-${emptyIndex}` });
  }

  for (let day = 1; day <= DAYS_PER_MONTH; day += 1) {
    const date = enrichDate({ kind: 'month', year, monthIndex, monthName, day });
    const events = eventProjectionMap.get(date.absDay) ?? [];
    events.forEach((event) => eventIds.add(event.id));
    slots.push({
      kind: 'day',
      key: `${year}-${monthIndex}-${day}`,
      date,
      events,
    });
  }

  while (slots.length % DAYS_PER_WEEK !== 0) {
    slots.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-tail-${slots.length}` });
  }

  const leapDay = getLeapDayAbsDayForYear(year) !== null && getFestivalMonthIndicesForYear(year).has(monthIndex)
    ? enrichDate({ kind: 'leapday', year })
    : null;

  return {
    year,
    monthIndex,
    monthName,
    slots,
    eventCount: eventIds.size,
    leapDay,
  };
}

function getFestivalMonthIndicesForYear(year: number): Set<number> {
  const indices = new Set<number>();
  for (let festivalDayNumber = 1; festivalDayNumber <= 6; festivalDayNumber += 1) {
    indices.add(getFestivalShortcutDate(year, festivalDayNumber).monthIndex);
  }
  return indices;
}

export function buildCalendarYearData(
  year: number,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
): CalendarMonthData[] {
  return MONTHS.map((_, monthIndex) => buildCalendarMonthData(year, monthIndex + 1, eventProjectionMap));
}

export function buildCalendarWeekData(
  selectedDate: AletheiaDate,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
): CalendarWeekData {
  const anchorNonLeapIndex = selectedDate.kind === 'leapday'
    ? getNonLeapDayIndex(getFestivalShortcutDate(selectedDate.year, 3))
    : getNonLeapDayIndex(selectedDate);
  const weekStartIndex = anchorNonLeapIndex - normalizeModulo(anchorNonLeapIndex, DAYS_PER_WEEK);
  const items: CalendarWeekItem[] = [];
  const leapDayAbsDay = getLeapDayAbsDayForYear(selectedDate.year);

  for (let offset = 0; offset < DAYS_PER_WEEK; offset += 1) {
    const date = enrichDate(monthDateFromNonLeapDayIndex(weekStartIndex + offset));
    const nextDate = offset < DAYS_PER_WEEK - 1 ? enrichDate(monthDateFromNonLeapDayIndex(weekStartIndex + offset + 1)) : null;

    items.push({
      date,
      events: eventProjectionMap.get(date.absDay) ?? [],
      hasLeapDayAfter: nextDate !== null && leapDayAbsDay !== null && leapDayAbsDay > date.absDay && leapDayAbsDay < nextDate.absDay,
    });
  }

  const leapDay = selectedDate.kind === 'leapday' || items.some((item) => item.hasLeapDayAfter)
    ? (leapDayAbsDay !== null ? enrichDate({ kind: 'leapday', year: selectedDate.year }) : null)
    : null;

  return { items, leapDay };
}

function enrichAletheiaDate(date: AletheiaDate): EnrichedAletheiaDate {
  return date.kind === 'leapday' ? enrichDate(date) : enrichDate(date);
}

export function normalizeLoreEvent(entry: LoreEventEntryLike): NormalizedLoreEvent | null {
  const data = entry.data;
  if (data.type !== 'event' || !data.aletheia_date) {
    return null;
  }

  const startDate = parseAletheiaDate(data.aletheia_date);
  if (!startDate) {
    return null;
  }

  const endDate = data.aletheia_date_end ? parseAletheiaDate(data.aletheia_date_end) : startDate;
  if (!endDate) {
    return null;
  }

  const startAbsDay = toAbsDay(startDate);
  const endAbsDay = toAbsDay(endDate);
  if (endAbsDay < startAbsDay) {
    return null;
  }

  return {
    id: `${entry.collection ?? 'lore'}:${entry.id}`,
    slug: entry.id,
    href: `/lore/${entry.id}`,
    title: data.title,
    excerpt: data.excerpt,
    tags: data.tags ?? [],
    startDate: enrichAletheiaDate(startDate),
    endDate: enrichAletheiaDate(endDate),
    startAbsDay,
    endAbsDay,
    durationDays: (endAbsDay - startAbsDay) + 1,
    isSingleDay: startAbsDay === endAbsDay,
  };
}

export function normalizeLoreEvents(entries: LoreEventEntryLike[]): NormalizedLoreEvent[] {
  return entries
    .map((entry) => normalizeLoreEvent(entry))
    .filter((entry): entry is NormalizedLoreEvent => entry !== null)
    .sort((left, right) => {
      if (left.startAbsDay !== right.startAbsDay) {
        return left.startAbsDay - right.startAbsDay;
      }

      if (left.endAbsDay !== right.endAbsDay) {
        return left.endAbsDay - right.endAbsDay;
      }

      return left.title.localeCompare(right.title);
    });
}

export function buildEventProjectionMap(events: NormalizedLoreEvent[]): Map<number, NormalizedLoreEvent[]> {
  const projectionMap = new Map<number, NormalizedLoreEvent[]>();

  for (const event of events) {
    for (let absDay = event.startAbsDay; absDay <= event.endAbsDay; absDay += 1) {
      const projectedEvents = projectionMap.get(absDay) ?? [];
      projectedEvents.push(event);
      projectionMap.set(absDay, projectedEvents);
    }
  }

  for (const [, projectedEvents] of projectionMap) {
    projectedEvents.sort((left, right) => {
      if (left.startAbsDay !== right.startAbsDay) {
        return left.startAbsDay - right.startAbsDay;
      }

      if (left.endAbsDay !== right.endAbsDay) {
        return left.endAbsDay - right.endAbsDay;
      }

      return left.title.localeCompare(right.title);
    });
  }

  return projectionMap;
}

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
export type EclipseKind = 'solar' | 'lunar';
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
export const LOCAL_DAY_HOURS = 25;
export const MINUTES_PER_LOCAL_DAY = LOCAL_DAY_HOURS * 60;
export const TROPICAL_YEAR_DAYS = 372.2;
export const LUNAR_CYCLE_DAYS = 31.1;
export const NODAL_PRECESSION_DAYS = 6922.92;
export const ECLIPSE_YEAR_DAYS = 353.3;
export const ECLIPSE_SEASON_HALF_WIDTH_DAYS = 17.5;
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
  weekdayIndex: number;
  weekday: WeekdayName;
  moonPhase: number;
  moonPhaseLabel: MoonPhaseLabel;
  moonPhaseShortLabel: string;
  isFullMoon: boolean;
  isLeapYear: true;
  isFestivalLeapDay: true;
}

export type EnrichedAletheiaDate = EnrichedMonthDate | EnrichedLeapDayDate;

export interface EclipseOccurrence {
  kind: EclipseKind;
  peakDaynum: number;
  date: EnrichedAletheiaDate;
  hour: number;
  minute: number;
  seasonIndex: number;
}

export interface EclipseSummary {
  eclipses: EclipseOccurrence[];
  eclipseCount: number;
  solarCount: number;
  lunarCount: number;
}

export interface CalendarDaynumDate {
  date: AletheiaDate;
  hour: number;
  minute: number;
}

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
  eclipses: EclipseOccurrence[];
}

export interface CalendarMonthSlotLeapDay {
  kind: 'leapday';
  key: string;
  date: EnrichedLeapDayDate;
  events: NormalizedLoreEvent[];
  eclipses: EclipseOccurrence[];
}

export type CalendarMonthSlot = CalendarMonthSlotEmpty | CalendarMonthSlotDay | CalendarMonthSlotLeapDay;

export interface CalendarMonthLeapDayPlacement {
  leapDay: EnrichedLeapDayDate;
  afterDate: EnrichedMonthDate;
  beforeDate: EnrichedMonthDate;
  weekdayIndex: number;
  weekday: WeekdayName;
  festivalPosition: 'between-festival-day-3-and-4';
  anchorMonthIndex: number;
}

export interface CalendarMonthData {
  year: number;
  monthIndex: number;
  monthName: MonthName;
  slots: CalendarMonthSlot[];
  eventCount: number;
  leapDay: EnrichedLeapDayDate | null;
  leapDayPlacement: CalendarMonthLeapDayPlacement | null;
  eclipseSummary: EclipseSummary;
}

export interface CalendarWeekItem {
  date: EnrichedAletheiaDate;
  events: NormalizedLoreEvent[];
  eclipses: EclipseOccurrence[];
}

export interface CalendarWeekData {
  items: CalendarWeekItem[];
  eclipseSummary: EclipseSummary;
}

export interface CalendarDayData {
  date: EnrichedAletheiaDate;
  events: NormalizedLoreEvent[];
  eclipses: EclipseOccurrence[];
  eclipseSummary: EclipseSummary;
  previousDate: EnrichedAletheiaDate | null;
  nextDate: EnrichedAletheiaDate | null;
}

export interface CalendarSelection {
  view: CalendarView;
  date: AletheiaDate;
}

function normalizeModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getWeekdayIndex(absDay: number): number {
  return normalizeModulo(absDay, DAYS_PER_WEEK);
}

function isIntegerToken(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function parseYearToken(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!isIntegerToken(trimmed)) {
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

  if (isIntegerToken(trimmed)) {
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

function countLeapYearsInRange(startYear: number, endYear: number): number {
  if (startYear > endYear) {
    return 0;
  }

  return Math.floor(endYear / LEAP_INTERVAL_YEARS) - Math.floor((startYear - 1) / LEAP_INTERVAL_YEARS);
}

function getLeapYearsBeforeYear(year: number): number {
  if (year > 0) {
    return countLeapYearsInRange(0, year - 1);
  }
  if (year < 0) {
    return -countLeapYearsInRange(year, -1);
  }
  return 1; // Year 0 is itself a leap year
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

function getEclipseAnchorDaynum(): number {
  return dateToDaynum({ kind: 'month', year: 0, monthIndex: 3, monthName: 'Vernalis', day: 21 }, 13, 47);
}

function getNearestSyzygyDaynum(seasonCenterDaynum: number, kind: EclipseKind): number {
  const offset = kind === 'solar' ? 0 : (LUNAR_CYCLE_DAYS / 2);
  const cycleIndex = Math.round((seasonCenterDaynum - getEclipseAnchorDaynum() - offset) / LUNAR_CYCLE_DAYS);
  return getEclipseAnchorDaynum() + offset + (cycleIndex * LUNAR_CYCLE_DAYS);
}

function buildEclipseOccurrence(kind: EclipseKind, peakDaynum: number, seasonIndex: number): EclipseOccurrence {
  const peakDate = daynumToDate(peakDaynum);

  const date = peakDate.date.kind === 'leapday'
    ? enrichDate(peakDate.date as LeapDayDate)
    : enrichDate(peakDate.date as MonthDate);

  return {
    kind,
    peakDaynum,
    date,
    hour: peakDate.hour,
    minute: peakDate.minute,
    seasonIndex,
  };
}

export function buildEclipseSummary(eclipses: EclipseOccurrence[]): EclipseSummary {
  return {
    eclipses,
    eclipseCount: eclipses.length,
    solarCount: eclipses.filter((eclipse) => eclipse.kind === 'solar').length,
    lunarCount: eclipses.filter((eclipse) => eclipse.kind === 'lunar').length,
  };
}

export function getEclipseOccurrencesForDaynumRange(startDaynum: number, endDaynumExclusive: number): EclipseOccurrence[] {
  const anchor = getEclipseAnchorDaynum();
  const startSeasonIndex = Math.floor((startDaynum - ECLIPSE_SEASON_HALF_WIDTH_DAYS - anchor) / ECLIPSE_YEAR_DAYS) - 1;
  const endSeasonIndex = Math.ceil((endDaynumExclusive + ECLIPSE_SEASON_HALF_WIDTH_DAYS - anchor) / ECLIPSE_YEAR_DAYS) + 1;
  const eclipses: EclipseOccurrence[] = [];

  for (let seasonIndex = startSeasonIndex; seasonIndex <= endSeasonIndex; seasonIndex += 1) {
    const seasonCenterDaynum = anchor + (seasonIndex * ECLIPSE_YEAR_DAYS);

    for (const kind of ['solar', 'lunar'] as const) {
      const peakDaynum = getNearestSyzygyDaynum(seasonCenterDaynum, kind);
      if (Math.abs(peakDaynum - seasonCenterDaynum) > ECLIPSE_SEASON_HALF_WIDTH_DAYS) {
        continue;
      }

      if (peakDaynum < startDaynum || peakDaynum >= endDaynumExclusive) {
        continue;
      }

      eclipses.push(buildEclipseOccurrence(kind, peakDaynum, seasonIndex));
    }
  }

  return eclipses.sort((left, right) => left.peakDaynum - right.peakDaynum);
}

export function buildEclipseProjectionMapForYearRange(startYear: number, endYear: number): Map<number, EclipseOccurrence[]> {
  const rangeStartYear = Math.min(startYear, endYear);
  const rangeEndYear = Math.max(startYear, endYear);
  const startDaynum = getYearStartAbsDay(rangeStartYear);
  const endDaynumExclusive = getYearStartAbsDay(rangeEndYear + 1);
  const eclipses = getEclipseOccurrencesForDaynumRange(startDaynum, endDaynumExclusive);
  const projectionMap = new Map<number, EclipseOccurrence[]>();

  eclipses.forEach((eclipse) => {
    const bucket = projectionMap.get(eclipse.date.absDay) ?? [];
    bucket.push(eclipse);
    projectionMap.set(eclipse.date.absDay, bucket);
  });

  return projectionMap;
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
  if (!Number.isInteger(absDay)) {
    throw new Error(`Absolute day '${absDay}' must be an integer`);
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

export function dateToDaynum(date: AletheiaDate, hour = 0, minute = 0): number {
  if (!Number.isInteger(hour) || hour < 0 || hour >= LOCAL_DAY_HOURS) {
    throw new Error(`Hour '${hour}' is out of range for a ${LOCAL_DAY_HOURS}-hour day`);
  }

  if (!Number.isInteger(minute) || minute < 0 || minute >= 60) {
    throw new Error(`Minute '${minute}' is out of range`);
  }

  const totalMinutes = (hour * 60) + minute;
  return toAbsDay(date) + (totalMinutes / MINUTES_PER_LOCAL_DAY);
}

export function daynumToDate(daynum: number): CalendarDaynumDate {
  if (!Number.isFinite(daynum)) {
    throw new Error(`Day number '${daynum}' must be finite`);
  }

  let absDay = Math.floor(daynum);
  let totalMinutes = Math.round((daynum - absDay) * MINUTES_PER_LOCAL_DAY);

  if (totalMinutes >= MINUTES_PER_LOCAL_DAY) {
    absDay += 1;
    totalMinutes -= MINUTES_PER_LOCAL_DAY;
  }

  if (totalMinutes < 0) {
    absDay -= 1;
    totalMinutes += MINUTES_PER_LOCAL_DAY;
  }

  return {
    date: fromAbsDay(absDay),
    hour: Math.floor(totalMinutes / 60),
    minute: normalizeModulo(totalMinutes, 60),
  };
}

export function enrichDate(date: MonthDate): EnrichedMonthDate;
export function enrichDate(date: LeapDayDate): EnrichedLeapDayDate;
export function enrichDate(date: AletheiaDate): EnrichedAletheiaDate {
  const absDay = toAbsDay(date);
  const weekdayIndex = getWeekdayIndex(absDay);
  const moonPhase = getMoonPhase(absDay);
  const moonPhaseLabel = getMoonPhaseLabel(moonPhase);
  const moonPhaseShortLabel = getMoonPhaseShortLabel(moonPhaseLabel);

  if (date.kind === 'leapday') {
    return {
      ...date,
      absDay,
      weekdayIndex,
      weekday: WEEKDAYS[weekdayIndex],
      moonPhase,
      moonPhaseLabel,
      moonPhaseShortLabel,
      isFullMoon: isFullMoon(absDay),
      isLeapYear: true,
      isFestivalLeapDay: true,
    };
  }

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
    if (options.includeWeekday === false) {
      return `Leap Day, ${date.year}`;
    }

    const enriched = 'weekday' in date ? date : enrichDate(date);
    return `${enriched.weekday}, Leap Day, ${enriched.year}`;
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

export function shiftAletheiaDate(date: AletheiaDate, deltaDays: number): AletheiaDate {
  const nextAbsDay = Math.max(0, toAbsDay(date) + deltaDays);
  return fromAbsDay(nextAbsDay);
}

function getLeapDayPlacementForYear(year: number): CalendarMonthLeapDayPlacement | null {
  const leapDayAbsDay = getLeapDayAbsDayForYear(year);
  if (leapDayAbsDay === null) {
    return null;
  }

  const leapDay = enrichDate({ kind: 'leapday', year });
  const rawAfterDate = fromAbsDay(leapDayAbsDay - 1);
  const rawBeforeDate = fromAbsDay(leapDayAbsDay + 1);

  if (rawAfterDate.kind !== 'month' || rawBeforeDate.kind !== 'month') {
    throw new Error(`Leap Day in year '${year}' must be bracketed by month dates`);
  }

  const afterDate = enrichDate(rawAfterDate);
  const beforeDate = enrichDate(rawBeforeDate);

  return {
    leapDay,
    afterDate,
    beforeDate,
    weekdayIndex: leapDay.weekdayIndex,
    weekday: leapDay.weekday,
    festivalPosition: 'between-festival-day-3-and-4',
    anchorMonthIndex: afterDate.monthIndex,
  };
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

export function getYearNavigationDate(date: AletheiaDate, deltaYears: number): AletheiaDate {
  const year = Math.max(0, date.year + deltaYears);

  if (date.kind === 'leapday') {
    return isLeapYear(year)
      ? { kind: 'leapday', year }
      : getMonthReferenceDate({ kind: 'leapday', year });
  }

  return {
    ...date,
    year,
  };
}

export function buildCalendarMonthData(
  year: number,
  monthIndex: number,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
  eclipseProjectionMap: Map<number, EclipseOccurrence[]> = new Map(),
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
    const eclipses = eclipseProjectionMap.get(date.absDay) ?? [];
    events.forEach((event) => eventIds.add(event.id));
    slots.push({
      kind: 'day',
      key: `${year}-${monthIndex}-${day}`,
      date,
      events,
      eclipses,
    });
  }

  const leapDayPlacementForYear = getLeapDayPlacementForYear(year);
  const leapDayPlacement = leapDayPlacementForYear !== null && (
    leapDayPlacementForYear.afterDate.monthIndex === monthIndex
    || leapDayPlacementForYear.beforeDate.monthIndex === monthIndex
  )
    ? leapDayPlacementForYear
    : null;
  const leapDay = leapDayPlacement?.leapDay ?? null;

  if (leapDayPlacementForYear !== null && leapDayPlacementForYear.anchorMonthIndex === monthIndex) {
    const leapDayEvents = eventProjectionMap.get(leapDayPlacementForYear.leapDay.absDay) ?? [];
    const leapDayEclipses = eclipseProjectionMap.get(leapDayPlacementForYear.leapDay.absDay) ?? [];
    leapDayEvents.forEach((event) => eventIds.add(event.id));

    const insertAfterIndex = slots.findIndex((slot) => slot.kind === 'day' && slot.date.absDay === leapDayPlacementForYear.afterDate.absDay);
    if (insertAfterIndex !== -1) {
      slots.splice(insertAfterIndex + 1, 0, {
        kind: 'leapday',
        key: `${year}-leapday`,
        date: leapDayPlacementForYear.leapDay,
        events: leapDayEvents,
        eclipses: leapDayEclipses,
      });
    }
  }

  while (slots.length % DAYS_PER_WEEK !== 0) {
    slots.push({ kind: 'empty', key: `empty-${year}-${monthIndex}-tail-${slots.length}` });
  }

  return {
    year,
    monthIndex,
    monthName,
    slots,
    eventCount: eventIds.size,
    leapDay,
    leapDayPlacement,
    eclipseSummary: buildEclipseSummary(slots.flatMap((slot) => slot.kind === 'empty' ? [] : slot.eclipses)),
  };
}

export function buildCalendarYearData(
  year: number,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
  eclipseProjectionMap: Map<number, EclipseOccurrence[]> = new Map(),
): CalendarMonthData[] {
  return MONTHS.map((_, monthIndex) => buildCalendarMonthData(year, monthIndex + 1, eventProjectionMap, eclipseProjectionMap));
}

export function buildCalendarWeekData(
  selectedDate: AletheiaDate,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
  eclipseProjectionMap: Map<number, EclipseOccurrence[]> = new Map(),
): CalendarWeekData {
  const anchorAbsDay = toAbsDay(selectedDate);
  const weekStartAbsDay = anchorAbsDay - normalizeModulo(anchorAbsDay, DAYS_PER_WEEK);
  const items: CalendarWeekItem[] = [];

  for (let offset = 0; offset < DAYS_PER_WEEK; offset += 1) {
    const date = enrichAletheiaDate(fromAbsDay(weekStartAbsDay + offset));

    items.push({
      date,
      events: eventProjectionMap.get(date.absDay) ?? [],
      eclipses: eclipseProjectionMap.get(date.absDay) ?? [],
    });
  }

  return {
    items,
    eclipseSummary: buildEclipseSummary(items.flatMap((item) => item.eclipses)),
  };
}

export function buildCalendarDayData(
  selectedDate: AletheiaDate,
  eventProjectionMap: Map<number, NormalizedLoreEvent[]>,
  eclipseProjectionMap: Map<number, EclipseOccurrence[]> = new Map(),
): CalendarDayData {
  const date = enrichAletheiaDate(selectedDate);
  const eclipses = eclipseProjectionMap.get(date.absDay) ?? [];
  const previousDate = date.absDay > 0 ? enrichAletheiaDate(fromAbsDay(date.absDay - 1)) : null;
  const nextDate = enrichAletheiaDate(fromAbsDay(date.absDay + 1));

  return {
    date,
    events: eventProjectionMap.get(date.absDay) ?? [],
    eclipses,
    eclipseSummary: buildEclipseSummary(eclipses),
    previousDate,
    nextDate,
  };
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

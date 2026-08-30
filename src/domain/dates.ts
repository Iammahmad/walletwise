interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday?: string;
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
    weekday: parts.find((part) => part.type === 'weekday')?.value,
  };
}

export function zonedDateTimeToUtc(parts: Omit<ZonedParts, 'weekday'>, timezone: string): Date {
  const desired = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(candidate, timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    candidate = new Date(candidate.getTime() + (desired - represented));
  }
  return candidate;
}

function shiftCalendarDay(parts: ZonedParts, days: number): ZonedParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function resolveSpokenDate(text: string, reference: Date, timezone: string): string | null {
  const lower = text.toLowerCase();
  const current = getZonedParts(reference, timezone);
  if (/\btoday\b/.test(lower)) return reference.toISOString();
  if (/\byesterday\b/.test(lower)) return zonedDateTimeToUtc(shiftCalendarDay(current, -1), timezone).toISOString();

  const weekdayIndex = WEEKDAYS.findIndex((weekday) => new RegExp(`\\b${weekday}\\b`).test(lower));
  if (weekdayIndex >= 0) {
    const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
    let distance = (currentDay - weekdayIndex + 7) % 7;
    if (distance === 0) distance = 7;
    return zonedDateTimeToUtc(shiftCalendarDay(current, -distance), timezone).toISOString();
  }

  const isoMatch = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  const slashMatch = lower.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
  if (isoMatch) {
    return zonedDateTimeToUtc(
      { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]), hour: 12, minute: 0, second: 0 },
      timezone,
    ).toISOString();
  }
  if (slashMatch) {
    return zonedDateTimeToUtc(
      { year: Number(slashMatch[3]), month: Number(slashMatch[2]), day: Number(slashMatch[1]), hour: 12, minute: 0, second: 0 },
      timezone,
    ).toISOString();
  }
  return null;
}

export function monthBounds(reference: Date, timezone: string): { start: string; end: string } {
  const current = getZonedParts(reference, timezone);
  const start = zonedDateTimeToUtc({ year: current.year, month: current.month, day: 1, hour: 0, minute: 0, second: 0 }, timezone);
  const nextYear = current.month === 12 ? current.year + 1 : current.year;
  const nextMonth = current.month === 12 ? 1 : current.month + 1;
  const end = zonedDateTimeToUtc({ year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0 }, timezone);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatDate(iso: string, locale: string, timezone: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(new Date(iso));
}

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
    weekday: parts.find((part) => part.type === "weekday")?.value,
  };
}

export function zonedDateTimeToUtc(
  parts: Omit<ZonedParts, "weekday">,
  timezone: string,
): Date {
  const desired = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let candidate = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getZonedParts(candidate, timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    candidate = new Date(candidate.getTime() + (desired - represented));
  }
  return candidate;
}

function shiftCalendarDay(parts: ZonedParts, days: number): ZonedParts {
  const shifted = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + days,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const MONTH_ALIASES: Readonly<Record<string, number>> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const ORDINAL_DAYS: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty second": 22,
  "twenty third": 23,
  "twenty fourth": 24,
  "twenty fifth": 25,
  "twenty sixth": 26,
  "twenty seventh": 27,
  "twenty eighth": 28,
  "twenty ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
};

const DAY_WORD_PATTERN = Object.keys(ORDINAL_DAYS)
  .sort((left, right) => right.length - left.length)
  .map((value) => value.replace(" ", "[-\\s]+"))
  .join("|");
const DAY_PATTERN = `(?:[0-3]?\\d(?:st|nd|rd|th)?|${DAY_WORD_PATTERN})`;
const MONTH_PATTERN = Object.keys(MONTH_ALIASES)
  .sort((left, right) => right.length - left.length)
  .join("|");

function parseDay(value: string): number | null {
  const normalized = value
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const numeric = normalized.match(/^([0-3]?\d)(?:st|nd|rd|th)?$/)?.[1];
  const day = numeric ? Number(numeric) : ORDINAL_DAYS[normalized];
  return day != null && day >= 1 && day <= 31 ? day : null;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function resolveCalendarDate(
  year: number,
  month: number,
  day: number,
  timezone: string,
): string | null {
  if (!isValidCalendarDate(year, month, day)) return null;
  return zonedDateTimeToUtc(
    { year, month, day, hour: 12, minute: 0, second: 0 },
    timezone,
  ).toISOString();
}

function relatedMonth(
  current: ZonedParts,
  relation: string,
): { year: number; month: number } {
  const offset =
    relation === "last" || relation === "previous"
      ? -1
      : relation === "next"
        ? 1
        : 0;
  const shifted = new Date(
    Date.UTC(current.year, current.month - 1 + offset, 1),
  );
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

function localeUsesMonthFirst(locale: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "numeric",
    }).formatToParts(new Date(Date.UTC(2020, 10, 22)));
    return (
      parts.findIndex((part) => part.type === "month") <
      parts.findIndex((part) => part.type === "day")
    );
  } catch {
    return false;
  }
}

export function hasSpokenDateIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(today|yesterday)\b/.test(lower) ||
    WEEKDAYS.some((weekday) => new RegExp(`\\b${weekday}\\b`).test(lower)) ||
    Object.keys(MONTH_ALIASES).some((month) =>
      new RegExp(`\\b${month}\\b`).test(lower),
    ) ||
    /\b(?:this|last|previous|next)\s+month\b/.test(lower) ||
    /\b(?:19|20)\d{2}-\d{1,2}-\d{1,2}\b/.test(lower) ||
    /\b\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)\d{2}\b/.test(lower) ||
    new RegExp(`\\bon\\s+(?:the\\s+)?${DAY_PATTERN}\\b`).test(lower)
  );
}

export function resolveSpokenDate(
  text: string,
  reference: Date,
  timezone: string,
  locale = "en-GB",
): string | null {
  const lower = text.toLowerCase();
  const current = getZonedParts(reference, timezone);
  if (/\btoday\b/.test(lower)) return reference.toISOString();
  if (/\byesterday\b/.test(lower))
    return zonedDateTimeToUtc(
      shiftCalendarDay(current, -1),
      timezone,
    ).toISOString();

  const monthBoundaryMatch = lower.match(
    new RegExp(
      `\\b(last\\s+day|end|first\\s+day|start|beginning)\\s+of\\s+(this|last|previous|next)\\s+month\\b`,
    ),
  );
  if (monthBoundaryMatch) {
    const target = relatedMonth(current, monthBoundaryMatch[2]!);
    const isEnd = /last\s+day|end/.test(monthBoundaryMatch[1]!);
    const day = isEnd
      ? new Date(Date.UTC(target.year, target.month, 0)).getUTCDate()
      : 1;
    return resolveCalendarDate(target.year, target.month, day, timezone);
  }

  const relativeMonthMatch = lower.match(
    new RegExp(
      `\\b(?:the\\s+)?(${DAY_PATTERN})\\s+of\\s+(this|last|previous|next)\\s+month\\b`,
    ),
  );
  if (relativeMonthMatch) {
    const day = parseDay(relativeMonthMatch[1]!);
    const target = relatedMonth(current, relativeMonthMatch[2]!);
    return day == null
      ? null
      : resolveCalendarDate(target.year, target.month, day, timezone);
  }

  const dayFirstNamedMatch = lower.match(
    new RegExp(
      `\\b(?:the\\s+)?(${DAY_PATTERN})\\s+(?:of\\s+)?(${MONTH_PATTERN})(?:\\s*,?\\s*((?:19|20)\\d{2}|2100))?\\b`,
    ),
  );
  if (dayFirstNamedMatch) {
    const day = parseDay(dayFirstNamedMatch[1]!);
    const month = MONTH_ALIASES[dayFirstNamedMatch[2]!.toLowerCase()];
    const year = dayFirstNamedMatch[3]
      ? Number(dayFirstNamedMatch[3])
      : current.year;
    return day == null || month == null
      ? null
      : resolveCalendarDate(year, month, day, timezone);
  }

  const monthFirstNamedMatch = lower.match(
    new RegExp(
      `\\b(${MONTH_PATTERN})\\s+(?:the\\s+)?(${DAY_PATTERN})(?:\\s*,?\\s*((?:19|20)\\d{2}|2100))?\\b`,
    ),
  );
  if (monthFirstNamedMatch) {
    const month = MONTH_ALIASES[monthFirstNamedMatch[1]!.toLowerCase()];
    const day = parseDay(monthFirstNamedMatch[2]!);
    const year = monthFirstNamedMatch[3]
      ? Number(monthFirstNamedMatch[3])
      : current.year;
    return day == null || month == null
      ? null
      : resolveCalendarDate(year, month, day, timezone);
  }

  const isoMatch = lower.match(/\b((?:19|20)\d{2}|2100)-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return resolveCalendarDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      timezone,
    );
  }

  const slashMatch = lower.match(
    /\b(\d{1,2})[\/-](\d{1,2})[\/-]((?:19|20)\d{2}|2100)\b/,
  );
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const monthFirst = localeUsesMonthFirst(locale);
    return resolveCalendarDate(
      Number(slashMatch[3]),
      monthFirst ? first : second,
      monthFirst ? second : first,
      timezone,
    );
  }

  const currentMonthDayMatch = lower.match(
    new RegExp(`\\bon\\s+(?:the\\s+)?(${DAY_PATTERN})\\b(?!\\s+of\\b)`),
  );
  if (currentMonthDayMatch) {
    const day = parseDay(currentMonthDayMatch[1]!);
    return day == null
      ? null
      : resolveCalendarDate(current.year, current.month, day, timezone);
  }

  const weekdayIndex = WEEKDAYS.findIndex((weekday) =>
    new RegExp(`\\b${weekday}\\b`).test(lower),
  );
  if (weekdayIndex >= 0) {
    const currentDay = new Date(
      Date.UTC(current.year, current.month - 1, current.day),
    ).getUTCDay();
    let distance = (currentDay - weekdayIndex + 7) % 7;
    if (distance === 0) distance = 7;
    return zonedDateTimeToUtc(
      shiftCalendarDay(current, -distance),
      timezone,
    ).toISOString();
  }
  return null;
}

export function monthBounds(
  reference: Date,
  timezone: string,
): { start: string; end: string } {
  return monthBoundsFromStart(monthStartFor(reference, timezone), timezone);
}

function parseMonthStart(monthStart: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})-01$/.exec(monthStart);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (!match || !Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error("Invalid calendar month.");
  }
  return { year, month };
}

export function monthStartFor(reference: Date, timezone: string): string {
  const current = getZonedParts(reference, timezone);
  return `${current.year}-${String(current.month).padStart(2, "0")}-01`;
}

export function shiftMonthStart(monthStart: string, offset: number): string {
  const { year, month } = parseMonthStart(monthStart);
  if (!Number.isInteger(offset))
    throw new Error("Month offset must be an integer.");
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthBoundsFromStart(
  monthStart: string,
  timezone: string,
): { start: string; end: string } {
  const { year, month } = parseMonthStart(monthStart);
  const start = zonedDateTimeToUtc(
    { year, month, day: 1, hour: 0, minute: 0, second: 0 },
    timezone,
  );
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = zonedDateTimeToUtc(
    { year: nextYear, month: nextMonth, day: 1, hour: 0, minute: 0, second: 0 },
    timezone,
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatMonthStart(monthStart: string, locale: string): string {
  const { year, month } = parseMonthStart(monthStart);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatDate(
  iso: string,
  locale: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(iso));
}

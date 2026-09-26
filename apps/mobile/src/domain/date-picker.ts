import { validDate } from './calendar.ts';

type CalendarLocale = 'ja' | 'en';

/** All values remain date-only. A displayed month is never an answer. */
export function monthStart(date: string): string | null {
  return validDate(date) ? `${date.slice(0, 7)}-01` : null;
}

export function shiftMonth(month: string, delta: number): string | null {
  const first = monthStart(month);
  if (!first || !Number.isSafeInteger(delta)) return null;
  const index = Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1 + delta;
  if (!Number.isSafeInteger(index) || index < 0 || index > 9999 * 12 + 11) return null;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`;
}

function monthLength(first: string): number {
  const year = Number(first.slice(0, 4));
  const month = Number(first.slice(5, 7));
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Sunday-first complete weeks; outside-month cells are not selectable dates. */
export function monthCells(month: string): (string | null)[] {
  const first = monthStart(month);
  if (!first) return [];
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay();
  const length = monthLength(first);
  return Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > length ? null : `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
  });
}

// Unknown or malformed bounds do not invent a limit. Parent forms still validate
// their own input; valid but inverted bounds leave no selectable dates.
export function dateSelectable(date: string, min?: string, max?: string): boolean {
  return validDate(date)
    && (!min || !validDate(min) || date >= min)
    && (!max || !validDate(max) || date <= max);
}

export function monthSelectable(month: string, min?: string, max?: string): boolean {
  const first = monthStart(month);
  if (!first) return false;
  if (min && max && validDate(min) && validDate(max) && min > max) return false;
  const last = `${first.slice(0, 8)}${monthLength(first)}`;
  return (!min || !validDate(min) || last >= min)
    && (!max || !validDate(max) || first <= max);
}

/** Clamp the calendar's DISPLAY anchor, never a selected/unknown answer. */
export function initialMonth(value: string, today: string, min?: string, max?: string): string {
  let anchor = [value, today, min, max].find(candidate => !!candidate && validDate(candidate)) ?? '1970-01-01';
  if (min && validDate(min) && anchor < min) anchor = min;
  if (max && validDate(max) && anchor > max) anchor = max;
  return monthStart(anchor)!;
}

/** Use UTC solely for localized names, not to alter the entered calendar day. */
export function formatCalendarDate(date: string, locale: CalendarLocale): string {
  if (!validDate(date)) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  const language = locale === 'ja' ? 'ja-JP' : 'en-US';
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(parsed);
  const year = date.slice(0, 4); // Intl's era conversion must not turn ISO 0000 into year 1.
  const day = Number(date.slice(8, 10));
  if (locale === 'ja') return `${year}年${Number(date.slice(5, 7))}月${day}日 ${weekday}`;
  const month = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(parsed);
  return `${weekday}, ${month} ${day}, ${year}`;
}

export function monthTitle(month: string, locale: CalendarLocale): string {
  const first = monthStart(month);
  if (!first) return '';
  const year = first.slice(0, 4);
  if (locale === 'ja') return `${year}年 ${Number(first.slice(5, 7))}月`;
  const name = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${first}T00:00:00Z`));
  return `${name} ${year}`;
}

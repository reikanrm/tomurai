/** Date-only arithmetic; never use these helpers to determine legal deadlines. */
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function todayInJapan(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
}
export function addDays(value: string, days: number): string | null {
  if (!validDate(value) || !Number.isInteger(days)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function addMonths(value: string, months: number): string | null {
  if (!validDate(value) || !Number.isInteger(months)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return date.toISOString().slice(0, 10);
}
export function daysBetween(start: string, end: string): number | null {
  if (!validDate(start) || !validDate(end)) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}
export function inWindow(today: string, start: string | null, days = 7): boolean {
  if (!start) return false;
  const elapsed = daysBetween(start, today);
  return elapsed !== null && elapsed >= 0 && elapsed < days;
}

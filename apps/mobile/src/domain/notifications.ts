import { daysBetween, todayInJapan, validDate } from './calendar.ts';
export type ReminderContext = {
  userId: string; enabled: boolean; linked: boolean; active: boolean; copyApproved: boolean;
  hour: number; enabledAt: string; linkedAt: string; lastAcceptedDay: string | null;
};
export type ReminderTask = {
  id: string; groupId: string; assignee: string | null; done: boolean; notNeeded: boolean; optional: boolean;
  dueDate: string | null; deadlineVerified: boolean; accessible: boolean; registeredAt: string;
};
export type NotificationItem = { id: string; ownerId: string; date: string; read: boolean };
export const reminderBody = '確認できる手続きがあります。Tomuraiでご確認ください。';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.trim() === value;
const clockMillis = (value: unknown): number => {
  try { return value instanceof Date ? Date.prototype.getTime.call(value) : NaN; }
  catch { return NaN; }
};
const timestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)
    || !validDate(value.slice(0, 10))) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
/** Pure preflight only; delivery still requires an atomic daily reservation and reauthorization. */
export function notificationDigest(context: ReminderContext, tasks: readonly ReminderTask[], now: Date) {
  const currentMs = clockMillis(now);
  if (!record(context) || !Array.isArray(tasks) || !Number.isFinite(currentMs) || !identifier(context.userId)
    || context.enabled !== true || context.linked !== true || context.active !== true || context.copyApproved !== true
    || !Number.isInteger(context.hour) || context.hour < 0 || context.hour > 23) return null;
  const date = todayInJapan(new Date(currentMs));
  if (!validDate(date) || (context.lastAcceptedDay !== null &&
    (typeof context.lastAcceptedDay !== 'string' || !validDate(context.lastAcceptedDay) || context.lastAcceptedDay > date))) return null;
  const scheduled = Date.parse(`${date}T${String(context.hour).padStart(2, '0')}:00:00+09:00`);
  const enabled = timestamp(context.enabledAt);
  const linked = timestamp(context.linkedAt);
  if (context.lastAcceptedDay === date || enabled === null || linked === null || enabled > scheduled || linked > scheduled || currentMs < scheduled) return null;
  const needed = tasks.some(task => {
    if (!record(task) || !identifier(task.id) || !identifier(task.groupId) || task.accessible !== true
      || task.assignee !== context.userId || task.done !== false || task.notNeeded !== false || task.optional !== false
      || task.deadlineVerified !== true || typeof task.dueDate !== 'string') return false;
    const registered = timestamp(task.registeredAt);
    if (registered === null || registered > scheduled) return false;
    const days = daysBetween(date, task.dueDate);
    return days !== null && [30, 7, 1, 0, -1].includes(days);
  });
  return needed ? { key: `${context.userId}:${date}:task-digest`, date, body: reminderBody } : null;
}
export function markNotificationRead(item: NotificationItem, userId: string): NotificationItem | null {
  if (!record(item) || !identifier(userId) || !identifier(item.id) || !identifier(item.ownerId) || item.ownerId !== userId
    || typeof item.date !== 'string' || !validDate(item.date) || typeof item.read !== 'boolean') return null;
  return { id: item.id, ownerId: item.ownerId, date: item.date, read: true };
}

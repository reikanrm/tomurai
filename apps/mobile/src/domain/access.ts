import type { GuidanceTask } from './guidance-model';

export type AccessPreview = {
  membership: 'active' | 'pending';
  canManageBilling: boolean;
  isRespondent: boolean;
  entitlement: 'free' | 'beta' | 'b2c_solo' | 'b2c_family' | 'corporate' | 'expired';
  activeMemberCount: number;
};

export const defaultAccess: AccessPreview = Object.freeze({
  membership: 'active',
  canManageBilling: true,
  isRespondent: true,
  entitlement: 'free',
  activeMemberCount: 1,
});

/** Local synthetic preview only. Real authorization must come from the server. */
export function resolveAccess(preview: AccessPreview, development: boolean): AccessPreview {
  return development ? preview : defaultAccess;
}

export function canEditAnswers(access: AccessPreview): boolean {
  return access.membership === 'active' && access.isRespondent;
}

/** Call only for a locked section; this never starts checkout or sends a request. */
export function lockAction(access: AccessPreview): 'checkout' | 'request' | null {
  if (access.membership !== 'active') return null;
  return access.canManageBilling ? 'checkout' : 'request';
}

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const taskDate = (task: GuidanceTask) => task.scheduledDate ?? task.guidanceDate ?? '9999';
const fixedIds = (ids: readonly string[]): string[] => [...new Set(ids)].slice(0, 2);

/** Null means not yet selected; an empty array is already a final selection. */
export function freezeFreeTaskIds(tasks: readonly GuidanceTask[], existing: null | readonly string[]): readonly string[] {
  if (existing !== null) return Object.freeze(fixedIds(existing));
  const ordered = [...tasks].sort((a, b) => compare(taskDate(a), taskDate(b)) || compare(a.id, b.id));
  return Object.freeze(fixedIds(ordered.map(task => task.id)));
}

/** Apply before list filters. The result never contains any locked task details. */
export function selectTaskAccess(tasks: readonly GuidanceTask[], access: AccessPreview, freeIds: readonly string[]): {
  visibleTasks: GuidanceTask[];
  hasLocked: boolean;
  fullAccess: boolean;
} {
  if (access.membership !== 'active') return { visibleTasks: [], hasLocked: false, fullAccess: false };
  const fullAccess = access.entitlement === 'beta' || access.entitlement === 'b2c_family'
    || access.entitlement === 'corporate' || (access.entitlement === 'b2c_solo' && access.activeMemberCount === 1);
  if (fullAccess) return { visibleTasks: [...tasks], hasLocked: false, fullAccess: true };
  const allowed = new Set(fixedIds(freeIds));
  const visibleTasks = tasks.filter(task => allowed.has(task.id));
  return { visibleTasks, hasLocked: visibleTasks.length < tasks.length, fullAccess: false };
}

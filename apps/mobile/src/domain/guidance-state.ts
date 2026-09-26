import type { CompletionKey, GuidancePlan, GuidanceTask } from './guidance-model';
export type EventDates = Partial<Record<'funeral' | 'burial' | 'thanks' | 'all-tasks', string>>;
export function recordPlanEvents(previous: GuidancePlan, next: GuidancePlan, today: string, events: EventDates): EventDates {
  const result = { ...events };
  if (next.funeralDone === 'yes' && previous.funeralDone !== 'yes') result.funeral = today;
  if (next.burial === 'done' && previous.burial !== 'done') result.burial = today;
  if (next.returnsDone === 'yes' && previous.returnsDone !== 'yes') result.thanks = today;
  return result;
}
export function planWithCompletion(plan: GuidancePlan, key: CompletionKey, done: boolean,
  previousBurial: Exclude<GuidancePlan['burial'], 'done'> = 'unknown'): GuidancePlan {
  return { ...plan, [key]: key === 'burial' ? (done ? 'done' : previousBurial) : (done ? 'yes' : 'no') };
}
export function allGuidanceComplete(tasks: GuidanceTask[], plan: GuidancePlan): boolean {
  return tasks.length > 0 && plan.rituals !== 'unknown' && plan.inheritance !== 'unknown'
    && plan.burial !== 'unknown' && plan.returnsDone !== 'unknown'
    && (plan.rituals !== 'yes' || (plan.firstWeekDone !== 'unknown' && plan.fortyNineDone !== 'unknown'
      && (plan.fortyNineDone === 'notNeeded' || (plan.tablet !== 'unknown' && plan.altar !== 'unknown'))))
    && tasks.every(task => task.done);
}

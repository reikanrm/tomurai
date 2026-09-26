import type { CompletionKey, GuidancePlan, GuidanceTask, RitualWorkHistory } from './guidance-model';
export type EventDates = Partial<Record<'funeral' | 'burial' | 'thanks' | 'all-tasks' | 'forty-nine', string>>;
export function recordRitualWork(previous: GuidancePlan, next: GuidancePlan, history: RitualWorkHistory): RitualWorkHistory {
  const issued = (plan: GuidancePlan, key: 'firstWeekDone' | 'fortyNineDone') =>
    plan.rituals === 'yes' && (plan[key] === 'no' || plan[key] === 'unknown');
  return {
    firstWeek: history.firstWeek || issued(previous, 'firstWeekDone') || issued(next, 'firstWeekDone'),
    fortyNine: history.fortyNine || issued(previous, 'fortyNineDone') || issued(next, 'fortyNineDone'),
  };
}
export function recordPlanEvents(previous: GuidancePlan, next: GuidancePlan, today: string, events: EventDates): EventDates {
  const result = { ...events };
  if (next.funeralDone === 'yes' && previous.funeralDone !== 'yes') result.funeral = today;
  if (next.burial === 'done' && previous.burial !== 'done') result.burial = today;
  if (next.returnsDone === 'yes' && previous.returnsDone !== 'yes') result.thanks = today;
  if (next.fortyNineDone === 'yes' && previous.fortyNineDone !== 'yes') result['forty-nine'] = today;
  else if (next.fortyNineDone !== 'yes') delete result['forty-nine'];
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
    && tasks.every(task => task.done || (task.optional && !task.completionKey && task.notNeeded));
}

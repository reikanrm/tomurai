import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import { deriveGuidanceTasks, applyTaskProgress } from '../apps/mobile/src/domain/guidance.ts';
import { recordPlanEvents, planWithCompletion, allGuidanceComplete } from '../apps/mobile/src/domain/guidance-state.ts';
import { selectMilestone } from '../apps/mobile/src/domain/milestones.ts';
test('completion actions update plan authority and preserve prior burial timing on undo', () => {
  for (const key of ['firstWeekDone', 'fortyNineDone', 'returnsDone']) {
    assert.equal(planWithCompletion(defaultPlan, key, true)[key], 'yes');
    assert.equal(planWithCompletion(defaultPlan, key, false)[key], 'no');
  }
  const completed = planWithCompletion({ ...defaultPlan, burial: 'later' }, 'burial', true);
  assert.equal(completed.burial, 'done');
  assert.equal(planWithCompletion(completed, 'burial', false, 'later').burial, 'later');
  assert.equal(planWithCompletion(completed, 'burial', false).burial, 'unknown');
});
test('plan events record only new confirmations, not a fabricated historical execution date', () => {
  const next = { ...defaultPlan, funeralDone: 'yes', burial: 'done', returnsDone: 'yes' };
  const dates = recordPlanEvents(defaultPlan, next, '2026-09-26', {});
  assert.deepEqual(dates, { funeral: '2026-09-26', burial: '2026-09-26', thanks: '2026-09-26' });
  assert.deepEqual(recordPlanEvents(next, next, '2026-09-27', dates), dates);
  assert.equal(selectMilestone({ today: '2026-09-26', plan: { ...next, funeralDone: 'no', burial: 'unknown', returnsDone: 'no' }, eventDates: dates, allTasksDone: false, dismissed: [] }), null);
});
test('real derived tasks can reach all-complete; zero or unanswered choices cannot', () => {
  const plan = { ...defaultPlan, rituals: 'no', burial: 'none', returnsDone: 'notNeeded', inheritance: 'no' };
  const tasks = deriveGuidanceTasks(plan);
  const progress = Object.fromEntries(tasks.map(task => [task.id, { done: true, assignee: 'self' }]));
  const completed = applyTaskProgress(tasks, progress);
  assert.equal(allGuidanceComplete(completed, plan), true);
  assert.equal(selectMilestone({ today: '2026-09-26', plan, eventDates: { 'all-tasks': '2026-09-26' }, allTasksDone: allGuidanceComplete(completed, plan), dismissed: [] }).id, 'all-tasks');
  assert.equal(allGuidanceComplete([], plan), false);
  assert.equal(allGuidanceComplete(completed, { ...plan, inheritance: 'unknown' }), false);
  assert.equal(allGuidanceComplete(completed, { ...plan, burial: 'unknown' }), false);
  assert.equal(allGuidanceComplete(tasks, plan), false);
});

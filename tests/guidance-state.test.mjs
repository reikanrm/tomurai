import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPlan, defaultRitualWorkHistory } from '../apps/mobile/src/domain/guidance-model.ts';
import { deriveGuidanceTasks, applyTaskProgress } from '../apps/mobile/src/domain/guidance.ts';
import { recordPlanEvents, recordRitualWork, planWithCompletion, allGuidanceComplete } from '../apps/mobile/src/domain/guidance-state.ts';
import { selectMilestone } from '../apps/mobile/src/domain/milestones.ts';

test('TOM-42: completing the service cannot hide outstanding work or announce all-complete', () => {
  const plan = { ...defaultPlan, deathDate: '2026-09-01', rituals: 'yes', funeralDone: 'yes',
    firstWeekDone: 'yes', fortyNineDone: 'no', fortyNineDate: '2026-10-10', tablet: 'no',
    fortyNineMeal: 'yes', gifts: 'yes', eyeOpening: 'yes', altar: 'no', burial: 'none',
    returnsDone: 'notNeeded', inheritance: 'yes' };
  const history = { firstWeek: false, fortyNine: true };
  const outstanding = ['forty-nine-offering', 'forty-nine-meal-day', 'forty-nine-eye-opening'];
  const before = deriveGuidanceTasks(plan, history);
  const progress = Object.fromEntries(before.map(task => [task.id, { done: !outstanding.includes(task.id), assignee: 'family-a' }]));
  const next = planWithCompletion(plan, 'fortyNineDone', true);
  const after = applyTaskProgress(deriveGuidanceTasks(next, history), progress);
  assert.equal(allGuidanceComplete(after, next), false);
  for (const id of outstanding) {
    assert.equal(after.find(task => task.id === id)?.done, false);
    assert.equal(after.find(task => task.id === id)?.assignee, 'family-a');
  }
  assert.equal(selectMilestone({ today: '2026-10-20', plan: next,
    eventDates: { 'all-tasks': '2026-10-20' }, allTasksDone: allGuidanceComplete(after, next), dismissed: [] }), null);
});
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

test('work history records committed preparation without inventing work for initially completed services', () => {
  const initialCompleted = { ...defaultPlan, rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'yes' };
  assert.deepEqual(recordRitualWork(defaultPlan, initialCompleted, defaultRitualWorkHistory), defaultRitualWorkHistory);
  const notYet = { ...initialCompleted, firstWeekDone: 'unknown', fortyNineDone: 'no' };
  const issued = recordRitualWork(defaultPlan, notYet, defaultRitualWorkHistory);
  assert.deepEqual(issued, { firstWeek: true, fortyNine: true });
  assert.deepEqual(defaultRitualWorkHistory, { firstWeek: false, fortyNine: false });
  assert.deepEqual(recordRitualWork(notYet, initialCompleted, defaultRitualWorkHistory), issued);
  const hidden = { ...initialCompleted, rituals: 'no', firstWeekDone: 'notNeeded', fortyNineDone: 'notNeeded' };
  assert.deepEqual(recordRitualWork(initialCompleted, hidden, issued), issued);
  assert.deepEqual(recordRitualWork(hidden, initialCompleted, issued), issued);
  assert.deepEqual(recordRitualWork(defaultPlan, { ...notYet, rituals: 'no' }, defaultRitualWorkHistory), defaultRitualWorkHistory);
});

test('all-complete accepts explicit optional exclusions but never silently completes those tasks', () => {
  const plan = { ...defaultPlan, rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'yes',
    fortyNineMeal: 'yes', eyeOpening: 'yes', tablet: 'no', altar: 'no', burial: 'none', returnsDone: 'notNeeded', inheritance: 'no' };
  const tasks = deriveGuidanceTasks(plan);
  const outstanding = ['forty-nine-offering', 'forty-nine-meal-day', 'forty-nine-eye-opening'];
  const progress = Object.fromEntries(tasks.map(task => [task.id, { done: !outstanding.includes(task.id), notNeeded: outstanding.includes(task.id) }]));
  const resolved = applyTaskProgress(tasks, progress);
  assert.equal(allGuidanceComplete(resolved, plan), true);
  for (const id of outstanding) {
    assert.equal(resolved.find(t => t.id === id).done, false);
    assert.equal(resolved.find(t => t.id === id).notNeeded, true);
  }
  const reopened = applyTaskProgress(tasks, { ...progress, 'forty-nine-meal-day': { done: false, notNeeded: false } });
  assert.equal(allGuidanceComplete(reopened, plan), false);
  assert.equal(allGuidanceComplete(resolved, { ...plan, inheritance: 'unknown' }), false);
});

test('forty-nine confirmation date records first confirmation, clears on undo, and renews on re-confirmation', () => {
  const completed = { ...defaultPlan, fortyNineDone: 'yes' };
  const other = { funeral: '2026-09-01', burial: '2026-09-02', thanks: '2026-09-03' };
  const recorded = recordPlanEvents(defaultPlan, completed, '2026-10-10', other);
  assert.deepEqual(recorded, { ...other, 'forty-nine': '2026-10-10' });
  assert.deepEqual(recordPlanEvents(completed, completed, '2026-10-11', recorded), recorded);
  for (const state of ['no', 'unknown', 'notNeeded']) {
    const undone = { ...completed, fortyNineDone: state };
    const cleared = recordPlanEvents(completed, undone, '2026-10-11', recorded);
    assert.deepEqual(cleared, other);
    assert.equal(recordPlanEvents(undone, completed, '2026-10-12', cleared)['forty-nine'], '2026-10-12');
  }
  assert.deepEqual(other, { funeral: '2026-09-01', burial: '2026-09-02', thanks: '2026-09-03' });
});

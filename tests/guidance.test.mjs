import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import { applyTaskProgress, deriveGuidanceTasks } from '../apps/mobile/src/domain/guidance.ts';

const plan = changes => ({ ...defaultPlan, ...changes });
const byId = (tasks, id) => tasks.find(task => task.id === id);
const ids = tasks => tasks.map(task => task.id);

test('default plan starts with four neutral procedure checks and no invented progress', () => {
  const tasks = deriveGuidanceTasks(plan({}));
  assert.deepEqual(ids(tasks).slice(0, 4), [
    'receive-medical-certificate',
    'confirm-death-registration',
    'confirm-bank-inheritance',
    'review-service-contracts',
  ]);
  for (const task of tasks.slice(0, 4)) {
    assert.equal(task.group, 'general');
    assert.equal(task.done, false);
    assert.equal(task.assignee, null);
    assert.equal(task.needsConfirmation, true);
  }
  assert.ok(byId(tasks, 'confirm-ritual-guidance'));
  assert.equal(byId(tasks, 'first-week-service'), undefined);
  assert.equal(byId(tasks, 'forty-nine-service'), undefined);
});

test('every derived task has stable unique IDs and complete Japanese and English copy', () => {
  const tasks = deriveGuidanceTasks(plan({
    deathDate: '2026-09-01', rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no',
    firstWeekMeal: 'yes', fortyNineMeal: 'yes', tablet: 'yes', gifts: 'yes',
    burial: 'around49', engraving: 'yes', eyeOpening: 'yes', altar: 'yes', returnsDone: 'no',
  }));
  assert.equal(new Set(ids(tasks)).size, tasks.length);
  for (const task of tasks) {
    for (const value of [task.title.ja, task.title.en, task.description.ja, task.description.en, task.category.ja, task.category.en]) {
      assert.ok(value.trim().length > 0);
    }
  }
});

test('first-week guidance uses D+6 across leap-day and year boundaries', () => {
  for (const [deathDate, expected] of [['2024-02-25', '2024-03-02'], ['2026-12-28', '2027-01-03']]) {
    const tasks = deriveGuidanceTasks(plan({ deathDate, rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'yes', burial: 'none', returnsDone: 'notNeeded' }));
    assert.equal(byId(tasks, 'first-week-service').guidanceDate, expected);
  }
});

test('completed first-week answer is canonical and suppresses duplicate preparation', () => {
  const tasks = deriveGuidanceTasks(plan({ rituals: 'yes', firstWeekDone: 'yes', firstWeekMeal: 'yes', fortyNineDone: 'yes', burial: 'none', returnsDone: 'notNeeded' }));
  assert.equal(byId(tasks, 'first-week-service').done, true);
  assert.equal(byId(tasks, 'first-week-confirm'), undefined);
  assert.equal(byId(tasks, 'first-week-offerings'), undefined);
  assert.equal(byId(tasks, 'first-week-meal'), undefined);
});

test('first-week no and unknown expose optional candidates without treating unknown as done or unnecessary', () => {
  const no = deriveGuidanceTasks(plan({ rituals: 'yes', firstWeekDone: 'no', firstWeekMeal: 'no', fortyNineDone: 'yes', burial: 'none', returnsDone: 'notNeeded' }));
  assert.equal(byId(no, 'first-week-service').done, false);
  assert.equal(byId(no, 'first-week-service').needsConfirmation, false);
  assert.equal(byId(no, 'first-week-meal'), undefined);

  const unknown = deriveGuidanceTasks(plan({ rituals: 'yes', firstWeekDone: 'unknown', firstWeekMeal: 'unknown', fortyNineDone: 'yes', burial: 'none', returnsDone: 'notNeeded' }));
  assert.equal(byId(unknown, 'first-week-service').done, false);
  assert.equal(byId(unknown, 'first-week-service').needsConfirmation, true);
  assert.equal(byId(unknown, 'first-week-meal').needsConfirmation, true);
  assert.match(byId(unknown, 'first-week-service').description.ja, /7日目/);
  assert.match(byId(unknown, 'first-week-service').description.ja, /読経・焼香/);
  assert.match(byId(unknown, 'first-week-offerings').description.ja, /線香・ろうそく・果物・菓子/);
  assert.doesNotMatch(byId(unknown, 'first-week-service').description.ja, /D\+6/);
});

test('forty-nine guidance keeps D+48 separate from an earlier actual planned date', () => {
  const tasks = deriveGuidanceTasks(plan({
    deathDate: '2024-02-29', rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no',
    fortyNineDate: '2024-04-10', burial: 'none', returnsDone: 'notNeeded',
  }));
  const service = byId(tasks, 'forty-nine-service');
  assert.equal(service.guidanceDate, '2024-04-17');
  assert.equal(service.scheduledDate, '2024-04-10');
});

test('invalid or pre-death forty-nine dates never replace the guidance date', () => {
  for (const fortyNineDate of ['2026-02-29', '2026-08-31']) {
    const tasks = deriveGuidanceTasks(plan({
      deathDate: '2026-09-01', rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no',
      fortyNineDate, burial: 'none', returnsDone: 'notNeeded',
    }));
    const service = byId(tasks, 'forty-nine-service');
    assert.equal(service.guidanceDate, '2026-10-19');
    assert.equal(service.scheduledDate, null);
  }
});

test('forty-nine preparation and day-of tasks follow yes, no and unknown branches', () => {
  const done = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'yes', tablet: 'yes', altar: 'unknown',
    fortyNineMeal: 'yes', gifts: 'yes', eyeOpening: 'yes', burial: 'none', returnsDone: 'notNeeded',
  }));
  assert.equal(byId(done, 'forty-nine-service').done, true);
  assert.ok(byId(done, 'forty-nine-tablet-after'));
  assert.equal(byId(done, 'forty-nine-altar').needsConfirmation, true);
  for (const id of [
    'forty-nine-date', 'forty-nine-place', 'forty-nine-temple', 'forty-nine-attendees',
    'forty-nine-meal-arrangements', 'forty-nine-meal-day', 'forty-nine-gifts', 'forty-nine-eye-opening',
  ]) {
    assert.equal(byId(done, id), undefined);
  }

  const notDone = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no', tablet: 'no', altar: 'yes',
    fortyNineMeal: 'no', gifts: 'no', eyeOpening: 'no', burial: 'none', returnsDone: 'notNeeded',
  }));
  for (const id of ['forty-nine-tablet', 'forty-nine-meal-arrangements', 'forty-nine-meal-day', 'forty-nine-meal-confirm', 'forty-nine-gifts', 'forty-nine-eye-opening', 'forty-nine-altar']) {
    assert.equal(byId(notDone, id), undefined);
  }
  assert.deepEqual(
    ['forty-nine-date', 'forty-nine-place', 'forty-nine-temple', 'forty-nine-attendees']
      .map(id => byId(notDone, id)?.id),
    ['forty-nine-date', 'forty-nine-place', 'forty-nine-temple', 'forty-nine-attendees'],
  );
  assert.match(byId(notDone, 'forty-nine-service').description.ja, /49日目/);
  assert.match(byId(notDone, 'forty-nine-service').description.ja, /読経・焼香/);
  assert.doesNotMatch(byId(notDone, 'forty-nine-service').description.ja, /D\+48/);
  assert.equal(byId(notDone, 'forty-nine-offering').title.ja, 'お布施等を準備・渡す');
  assert.match(byId(notDone, 'forty-nine-offering').description.ja, /御車代・御膳料/);

  const unknown = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'unknown', tablet: 'unknown',
    fortyNineMeal: 'unknown', gifts: 'unknown', eyeOpening: 'unknown', burial: 'none', returnsDone: 'notNeeded',
  }));
  for (const id of ['forty-nine-service', 'forty-nine-tablet', 'forty-nine-gifts', 'forty-nine-eye-opening']) {
    assert.equal(byId(unknown, id).needsConfirmation, true);
  }
  assert.equal(byId(unknown, 'forty-nine-meal-confirm').needsConfirmation, true);
  assert.equal(byId(unknown, 'forty-nine-meal-arrangements'), undefined);
  assert.equal(byId(unknown, 'forty-nine-meal-day'), undefined);

  const plannedMeal = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no', tablet: 'yes',
    fortyNineMeal: 'yes', gifts: 'yes', eyeOpening: 'yes', burial: 'none', returnsDone: 'notNeeded',
  }));
  assert.deepEqual(plannedMeal.filter(task => task.group === 'forty-nine').map(task => task.id), [
    'forty-nine-date',
    'forty-nine-place',
    'forty-nine-temple',
    'forty-nine-attendees',
    'forty-nine-tablet',
    'forty-nine-meal-arrangements',
    'forty-nine-gifts',
    'forty-nine-service',
    'forty-nine-offering',
    'forty-nine-meal-day',
    'forty-nine-eye-opening',
  ]);
  assert.equal(byId(plannedMeal, 'forty-nine-eye-opening').title.ja, '開眼供養等を行う');
});

test('ritual opt-out hides first-week and forty-nine tasks but never hides independent layers', () => {
  const tasks = deriveGuidanceTasks(plan({
    tradition: 'buddhist', rituals: 'no', firstWeekDone: 'no', fortyNineDone: 'no',
    burial: 'around49', engraving: 'unknown', returnsDone: 'no',
  }));
  assert.equal(tasks.some(task => task.group === 'first-week' || task.group === 'forty-nine'), false);
  assert.ok(byId(tasks, 'burial-service'));
  assert.ok(byId(tasks, 'condolence-returns'));
  assert.ok(byId(tasks, 'belongings-check'));
});

test('tradition alone neither requires nor suppresses explicitly selected ritual guidance', () => {
  const tasks = deriveGuidanceTasks(plan({
    tradition: 'other', rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no',
    burial: 'none', returnsDone: 'notNeeded',
  }));
  assert.ok(byId(tasks, 'first-week-service'));
  assert.ok(byId(tasks, 'forty-nine-service'));
});

test('not needed hides only the selected service while independent guidance remains', () => {
  const withoutFirstWeek = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'notNeeded', fortyNineDone: 'no',
    burial: 'around49', returnsDone: 'no',
  }));
  assert.equal(withoutFirstWeek.some(task => task.group === 'first-week'), false);
  assert.ok(byId(withoutFirstWeek, 'forty-nine-service'));
  assert.ok(byId(withoutFirstWeek, 'burial-service'));
  assert.ok(byId(withoutFirstWeek, 'condolence-returns'));
  assert.ok(byId(withoutFirstWeek, 'belongings-check'));

  const withoutFortyNine = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'notNeeded',
    burial: 'later', returnsDone: 'no',
  }));
  assert.ok(byId(withoutFortyNine, 'first-week-service'));
  assert.equal(withoutFortyNine.some(task => task.group === 'forty-nine'), false);
  assert.ok(byId(withoutFortyNine, 'burial-plan'));
  assert.ok(byId(withoutFortyNine, 'condolence-returns'));
  assert.ok(byId(withoutFortyNine, 'belongings-check'));
});

test('burial branches stay separate from the forty-nine planned date and from religion', () => {
  const around = deriveGuidanceTasks(plan({
    deathDate: '2026-09-01', tradition: 'other', rituals: 'no', fortyNineDate: '2026-10-10',
    burial: 'around49', engraving: 'unknown', returnsDone: 'notNeeded',
  }));
  assert.equal(byId(around, 'burial-service').guidanceDate, '2026-10-19');
  assert.equal(byId(around, 'burial-service').scheduledDate, null);
  assert.ok(byId(around, 'burial-contact'));
  assert.equal(byId(around, 'burial-engraving').needsConfirmation, true);

  const later = deriveGuidanceTasks(plan({ rituals: 'no', burial: 'later', returnsDone: 'notNeeded' }));
  assert.deepEqual(later.filter(task => task.group === 'burial').map(task => task.id), ['burial-plan']);
  assert.equal(byId(later, 'burial-plan').needsConfirmation, false);

  const unknown = deriveGuidanceTasks(plan({ rituals: 'no', burial: 'unknown', returnsDone: 'notNeeded' }));
  assert.equal(byId(unknown, 'burial-plan').needsConfirmation, true);

  const done = deriveGuidanceTasks(plan({ rituals: 'no', burial: 'done', returnsDone: 'notNeeded' }));
  assert.equal(byId(done, 'burial-service').done, true);

  const none = deriveGuidanceTasks(plan({ rituals: 'no', burial: 'none', returnsDone: 'notNeeded' }));
  assert.equal(none.some(task => task.group === 'burial'), false);
});

test('condolence-return branches distinguish complete, open, unknown and not needed', () => {
  const expected = {
    yes: { present: true, done: true, confirm: false },
    no: { present: true, done: false, confirm: false },
    unknown: { present: true, done: false, confirm: true },
    notNeeded: { present: false },
  };
  for (const [returnsDone, result] of Object.entries(expected)) {
    const tasks = deriveGuidanceTasks(plan({ rituals: 'no', burial: 'none', returnsDone }));
    const item = byId(tasks, 'condolence-returns');
    assert.equal(Boolean(item), result.present);
    if (item) {
      assert.equal(item.done, result.done);
      assert.equal(item.needsConfirmation, result.confirm);
      if (returnsDone === 'no') {
        assert.match(item.description.ja, /忌明け/);
        assert.match(item.description.ja, /挨拶状/);
        assert.doesNotMatch(item.description.ja, /台帳/);
      }
    }
  }
});

test('belongings warning remains present across ritual and tradition choices', () => {
  for (const changes of [
    { tradition: 'buddhist', rituals: 'yes' },
    { tradition: 'other', rituals: 'no' },
    { tradition: 'unknown', rituals: 'unknown' },
  ]) {
    const item = byId(deriveGuidanceTasks(plan({ ...changes, burial: 'none', returnsDone: 'notNeeded' })), 'belongings-check');
    assert.ok(item);
    assert.match(item.description.ja, /売却・譲渡・廃棄/);
    assert.match(item.description.en, /selling, transferring or disposing/);
  }
});

test('progress updates ordinary tasks but plan-backed completion remains canonical', () => {
  const derived = deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no', burial: 'done', returnsDone: 'no',
  }));
  const updated = applyTaskProgress(derived, {
    'receive-medical-certificate': { done: true, assignee: 'self' },
    'first-week-service': { done: false, assignee: 'family-a' },
    'forty-nine-service': { done: true, assignee: 'family-b' },
    'burial-service': { done: false, assignee: null },
    'condolence-returns': { done: true, assignee: 'self' },
  });
  assert.equal(byId(updated, 'receive-medical-certificate').done, true);
  assert.equal(byId(updated, 'receive-medical-certificate').assignee, 'self');
  assert.equal(byId(updated, 'first-week-service').done, true);
  assert.equal(byId(updated, 'first-week-service').assignee, 'family-a');
  assert.equal(byId(updated, 'forty-nine-service').done, false);
  assert.equal(byId(updated, 'forty-nine-service').assignee, 'family-b');
  assert.equal(byId(updated, 'burial-service').done, true);
  assert.equal(byId(updated, 'burial-service').assignee, null);
  assert.equal(byId(updated, 'condolence-returns').done, false);
  assert.equal(byId(updated, 'condolence-returns').assignee, 'self');
  assert.equal(byId(derived, 'receive-medical-certificate').done, false);
});

test('separate forty-nine preparation progress survives hiding and restores by stable ID', () => {
  const progress = {
    'forty-nine-date': { done: true, assignee: 'self' },
    'forty-nine-place': { done: true, assignee: 'family-a' },
    'forty-nine-temple': { done: false, assignee: 'family-b' },
    'forty-nine-attendees': { done: true, assignee: 'family-c' },
  };
  const visible = applyTaskProgress(deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no', burial: 'none', returnsDone: 'notNeeded',
  })), progress);
  for (const [id, saved] of Object.entries(progress)) {
    assert.equal(byId(visible, id).done, saved.done);
    assert.equal(byId(visible, id).assignee, saved.assignee);
  }

  const hidden = applyTaskProgress(deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'yes', burial: 'none', returnsDone: 'notNeeded',
  })), progress);
  for (const id of Object.keys(progress)) assert.equal(byId(hidden, id), undefined);

  const restored = applyTaskProgress(deriveGuidanceTasks(plan({
    rituals: 'yes', firstWeekDone: 'yes', fortyNineDone: 'no', burial: 'none', returnsDone: 'notNeeded',
  })), progress);
  for (const [id, saved] of Object.entries(progress)) {
    assert.equal(byId(restored, id).done, saved.done);
    assert.equal(byId(restored, id).assignee, saved.assignee);
  }
});

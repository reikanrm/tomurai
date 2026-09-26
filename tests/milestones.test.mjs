import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import { allTasksMilestoneNote, milestoneMessages, selectMilestone } from '../apps/mobile/src/domain/milestones.ts';

const context = (overrides = {}) => ({
  today: '2026-09-26', plan: { ...defaultPlan, deathDate: '2026-09-20', rituals: 'yes' },
  eventDates: {}, allTasksDone: false, dismissed: [], ...overrides,
});
const at = (today, patch = {}, extra = {}) => context({ today,
  plan: { ...defaultPlan, deathDate: '2026-09-20', rituals: 'yes', ...patch }, ...extra });

test('all nine Japanese milestone bodies exactly match their SSOT rows', () => {
  const source = readFileSync(new URL('../docs/ssot/bereavement-guidance.md', import.meta.url), 'utf8');
  const rows = source.split(/\r?\n/).filter(row => /^\| (funeral|first-week|burial|thanks|forty-nine|three-months|six-months|before-year|all-tasks) \|/.test(row));
  assert.equal(rows.length, 9);
  assert.equal(Object.keys(milestoneMessages).length, 9);
  for (const row of rows) {
    const [, id, , body] = row.split('|').map(cell => cell.trim());
    assert.equal(milestoneMessages[id].body.ja, body);
    assert.ok(milestoneMessages[id].body.en);
    assert.ok(milestoneMessages[id].title.ja);
    assert.ok(milestoneMessages[id].title.en);
    assert.equal(milestoneMessages[id].id, id);
  }
});

test('first-week window is D+6 through D+12 inclusive; old windows do not replay', () => {
  for (const day of ['2026-09-26', '2026-10-02']) assert.equal(selectMilestone(at(day))?.id, 'first-week');
  for (const day of ['2026-09-25', '2026-10-03', '2027-12-25']) assert.equal(selectMilestone(at(day)), null);
});

test('forty-nine uses the actual scheduled date without overwriting D+48', () => {
  assert.equal(selectMilestone(at('2026-11-07'))?.id, 'forty-nine');
  assert.equal(selectMilestone(at('2026-11-13'))?.id, 'forty-nine');
  assert.equal(selectMilestone(at('2026-11-14')), null);
  const plan = { fortyNineDate: '2026-10-31' };
  assert.equal(selectMilestone(at('2026-10-31', plan))?.id, 'forty-nine');
  assert.equal(selectMilestone(at('2026-11-06', plan))?.id, 'forty-nine');
  assert.equal(selectMilestone(at('2026-11-07', plan)), null);
  assert.equal(selectMilestone(at('2026-10-31', { deathDate: '', ...plan }))?.id, 'forty-nine');
});

test('ritual no/unknown hides both ritual milestones, but not secular milestones', () => {
  for (const rituals of ['no', 'unknown']) {
    assert.equal(selectMilestone(at('2026-09-26', { rituals })), null);
    assert.equal(selectMilestone(at('2026-11-07', { rituals })), null);
    assert.equal(selectMilestone(at('2026-12-20', { rituals }))?.id, 'three-months');
  }
  assert.equal(selectMilestone(at('2026-09-26', { firstWeekDone: 'notNeeded' })), null);
  assert.equal(selectMilestone(at('2026-11-07', { fortyNineDone: 'notNeeded' })), null);
  assert.equal(selectMilestone(at('2026-11-07', { firstWeekDone: 'notNeeded' }))?.id, 'forty-nine');
});

test('three and six months use calendar months, with month-end and year rollover', () => {
  const plan = { deathDate: '2025-11-30', rituals: 'no' };
  assert.equal(selectMilestone(at('2026-02-28', plan))?.id, 'three-months');
  assert.equal(selectMilestone(at('2026-03-06', plan))?.id, 'three-months');
  assert.equal(selectMilestone(at('2026-03-07', plan)), null);
  assert.equal(selectMilestone(at('2026-05-30', plan))?.id, 'six-months');
  assert.equal(selectMilestone(at('2026-06-05', plan))?.id, 'six-months');
  assert.equal(selectMilestone(at('2026-06-06', plan)), null);
  assert.equal(selectMilestone(at('2024-02-29', { deathDate: '2023-11-30', rituals: 'no' }))?.id, 'three-months');
});

test('before-year spans only 30 days before the clamped calendar anniversary', () => {
  const plan = { deathDate: '2024-02-29', rituals: 'no' };
  assert.equal(selectMilestone(at('2025-01-28', plan)), null);
  assert.equal(selectMilestone(at('2025-01-29', plan))?.id, 'before-year');
  assert.equal(selectMilestone(at('2025-02-27', plan))?.id, 'before-year');
  assert.equal(selectMilestone(at('2025-02-28', plan)), null);
});

test('events need both confirmed completion and a recent confirmation date', () => {
  for (const [id, patch] of [['funeral', { funeralDone: 'yes' }], ['burial', { burial: 'done' }], ['thanks', { returnsDone: 'yes' }]]) {
    const plan = { ...patch, rituals: 'no' };
    assert.equal(selectMilestone(at('2026-09-26', plan)), null);
    for (const day of ['2026-09-26', '2026-10-02']) {
      assert.equal(selectMilestone(at(day, plan, { eventDates: { [id]: '2026-09-26' } }))?.id, id);
    }
    assert.equal(selectMilestone(at('2026-10-03', plan, { eventDates: { [id]: '2026-09-26' } })), null);
    assert.equal(selectMilestone(at('2026-09-25', plan, { eventDates: { [id]: '2026-09-26' } })), null);
    assert.equal(selectMilestone(at('2026-09-26', { rituals: 'no' }, { eventDates: { [id]: '2026-09-26' } })), null);
  }
});

test('all tasks needs the root nonempty/fully-confirmed predicate and event window', () => {
  const extra = { eventDates: { 'all-tasks': '2026-09-26' }, allTasksDone: true };
  assert.equal(selectMilestone(at('2026-09-26', { rituals: 'no' }, extra))?.id, 'all-tasks');
  assert.equal(selectMilestone(at('2026-10-03', { rituals: 'no' }, extra)), null);
  assert.equal(selectMilestone(at('2026-09-26', { rituals: 'no' }, { ...extra, allTasksDone: false })), null);
  assert.equal(selectMilestone(at('2026-09-26', { rituals: 'no' }, { allTasksDone: true })), null);
});

test('all-tasks card carries the SSOT legal-completion qualification', () => {
  const specification = readFileSync(new URL('../docs/ssot/bereavement-guidance.md', import.meta.url), 'utf8');
  assert.equal(allTasksMilestoneNote.ja, '登録した対象タスクの区切りであり、すべての法的手続きの完了を保証しない');
  assert.ok(specification.includes(`「${allTasksMilestoneNote.ja}」`));
  assert.ok(allTasksMilestoneNote.en);
  const component = readFileSync(new URL('../apps/mobile/src/components/MilestoneSection.tsx', import.meta.url), 'utf8');
  assert.match(component, /milestone\.id === 'all-tasks' && <Text[^>]*>\{allTasksMilestoneNote\[locale\]\}/);
  assert.match(component, /onPress=\{\(\) => onDismiss\(milestone\.id\)\}/);
});

test('only one message is selected; date milestones precede completion events', () => {
  const extra = { eventDates: { funeral: '2026-09-26', burial: '2026-09-26', thanks: '2026-09-26' } };
  const plan = { funeralDone: 'yes', burial: 'done', returnsDone: 'yes' };
  assert.equal(selectMilestone(at('2026-09-26', plan, extra))?.id, 'first-week');
  assert.equal(selectMilestone(at('2026-09-26', plan, { ...extra, dismissed: ['first-week'] }))?.id, 'funeral');
  assert.equal(selectMilestone(at('2026-09-26', plan, { ...extra, dismissed: ['first-week', 'funeral'] }))?.id, 'burial');
});

test('off and dismissed messages stay hidden after answers change; no input mutation', () => {
  assert.equal(selectMilestone(at('2026-09-26', { showMessages: false })), null);
  const ctx = at('2026-09-26', {}, { dismissed: ['first-week'] });
  const before = structuredClone(ctx);
  assert.equal(selectMilestone(ctx), null);
  assert.deepEqual(ctx, before);
  assert.equal(selectMilestone(at('2026-10-02', { deathDate: '2026-09-26' }, { dismissed: ['first-week'] })), null);
});

test('missing and invalid dates never fabricate a date milestone or event', () => {
  for (const deathDate of ['', 'unknown', '2026-02-30', '2026-09-27']) {
    assert.equal(selectMilestone(at('2026-09-26', { deathDate })), null);
  }
  assert.equal(selectMilestone(at('not-a-date')), null);
  assert.equal(selectMilestone(at('2026-09-26', { rituals: 'no', funeralDone: 'yes' }, { eventDates: { funeral: '2026-02-30' } })), null);
});

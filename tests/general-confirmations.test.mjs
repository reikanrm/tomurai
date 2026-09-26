import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveGeneralConfirmationTasks } from '../apps/mobile/src/domain/general-confirmations.ts';

const binary = ['setainushi', 'nenkin', 'fudousan', 'jidousha', 'jigyounushi', 'seimeihoken'];
const all = { ...Object.fromEntries(binary.map(id => [id, 'yes'])), kenpo: 'kokuho', souzokunin: 'multiple' };

test('all eight answers produce only bilingual confirmation candidates with no deadlines or fabricated state', () => {
  const tasks = deriveGeneralConfirmationTasks(all);
  assert.equal(tasks.length, 8);
  assert.equal(new Set(tasks.map(task => task.id)).size, 8);
  for (const task of tasks) {
    assert.ok(task.title.ja && task.title.en && task.description.ja && task.description.en);
    assert.equal(task.group, 'general');
    assert.equal(task.done, false);
    assert.equal(task.notNeeded, false);
    assert.equal(task.assignee, null);
    assert.equal(task.needsConfirmation, true);
    assert.equal(task.guidanceDate, null);
    assert.equal(task.scheduledDate, null);
    assert.doesNotMatch(JSON.stringify(task), /以内|必須|must submit|within \d/);
  }
});

test('unknown produces applicability checks, no excludes candidates, and unanswered does not assume unknown', () => {
  assert.deepEqual(deriveGeneralConfirmationTasks({}), []);
  assert.deepEqual(deriveGeneralConfirmationTasks(Object.fromEntries(binary.map(id => [id, 'no']))), []);
  for (const id of Object.keys(all)) {
    const known = deriveGeneralConfirmationTasks({ [id]: all[id] })[0];
    const unknown = deriveGeneralConfirmationTasks({ [id]: 'unknown' })[0];
    assert.ok(known && unknown, id);
    assert.equal(known.id, unknown.id);
    assert.notEqual(known.title.ja, unknown.title.ja);
    assert.equal(deriveGeneralConfirmationTasks({ [id]: 'invalid' }).length, 0);
  }
});

test('insurance choices select their respective general contact, and sole heirs still get a confirmation', () => {
  for (const [kenpo, contact] of [['kokuho', '市区町村'], ['koki', '広域連合'], ['shakaihoken', '勤務先']]) {
    const task = deriveGeneralConfirmationTasks({ kenpo })[0];
    assert.equal(task.id, 'confirm-health-insurance');
    assert.ok(task.description.ja.includes(contact));
  }
  const single = deriveGeneralConfirmationTasks({ souzokunin: 'single' })[0];
  const multiple = deriveGeneralConfirmationTasks({ souzokunin: 'multiple' })[0];
  assert.equal(single.id, multiple.id);
  assert.match(single.description.ja, /単独相続を確定しません/);
  assert.notEqual(single.description.ja, multiple.description.ja);
});

test('generation is deterministic and does not mutate answers or include the existing four baseline tasks', () => {
  const frozen = Object.freeze({ ...all });
  assert.deepEqual(deriveGeneralConfirmationTasks(frozen), deriveGeneralConfirmationTasks(frozen));
  const ids = deriveGeneralConfirmationTasks(frozen).map(task => task.id);
  for (const baseline of ['receive-medical-certificate', 'confirm-death-registration', 'confirm-bank-inheritance', 'review-service-contracts']) {
    assert.equal(ids.includes(baseline), false);
  }
});

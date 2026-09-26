import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditAnswers, defaultAccess, freezeFreeTaskIds, lockAction, resolveAccess, selectTaskAccess } from '../apps/mobile/src/domain/access.ts';

const access = changes => ({ ...defaultAccess, ...changes });
const task = (id, changes = {}) => ({
  id, title: { ja: `合成タスク ${id}`, en: `Synthetic task ${id}` },
  description: { ja: `合成説明 ${id}`, en: `Synthetic description ${id}` },
  category: { ja: '確認', en: 'Check' }, group: 'general', done: false, assignee: null,
  optional: false, needsConfirmation: false, guidanceDate: null, scheduledDate: null,
  ...changes,
});
const tasks = [task('a'), task('b'), task('c'), task('d')];
const ids = result => result.visibleTasks.map(item => item.id);

test('production ignores development overrides and preserves the free synthetic default', () => {
  const preview = access({ membership: 'pending', isRespondent: false, canManageBilling: false, entitlement: 'corporate', activeMemberCount: 100 });
  assert.deepEqual(resolveAccess(preview, false), {
    membership: 'active', canManageBilling: true, isRespondent: true, entitlement: 'free', activeMemberCount: 1,
  });
  assert.deepEqual(resolveAccess(preview, true), preview);
  assert.equal(Object.isFrozen(defaultAccess), true);
  assert.deepEqual(ids(selectTaskAccess(tasks, resolveAccess(preview, false), ['a', 'b'])), ['a', 'b']);
});

test('answer ownership and billing permission remain independent for approved members', () => {
  for (const isRespondent of [false, true]) {
    for (const canManageBilling of [false, true]) {
      const current = access({ isRespondent, canManageBilling });
      assert.equal(canEditAnswers(current), isRespondent);
      assert.equal(lockAction(current), canManageBilling ? 'checkout' : 'request');
    }
  }
});

test('pending members cannot edit answers, request an upgrade, checkout or view family tasks', () => {
  for (const entitlement of ['free', 'beta', 'b2c_solo', 'b2c_family', 'corporate', 'expired']) {
    const pending = access({ membership: 'pending', entitlement });
    assert.equal(canEditAnswers(pending), false);
    assert.equal(lockAction(pending), null);
    assert.deepEqual(selectTaskAccess(tasks, pending, ['a', 'b']), { visibleTasks: [], hasLocked: false, fullAccess: false });
  }
});

test('the current billing permission determines the CTA after a payer handoff', () => {
  const invitedRespondent = access({ canManageBilling: false, isRespondent: true });
  assert.equal(lockAction(invitedRespondent), 'request');
  assert.equal(lockAction({ ...invitedRespondent, canManageBilling: true }), 'checkout');
  assert.equal(canEditAnswers({ ...invitedRespondent, canManageBilling: true }), true);
});

test('free selection orders by scheduled date in preference to guide date, then ID', () => {
  const input = [
    task('z'), task('scheduled', { scheduledDate: '2026-11-01', guidanceDate: '2026-09-01' }),
    task('b', { guidanceDate: '2026-10-01' }), task('a', { guidanceDate: '2026-10-01' }),
  ];
  const before = structuredClone(input);
  assert.deepEqual(freezeFreeTaskIds(input, null), ['a', 'b']);
  assert.deepEqual(freezeFreeTaskIds([...input].reverse(), null), ['a', 'b']);
  assert.deepEqual(freezeFreeTaskIds([input[0], input[1]], null), ['scheduled', 'z']);
  assert.deepEqual(input, before);
});

test('a frozen selection never refills after completion, reassignment, reordering or date edits', () => {
  const fixed = freezeFreeTaskIds(tasks, null);
  const changed = [
    task('d', { scheduledDate: '2026-01-01', assignee: 'self' }), task('c', { guidanceDate: '2026-01-02' }),
    task('b', { done: true, assignee: 'family-a' }), task('a', { done: true, scheduledDate: '2027-01-01' }),
  ];
  assert.deepEqual(freezeFreeTaskIds(changed, fixed), ['a', 'b']);
  const projection = selectTaskAccess(changed, defaultAccess, fixed);
  assert.deepEqual(ids(projection), ['b', 'a']);
  assert.equal(projection.visibleTasks.filter(item => !item.done).length, 0);
  assert.equal(projection.visibleTasks.filter(item => item.assignee === 'self').length, 0);
  assert.equal(projection.hasLocked, true);
});

test('a removed fixed task is not replaced, and restoring it restores access', () => {
  const fixed = freezeFreeTaskIds(tasks, null);
  const fewer = tasks.filter(item => item.id !== 'a');
  assert.deepEqual(freezeFreeTaskIds(fewer, fixed), ['a', 'b']);
  assert.deepEqual(ids(selectTaskAccess(fewer, defaultAccess, fixed)), ['b']);
  assert.deepEqual(ids(selectTaskAccess(tasks, defaultAccess, fixed)), ['a', 'b']);
});

test('empty and one-item selections are final, and IDs are unique and capped at two', () => {
  const empty = freezeFreeTaskIds([], null);
  assert.deepEqual(empty, []);
  assert.deepEqual(freezeFreeTaskIds(tasks, empty), []);
  assert.deepEqual(freezeFreeTaskIds(tasks, ['a']), ['a']);
  assert.deepEqual(freezeFreeTaskIds([task('a'), task('a'), task('b'), task('c')], null), ['a', 'b']);
  assert.deepEqual(freezeFreeTaskIds(tasks, ['a', 'a', 'b', 'c']), ['a', 'b']);
  assert.equal(Object.isFrozen(empty), true);
  assert.deepEqual(ids(selectTaskAccess(tasks, defaultAccess, ['a', 'b', 'c'])), ['a', 'b']);
});

test('free and expired groups have only their original fixed task IDs', () => {
  for (const entitlement of ['free', 'expired']) {
    const result = selectTaskAccess(tasks, access({ entitlement }), ['a', 'b']);
    assert.deepEqual(ids(result), ['a', 'b']);
    assert.equal(result.hasLocked, true);
    assert.equal(result.fullAccess, false);
  }
});

test('approved family, corporate and beta groups have full task access without a member cap', () => {
  for (const entitlement of ['b2c_family', 'corporate', 'beta']) {
    for (const activeMemberCount of [1, 2, 3, 10, 100]) {
      const result = selectTaskAccess(tasks, access({ entitlement, activeMemberCount, canManageBilling: false, isRespondent: false }), ['a', 'b']);
      assert.deepEqual(ids(result), ['a', 'b', 'c', 'd']);
      assert.equal(result.fullAccess, true);
      assert.equal(result.hasLocked, false);
    }
  }
});

test('solo entitlement unlocks only an exactly one-member approved group', () => {
  assert.equal(selectTaskAccess(tasks, access({ entitlement: 'b2c_solo' }), ['a', 'b']).fullAccess, true);
  for (const activeMemberCount of [0, -1, 1.5, 2, 3, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = selectTaskAccess(tasks, access({ entitlement: 'b2c_solo', activeMemberCount }), ['a', 'b']);
    assert.deepEqual(ids(result), ['a', 'b']);
    assert.equal(result.fullAccess, false);
    assert.equal(result.hasLocked, true);
  }
});

test('paid-to-free and role switches retain the exact original selection', () => {
  const fixed = freezeFreeTaskIds(tasks, null);
  assert.equal(selectTaskAccess(tasks, access({ entitlement: 'b2c_family' }), fixed).visibleTasks.length, 4);
  for (const current of [defaultAccess, access({ canManageBilling: false }), access({ isRespondent: false }), access({ entitlement: 'expired' })]) {
    assert.deepEqual(ids(selectTaskAccess(tasks, current, freezeFreeTaskIds(tasks, fixed))), ['a', 'b']);
  }
});

test('empty or wholly accessible lists have no fabricated locked section', () => {
  assert.deepEqual(selectTaskAccess([], defaultAccess, []), { visibleTasks: [], hasLocked: false, fullAccess: false });
  assert.equal(selectTaskAccess(tasks.slice(0, 2), defaultAccess, ['a', 'b']).hasLocked, false);
  assert.deepEqual(selectTaskAccess(tasks, defaultAccess, []), { visibleTasks: [], hasLocked: true, fullAccess: false });
});

test('locked projection has no titles, dates, assignees, counts or statuses from hidden tasks', () => {
  const visible = task('a');
  const hidden = task('secret-id', {
    title: { ja: '非公開合成タイトル', en: 'Private synthetic title' },
    description: { ja: '非公開合成説明', en: 'Private synthetic description' },
    scheduledDate: '2037-07-17', assignee: 'private-assignee', done: true,
  });
  const result = selectTaskAccess([visible, hidden], defaultAccess, ['a']);
  assert.deepEqual(Object.keys(result).sort(), ['fullAccess', 'hasLocked', 'visibleTasks']);
  const serialized = JSON.stringify(result);
  for (const secret of ['secret-id', '非公開合成タイトル', 'Private synthetic title', 'Private synthetic description', '2037-07-17', 'private-assignee']) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.deepEqual(result, selectTaskAccess([visible, { ...hidden, assignee: null, done: false }], defaultAccess, ['a']));
});

test('selectors do not mutate tasks, access or fixed IDs, including frozen inputs', () => {
  const input = Object.freeze(tasks.map(item => Object.freeze({ ...item })));
  const current = Object.freeze(access({ entitlement: 'b2c_family' }));
  const fixed = Object.freeze(['a', 'b']);
  const before = structuredClone({ input, current, fixed });
  selectTaskAccess(input, current, fixed);
  selectTaskAccess(input, defaultAccess, fixed);
  freezeFreeTaskIds(input, fixed);
  freezeFreeTaskIds(input, null);
  assert.deepEqual({ input, current, fixed }, before);
});

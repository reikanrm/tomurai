import test from 'node:test';
import assert from 'node:assert/strict';
import { assigneeInitial, demoTasks, members } from '../apps/mobile/src/data/demo.ts';

test('synthetic family members retain stable, unique IDs', () => {
  assert.deepEqual(members.map(member => member.id), ['self', 'family-a', 'family-b']);
  assert.equal(new Set(members.map(member => member.id)).size, members.length);
  for (const task of demoTasks) {
    assert.ok(task.assignee === null || members.some(member => member.id === task.assignee));
  }
});

test('assignee avatars distinguish self, A and B in both languages', () => {
  const expected = {
    ja: ['自', 'A', 'B'],
    en: ['Me', 'A', 'B'],
  };
  for (const locale of ['ja', 'en']) {
    const initials = members.map(member => assigneeInitial(member.id, locale));
    assert.deepEqual(initials, expected[locale]);
    assert.equal(new Set(initials).size, members.length);
    for (const member of members) assert.ok(member.name[locale].trim().length > 0);
  }
});

test('unassigned and unknown assignees have a neutral fallback', () => {
  for (const locale of ['ja', 'en']) {
    for (const id of [null, '', 'missing-member', '__proto__']) {
      assert.equal(assigneeInitial(id, locale), '—');
    }
  }
});

test('initial lookup reflects the current assignee and language without retaining a previous value', () => {
  const before = structuredClone(members);
  assert.equal(assigneeInitial('family-a', 'ja'), 'A');
  assert.equal(assigneeInitial('family-b', 'ja'), 'B');
  assert.equal(assigneeInitial('self', 'en'), 'Me');
  assert.equal(assigneeInitial('self', 'ja'), '自');
  assert.equal(assigneeInitial(null, 'ja'), '—');
  assert.deepEqual(members, before);
});

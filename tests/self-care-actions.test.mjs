import test from 'node:test';
import assert from 'node:assert/strict';
import * as care from '../apps/mobile/src/data/care.ts';

test('self-care offers three optional bilingual actions independently of moods', () => {
  assert.ok(Array.isArray(care.selfCareActions));
  assert.equal(care.selfCareActions.length, 3);
  assert.equal(new Set(care.selfCareActions.map(action => action.id)).size, 3);
  for (const action of care.selfCareActions) {
    for (const locale of ['ja', 'en']) {
      assert.ok(action.title[locale]);
      assert.ok(action.body[locale]);
      assert.doesNotMatch(action.body[locale], /頑張|元気を出|回復します|治ります|you must|will recover/i);
    }
    assert.equal(care.toggleSelfCareAction(null, action.id), action.id);
    assert.equal(care.toggleSelfCareAction(action.id, action.id), null);
  }
  assert.equal(care.toggleSelfCareAction('water', 'rest'), 'rest');
});

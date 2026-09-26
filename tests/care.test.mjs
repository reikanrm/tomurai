import assert from 'node:assert/strict';
import test from 'node:test';
import { careMoods, toggleCareMood } from '../apps/mobile/src/data/care.ts';

test('moods have stable unique IDs and labels in both languages', () => {
  assert.equal(careMoods.length, 5);
  assert.equal(new Set(careMoods.map(mood => mood.id)).size, careMoods.length);
  for (const mood of careMoods) {
    assert.ok(mood.label.ja);
    assert.ok(mood.label.en);
    assert.ok(mood.icon);
    assert.notEqual(mood.id, mood.label.ja);
    assert.notEqual(mood.id, mood.label.en);
  }
});

test('mood choice is optional, replaceable, and can be cleared', () => {
  for (const mood of careMoods) {
    assert.equal(toggleCareMood(null, mood.id), mood.id);
    assert.equal(toggleCareMood(mood.id, mood.id), null);
  }
  assert.equal(toggleCareMood('calm', 'tearful'), 'tearful');
});

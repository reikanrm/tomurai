import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationIcons } from '../apps/mobile/src/data/navigation.ts';

test('bottom navigation uses the PO Claude mock symbols without substitutions', () => {
  assert.equal(navigationIcons.specialists, '\u2696');
  assert.equal(navigationIcons.care, '\u{1F54A}');
  assert.deepEqual(Object.keys(navigationIcons), ['home', 'tasks', 'specialists', 'care']);
});

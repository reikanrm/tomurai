import test from 'node:test';
import assert from 'node:assert/strict';
import { progressValue, revealSector, isValidPastDate } from '../apps/mobile/src/domain/progress.ts';

test('progress tracks actual completed work and supports going back', () => {
  assert.equal(progressValue(0, 10).ratio, 0);
  assert.equal(progressValue(3, 10).ratio, .3);
  assert.equal(progressValue(2, 10).ratio, .2);
  assert.equal(progressValue(10, 10).ratio, 1);
});
test('zero denominator, out-of-bounds and nonfinite values stay safe', () => {
  assert.equal(progressValue(10, 0).ratio, 0);
  assert.equal(progressValue(12, 10).completed, 10);
  assert.equal(progressValue(-1, 10).completed, 0);
  assert.equal(progressValue(NaN, Infinity).ratio, 0);
});
test('SVG reveal remains finite for all supported progress', () => {
  for (const value of [0, .1, .5, 1, -1, 2, NaN, Infinity]) {
    const path = revealSector(value);
    assert.ok(!path.includes('NaN') && !path.includes('Infinity'));
  }
  assert.notEqual(revealSector(0), revealSector(1));
});
test('date rejects rollover, future date and malformed date without deriving a legal deadline', () => {
  assert.equal(isValidPastDate('2024-02-29', '2026-09-26'), true);
  for (const input of ['2025-02-29', '2026-09-27', '2026-2-1', 'unknown', '']) {
    assert.equal(isValidPastDate(input, '2026-09-26'), false);
  }
});

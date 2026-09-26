import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, validDate, todayInJapan, inWindow, daysBetween } from '../apps/mobile/src/domain/calendar.ts';
test('date-only rites count death as day 1, across leap/year boundaries', () => {
  assert.equal(addDays('2026-09-01', 6), '2026-09-07');
  assert.equal(addDays('2026-09-01', 48), '2026-10-19');
  assert.equal(addDays('2024-02-25', 6), '2024-03-02');
  assert.equal(addDays('2026-12-29', 6), '2027-01-04');
  assert.equal(addDays('2026-02-30', 6), null);
  assert.equal(addDays('', 48), null);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
});
test('calendar months clamp, not fixed 90-day or 180-day intervals', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addMonths('2026-08-31', 3), '2026-11-30');
});
test('Japan midnight and windows are deterministic regardless of device timezone', () => {
  assert.equal(todayInJapan(new Date('2026-09-25T15:00:00Z')), '2026-09-26');
  assert.equal(todayInJapan(new Date('2026-09-25T14:59:59Z')), '2026-09-25');
  assert.equal(inWindow('2026-09-13', '2026-09-07'), true);
  assert.equal(inWindow('2026-09-14', '2026-09-07'), false);
  assert.equal(inWindow('2026-09-06', '2026-09-07'), false);
  assert.equal(daysBetween('', '2026-09-26'), null);
});

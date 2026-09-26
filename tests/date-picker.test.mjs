import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthStart, shiftMonth, monthCells, dateSelectable, monthSelectable,
  initialMonth, formatCalendarDate, monthTitle,
} from '../apps/mobile/src/domain/date-picker.ts';

test('month anchors validate actual four-digit dates including ISO year zero', () => {
  assert.equal(monthStart('2024-02-29'), '2024-02-01');
  assert.equal(monthStart('0000-02-29'), '0000-02-01');
  assert.equal(monthStart('9999-12-31'), '9999-12-01');
  for (const value of ['', 'unknown', '2026-02-29', '2026-13-01', '2026-2-01', '2026-02', '+010000-01-01']) {
    assert.equal(monthStart(value), null);
    assert.equal(shiftMonth(value, 1), null);
    assert.deepEqual(monthCells(value), []);
    assert.equal(monthSelectable(value), false);
    assert.equal(formatCalendarDate(value, 'ja'), '');
    assert.equal(monthTitle(value, 'en'), '');
  }
});

test('month shifting crosses years without day rollover or year 00–99 remapping', () => {
  assert.equal(shiftMonth('2026-12-01', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-01');
  assert.equal(shiftMonth('2024-02-29', 12), '2025-02-01');
  assert.equal(shiftMonth('2026-01-01', -1), '2025-12-01');
  assert.equal(shiftMonth('0099-12-01', 1), '0100-01-01');
  assert.equal(shiftMonth('0001-01-01', -1), '0000-12-01');
  assert.equal(shiftMonth('0000-01-01', -1), null);
  assert.equal(shiftMonth('9999-12-01', 1), null);
  assert.equal(shiftMonth('2026-09-01', 0), '2026-09-01');
  for (const value of [NaN, Infinity, -Infinity, .5, Number.MAX_VALUE]) {
    assert.equal(shiftMonth('2026-09-01', value), null);
  }
});

test('Sunday-first month cells cover complete weeks with only real days', () => {
  const september = monthCells('2026-09-01');
  assert.equal(september.length, 35);
  assert.deepEqual(september.slice(0, 3), [null, null, '2026-09-01']);
  assert.deepEqual(september.slice(-4), ['2026-09-30', null, null, null]);
  assert.equal(monthCells('2026-02-01').length, 28);
  assert.equal(monthCells('2026-05-01').length, 42);
  assert.equal(monthCells('2024-02-01').filter(Boolean).length, 29);
  assert.equal(monthCells('1900-02-01').filter(Boolean).length, 28);
  assert.equal(monthCells('2000-02-01').filter(Boolean).length, 29);
  assert.equal(monthCells('0000-02-01').filter(Boolean).length, 29);
  assert.equal(monthCells('9999-12-01').filter(Boolean).length, 31);
});

test('every cell has a matching weekday and no duplicates across boundary years', () => {
  for (const year of ['0000', '0001', '0099', '1900', '2000', '2024', '2026', '9999']) {
    for (let month = 1; month <= 12; month++) {
      const cells = monthCells(`${year}-${String(month).padStart(2, '0')}-01`);
      assert.equal(cells.length % 7, 0);
      assert.ok([28, 35, 42].includes(cells.length));
      assert.equal(new Set(cells.filter(Boolean)).size, cells.filter(Boolean).length);
      cells.forEach((date, index) => {
        if (date) assert.equal(new Date(`${date}T00:00:00Z`).getUTCDay(), index % 7);
      });
    }
  }
});

test('day bounds are inclusive and malformed/unknown values never become selected dates', () => {
  assert.equal(dateSelectable('2026-09-26', undefined, '2026-09-26'), true);
  assert.equal(dateSelectable('2026-09-27', undefined, '2026-09-26'), false);
  assert.equal(dateSelectable('2026-09-20', '2026-09-20'), true);
  assert.equal(dateSelectable('2026-09-19', '2026-09-20'), false);
  assert.equal(dateSelectable('2027-01-01', '2026-09-20'), true);
  assert.equal(dateSelectable('2026-09-26', '2026-09-26', '2026-09-26'), true);
  assert.equal(dateSelectable('2026-09-26', '2026-09-27', '2026-09-25'), false);
  assert.equal(dateSelectable('2026-09-26', 'unknown', 'invalid'), true);
  for (const value of ['', 'unknown', '2026-02-30', '2026-09-26T00:00:00Z']) {
    assert.equal(dateSelectable(value), false);
  }
});

test('month bounds allow partly available months and disable wholly outside months', () => {
  assert.equal(monthSelectable('2026-09-01', '2026-09-20', '2026-09-26'), true);
  assert.equal(monthSelectable('2026-08-01', '2026-09-20'), false);
  assert.equal(monthSelectable('2026-10-01', undefined, '2026-09-26'), false);
  assert.equal(monthSelectable('2026-09-01', '2026-09-30'), true);
  assert.equal(monthSelectable('2026-09-01', undefined, '2026-09-01'), true);
  assert.equal(monthSelectable('2026-09-01', '2026-09-27', '2026-09-25'), false);
  assert.equal(monthSelectable('0000-01-01'), true);
  assert.equal(monthSelectable('9999-12-01'), true);
});

test('initial month anchors existing answers, then today, and clamps display only', () => {
  assert.equal(initialMonth('2024-02-29', '2026-09-26'), '2024-02-01');
  for (const value of ['', 'unknown', '2026-02-30']) {
    assert.equal(initialMonth(value, '2026-09-26'), '2026-09-01');
  }
  assert.equal(initialMonth('2027-01-01', '2026-09-26', undefined, '2026-09-26'), '2026-09-01');
  assert.equal(initialMonth('', '2026-09-26', '2026-11-20'), '2026-11-01');
  assert.equal(initialMonth('', 'invalid', '2026-11-20'), '2026-11-01');
  assert.equal(initialMonth('', 'invalid', undefined, '2026-11-20'), '2026-11-01');
  assert.equal(initialMonth('', 'invalid'), '1970-01-01');
  assert.equal(initialMonth('0000-01-01', '2026-09-26'), '0000-01-01');
});

test('localized full labels preserve weekday and ISO year independently of local timezone', () => {
  assert.equal(formatCalendarDate('2026-09-26', 'ja'), '2026年9月26日 土曜日');
  assert.equal(formatCalendarDate('2026-09-26', 'en'), 'Saturday, September 26, 2026');
  assert.equal(formatCalendarDate('2024-02-29', 'en'), 'Thursday, February 29, 2024');
  assert.equal(monthTitle('2026-09-01', 'ja'), '2026年 9月');
  assert.equal(monthTitle('2026-09-01', 'en'), 'September 2026');
  assert.equal(monthTitle('0000-01-01', 'en'), 'January 0000');
  assert.match(formatCalendarDate('0000-02-29', 'ja'), /^0000年2月29日 /);
  assert.match(formatCalendarDate('0099-12-31', 'en'), /0099$/);
});

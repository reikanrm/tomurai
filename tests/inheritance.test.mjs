import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, todayInJapan } from '../apps/mobile/src/domain/calendar.ts';
import { getInheritanceNotice, inheritanceDetails, inheritanceSources, inheritanceWarning } from '../apps/mobile/src/domain/inheritance.ts';

const base = { deathDate: '2026-01-01', today: '2026-01-01', consideration: 'unknown' };

test('general safety guidance is present on the first day without any religious input', () => {
  const notice = getInheritanceNotice(base);
  assert.equal(notice.reminder, 'general');
  assert.equal(notice.reminderText, null);
  assert.deepEqual(notice.warning, inheritanceWarning);
  assert.ok(notice.title.ja);
  assert.ok(notice.title.en);
});

test('the first-week check-in uses D+6 through D+12, not a legal deadline', () => {
  for (const [day, expected] of [[5, 'general'], [6, 'first-week'], [12, 'first-week'], [13, 'general']]) {
    const notice = getInheritanceNotice({ ...base, today: addDays(base.deathDate, day) });
    assert.equal(notice.reminder, expected, `D+${day}`);
    assert.equal(notice.reminderText !== null, expected !== 'general');
    assert.deepEqual(notice.warning, inheritanceWarning);
  }
});

test('the seven-week check-in uses D+48 through D+54, independent of a ceremony', () => {
  for (const [day, expected] of [[47, 'general'], [48, 'seven-weeks'], [54, 'seven-weeks'], [55, 'general'], [90, 'general']]) {
    assert.equal(getInheritanceNotice({ ...base, today: addDays(base.deathDate, day) }).reminder, expected, `D+${day}`);
  }
});

test('a missing, invalid, or future date retains the general warning without a dated reminder', () => {
  for (const deathDate of ['', 'unknown', '2026-02-30', '2026-1-1', '2027-01-01']) {
    const notice = getInheritanceNotice({ ...base, deathDate });
    assert.equal(notice.reminder, 'general');
    assert.equal(notice.reminderText, null);
    assert.deepEqual(notice.warning, inheritanceWarning);
  }
  for (const today of ['', 'not-a-date', '2026-02-30']) {
    const notice = getInheritanceNotice({ ...base, today });
    assert.equal(notice.reminder, 'general');
    assert.deepEqual(notice.warning, inheritanceWarning);
  }
});

test('month/year/leap boundaries preserve the in-app reminder window', () => {
  for (const [deathDate, today, expected] of [
    ['2026-12-27', '2027-01-02', 'first-week'],
    ['2028-02-23', '2028-02-29', 'first-week'],
    ['2026-12-31', '2027-02-17', 'seven-weeks'],
    ['2028-02-01', '2028-03-20', 'seven-weeks'],
  ]) {
    assert.equal(getInheritanceNotice({ ...base, deathDate, today }).reminder, expected);
  }
});

test('JST calendar dates determine when a check-in begins', () => {
  const before = todayInJapan(new Date('2026-01-06T14:59:59Z'));
  const after = todayInJapan(new Date('2026-01-06T15:00:00Z'));
  assert.equal(getInheritanceNotice({ ...base, today: before }).reminder, 'general');
  assert.equal(getInheritanceNotice({ ...base, today: after }).reminder, 'first-week');
});

test('yes/no/unknown never hide the general safety warning, including in belongings', () => {
  for (const consideration of ['yes', 'no', 'unknown']) {
    for (const context of ['overview', 'belongings']) {
      for (const day of [0, 6, 12, 48, 54, 90]) {
        const notice = getInheritanceNotice({ ...base, today: addDays(base.deathDate, day), consideration, context });
        assert.equal(notice.consideration, consideration);
        assert.deepEqual(notice.warning, inheritanceWarning);
        assert.ok(notice.warning.ja.includes('行う前に'));
        assert.ok(notice.warning.en.includes('before doing so'));
        if (context === 'belongings') assert.equal(notice.title.ja, '遺品を整理する前に');
      }
    }
  }
});

test('general guidance has complete bilingual copy and does not produce individual deadlines', () => {
  for (const detail of inheritanceDetails) {
    assert.ok(detail.title.ja && detail.title.en);
    assert.ok(detail.body.ja && detail.body.en);
  }
  const period = inheritanceDetails.find(detail => detail.id === 'period');
  assert.match(period.body.ja, /自己のために相続の開始があったことを知った時から3か月/);
  assert.match(period.body.ja, /死亡日だけでは個人の期限を確定できません/);
  assert.match(period.body.en, /does not calculate individual legal deadlines/);
  assert.match(inheritanceDetails.find(detail => detail.id === 'joint').body.ja, /共同相続人全員/);
  assert.match(inheritanceDetails.find(detail => detail.id === 'extension').body.ja, /申立てただけで伸長が認められたことにはならず/);
  assert.match(inheritanceDetails.find(detail => detail.id === 'property').body.ja, /保存行為/);
  const model = getInheritanceNotice(base);
  assert.deepEqual(Object.keys(model).sort(), ['consideration', 'reminder', 'reminderText', 'title', 'warning'].sort());
  const copy = JSON.stringify({ model, inheritanceDetails });
  assert.doesNotMatch(copy, /90日|40日|90 days|40 days|deadlineDate|daysRemaining/);
});

test('sources are distinct official court HTTPS pages with labels for both locales', () => {
  assert.equal(inheritanceSources.length, 3);
  assert.equal(new Set(inheritanceSources.map(source => source.url)).size, 3);
  for (const source of inheritanceSources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'www.courts.go.jp');
    assert.equal(url.search, '');
    assert.ok(source.label.ja && source.label.en);
  }
});

test('confirmed forty-nine completion has a seven-day window before or after D+48', () => {
  for (const confirmedOn of ['2026-02-01', '2026-03-10']) {
    for (const [days, expected] of [[-1, 'general'], [0, 'after-forty-nine'], [6, 'after-forty-nine'], [7, 'general']]) {
      const notice = getInheritanceNotice({ ...base, today: addDays(confirmedOn, days),
        fortyNineCompletion: { completed: true, confirmedOn } });
      assert.equal(notice.reminder, expected, `${confirmedOn} + ${days}`);
      assert.deepEqual(notice.warning, inheritanceWarning);
    }
  }
});

test('completion confirmation takes precedence once, then returns to the independent calendar window', () => {
  const duringBoth = { ...base, today: '2026-02-18', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-18' } };
  assert.equal(getInheritanceNotice(duringBoth).reminder, 'after-forty-nine');
  assert.equal(getInheritanceNotice({ ...duringBoth, fortyNineCompletion: { ...duringBoth.fortyNineCompletion, completed: false } }).reminder, 'seven-weeks');
  assert.equal(getInheritanceNotice({ ...duringBoth, fortyNineCompletion: { completed: true, confirmedOn: '2026-02-11' } }).reminder, 'seven-weeks');
  assert.equal(getInheritanceNotice({ ...duringBoth, fortyNineCompletion: undefined }).reminder, 'seven-weeks');
});

test('a stale confirmation cannot survive cancellation; a later reconfirmation starts a new window', () => {
  const first = { ...base, today: '2026-02-01', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } };
  assert.equal(getInheritanceNotice(first).reminder, 'after-forty-nine');
  assert.equal(getInheritanceNotice({ ...first, fortyNineCompletion: { completed: false, confirmedOn: '2026-02-01' } }).reminder, 'general');
  assert.equal(getInheritanceNotice({ ...first, today: '2026-02-10' }).reminder, 'general');
  const reconfirmed = { ...first, today: '2026-02-10', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-10' } };
  assert.equal(getInheritanceNotice(reconfirmed).reminder, 'after-forty-nine');
  assert.equal(getInheritanceNotice({ ...reconfirmed, today: '2026-02-17' }).reminder, 'general');
});

test('missing, malformed, future and pre-death confirmation dates never create an event reminder', () => {
  for (const confirmedOn of [undefined, '', 'unknown', '2026-02-30', '2026-2-1', '2026-02-02', '2025-12-31']) {
    const notice = getInheritanceNotice({ ...base, today: '2026-02-01', fortyNineCompletion: { completed: true, confirmedOn } });
    assert.equal(notice.reminder, 'general', String(confirmedOn));
    assert.deepEqual(notice.warning, inheritanceWarning);
  }
  const invalidToday = getInheritanceNotice({ ...base, today: '2026-02-30', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-25' } });
  assert.equal(invalidToday.reminder, 'general');
  const beforeDeath = getInheritanceNotice({ ...base, deathDate: '2026-02-02', today: '2026-02-01', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } });
  assert.equal(beforeDeath.reminder, 'general');
  const correctedDeath = getInheritanceNotice({ ...base, deathDate: '2026-02-02', today: '2026-02-04', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } });
  assert.equal(correctedDeath.reminder, 'general');
  const invalidDeath = getInheritanceNotice({ ...base, deathDate: '2026-02-30', today: '2026-02-01', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } });
  assert.equal(invalidDeath.reminder, 'general');
});

test('a confirmed completion can prompt with an unknown death date, without making a legal or ceremony date', () => {
  const notice = getInheritanceNotice({ ...base, deathDate: '', today: '2026-02-01', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } });
  assert.equal(notice.reminder, 'after-forty-nine');
  assert.match(notice.reminderText.ja, /四十九日法要の実施を確認しました/);
  assert.match(notice.reminderText.en, /confirmed.*completed/);
  assert.doesNotMatch(JSON.stringify(notice), /2026-02-01|今日.*法要|service.*today|90日|40日|deadlineDate|daysRemaining/);
  assert.deepEqual(Object.keys(notice).sort(), ['consideration', 'reminder', 'reminderText', 'title', 'warning'].sort());
});

test('completion check-ins preserve warnings for every answer/context and do not mutate input', () => {
  for (const consideration of ['yes', 'no', 'unknown']) for (const context of ['overview', 'belongings']) {
    const input = Object.freeze({ ...base, today: '2026-02-01', consideration, context,
      fortyNineCompletion: Object.freeze({ completed: true, confirmedOn: '2026-02-01' }) });
    const before = structuredClone(input);
    const notice = getInheritanceNotice(input);
    assert.equal(notice.reminder, 'after-forty-nine');
    assert.deepEqual(notice.warning, inheritanceWarning);
    assert.equal(notice.consideration, consideration);
    if (context === 'belongings') assert.equal(notice.title.ja, '遺品を整理する前に');
    assert.deepEqual(input, before);
  }
});

test('confirmation windows use JST calendar days across year and leap boundaries', () => {
  for (const [confirmedOn, finalDay, expiredDay] of [['2026-12-29', '2027-01-04', '2027-01-05'], ['2028-02-25', '2028-03-02', '2028-03-03']]) {
    const input = { ...base, deathDate: '', fortyNineCompletion: { completed: true, confirmedOn } };
    assert.equal(getInheritanceNotice({ ...input, today: finalDay }).reminder, 'after-forty-nine');
    assert.equal(getInheritanceNotice({ ...input, today: expiredDay }).reminder, 'general');
  }
  const input = { ...base, deathDate: '', fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' } };
  assert.equal(getInheritanceNotice({ ...input, today: todayInJapan(new Date('2026-02-07T14:59:59Z')) }).reminder, 'after-forty-nine');
  assert.equal(getInheritanceNotice({ ...input, today: todayInJapan(new Date('2026-02-07T15:00:00Z')) }).reminder, 'general');
});

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

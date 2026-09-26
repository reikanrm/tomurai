import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPreviewTitles, rowHeightFromLines, taskRowMetrics, wrapPreviewTitle } from '../apps/mobile/src/domain/task-row-layout.ts';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import { deriveGuidanceTasks } from '../apps/mobile/src/domain/guidance.ts';

const withoutWhitespace = value => value.replace(/\s+/gu, '');

test('task row metrics preserve the existing native row geometry', () => {
  assert.deepEqual(taskRowMetrics, {
    rowPadding: 16, rowGap: 14, rowBorderWidth: 1, minHeight: 78,
    checkboxSize: 19, checkboxBorderWidth: 1.5, checkboxRadius: 3, checkboxTop: 2,
    metaFontSize: 11, metaLineHeight: 18, metaGap: 5, titleFontSize: 15, titleLineHeight: 22,
    titleGap: 4, assigneeFontSize: 12, assigneeLineHeight: 21, avatarSize: 24,
  });
  assert.equal(Object.isFrozen(taskRowMetrics), true);
  assert.equal(taskRowMetrics.checkboxSize + taskRowMetrics.rowGap, 33);
});

test('background titles are fixed bilingual public catalogue copy without task state', () => {
  const general = deriveGuidanceTasks({ ...defaultPlan }).filter(task => task.group === 'general');
  assert.equal(publicPreviewTitles.length, 4);
  assert.deepEqual(publicPreviewTitles, general.map(task => task.title));
  assert.equal(Object.isFrozen(publicPreviewTitles), true);
  for (const title of publicPreviewTitles) {
    assert.deepEqual(Object.keys(title).sort(), ['en', 'ja']);
    assert.equal(Object.isFrozen(title), true);
  }
  const changed = deriveGuidanceTasks({ ...defaultPlan, deathDate: '2026-09-01', rituals: 'yes', burial: 'around49' });
  assert.deepEqual(publicPreviewTitles, changed.filter(task => task.group === 'general').map(task => task.title));
});

test('row heights use all three text bands and grow by one title line at a time', () => {
  assert.equal(rowHeightFromLines(1), 103);
  assert.equal(rowHeightFromLines(2), 125);
  assert.equal(rowHeightFromLines(4), 169);
  assert.equal(rowHeightFromLines(1.1), 125);
  for (const value of [0, -1, NaN, Infinity, -Infinity]) assert.equal(rowHeightFromLines(value), 103);
  assert.equal(Number.isFinite(rowHeightFromLines(Number.MAX_VALUE)), true);
});

test('Japanese titles wrap at exact glyph boundaries without truncation', () => {
  assert.deepEqual(wrapPreviewTitle('死亡届の提出', 45), ['死亡届', 'の提出']);
  assert.deepEqual(wrapPreviewTitle('死亡届の提出', 44.9), ['死亡', '届の', '提出']);
  assert.deepEqual(wrapPreviewTitle('死亡届', 15), ['死', '亡', '届']);
  assert.deepEqual(wrapPreviewTitle('死亡届', 100), ['死亡届']);
});

test('English words stay together when they fit and long words make bounded progress', () => {
  assert.deepEqual(wrapPreviewTitle('Check the bank', 85), ['Check the', 'bank']);
  assert.deepEqual(wrapPreviewTitle('Check the bank', 35), ['Che', 'ck', 'the', 'ban', 'k']);
  assert.deepEqual(wrapPreviewTitle('  Review   contracts  ', 300), ['Review contracts']);
  assert.deepEqual(wrapPreviewTitle('Check how to receive the medical certificate', 1000), ['Check how to receive the medical certificate']);
});

test('all four titles in each locale retain every character at narrow and normal widths', () => {
  for (const title of publicPreviewTitles) {
    for (const locale of ['ja', 'en']) {
      for (const width of [1, 14.9, 15, 16, 35, 80, 120, 230, 300, 349, 1000]) {
        const lines = wrapPreviewTitle(title[locale], width);
        assert.ok(lines.length > 0);
        assert.ok(lines.every(line => line.length > 0 && line.trim() === line));
        assert.equal(withoutWhitespace(lines.join('')), withoutWhitespace(title[locale]));
        assert.deepEqual(lines, wrapPreviewTitle(title[locale], width));
        if (width >= 230) assert.ok(lines.length <= 4);
      }
    }
  }
});

test('empty strings, invalid geometry and larger fonts are deterministic and do not lose text', () => {
  for (const text of ['', ' ', '\n\t']) assert.deepEqual(wrapPreviewTitle(text, 200), []);
  for (const width of [0, -1, NaN, Infinity, -Infinity, Number.MIN_VALUE]) {
    assert.deepEqual(wrapPreviewTitle('死亡届', width), ['死', '亡', '届']);
    assert.equal(withoutWhitespace(wrapPreviewTitle('Check bank', width).join('')), 'Checkbank');
  }
  for (const fontSize of [0, -1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(wrapPreviewTitle('死亡届', 45, fontSize), ['死亡届']);
  }
  assert.deepEqual(wrapPreviewTitle('死亡届', 45, 30), ['死', '亡', '届']);
  const mixed = '確認する Check the bank 𠮷';
  for (const width of [1, 40, 100]) {
    const lines = wrapPreviewTitle(mixed, width);
    assert.equal(withoutWhitespace(lines.join('')), withoutWhitespace(mixed));
    assert.ok(lines.every(line => !/[\uD800-\uDBFF]$/u.test(line)));
  }
});

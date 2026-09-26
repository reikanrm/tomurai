import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { progressValue, revealSector, isValidPastDate } from '../apps/mobile/src/domain/progress.ts';
import { colors } from '../apps/mobile/src/theme.ts';

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

test('reveal starts at the bottom gap, retaining the original brush bulb', () => {
  assert.ok(revealSector(2 / 6).startsWith('M100 100 L100 250 '));
  assert.equal(revealSector(0), 'M100 100 Z');
  assert.equal(revealSector(1), 'M0 0 H200 V200 H0 Z');
});

test('enso uses the supplied image unchanged, not a redrawn substitute', () => {
  const png = readFileSync(new URL('../apps/mobile/assets/enso-original.png', import.meta.url));
  assert.equal(createHash('sha256').update(png).digest('hex'),
    '607ca0f5e83fc66b3ccff4358b4e8c7fa3dc39fcfd78cf850f72e7db8949f00d');
});

test('enso has a dedicated black token without changing other UI or unfinished colors', () => {
  assert.equal(colors.enso, '#000000');
  assert.equal(colors.green, '#2B5545');
  assert.equal(colors.line, '#DCD8CC');
});

test('brand, partial and completed enso use black while unfinished ink stays pale', () => {
  // A narrow source contract complements the progress/asset tests; rendering is
  // still checked separately in the browser and Android preview.
  const source = readFileSync(new URL('../apps/mobile/src/components/EnsoProgress.tsx', import.meta.url), 'utf8');
  const rect = source.match(/<Rect\b[\s\S]*?\/>/)?.[0] ?? '';
  const path = source.match(/<Path\b[\s\S]*?\/>/)?.[0] ?? '';
  assert.match(rect, /fill=\{\s*isBrand\s*\|\|\s*shown\s*>=\s*1\s*\?\s*colors\.enso\s*:\s*colors\.line\s*\}/);
  assert.match(path, /fill=\{\s*colors\.enso\s*\}/);
  assert.doesNotMatch(source, /colors\.green\b/);
});

test('date rejects rollover, future date and malformed date without deriving a legal deadline', () => {
  assert.equal(isValidPastDate('2024-02-29', '2026-09-26'), true);
  for (const input of ['2025-02-29', '2026-09-27', '2026-2-1', 'unknown', '']) {
    assert.equal(isValidPastDate(input, '2026-09-26'), false);
  }
});

test('logo dimensions are halved, while its caption remains 12px', () => {
  const source = readFileSync(new URL('../apps/mobile/src/components/EnsoProgress.tsx', import.meta.url), 'utf8');
  assert.match(source, /const logoSize = size \* 0\.5/);
  assert.match(source, /<Svg width=\{logoSize\} height=\{logoSize\}/);
  assert.match(source, /caption: \{[^}]*fontSize: 12/);
  assert.match(source, /size = 116/);
  const onboarding = readFileSync(new URL('../apps/mobile/src/components/Onboarding.tsx', import.meta.url), 'utf8');
  assert.match(onboarding, /size=\{132\}/);
});

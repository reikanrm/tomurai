import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot, validateSpec, validateLocalLinks } from '../scripts/check-baseline.mjs';

const baseline = readFileSync(resolve(repoRoot, 'docs/ssot/product-requirements.md'), 'utf8');

test('approved specification has all requirement, gate and acceptance IDs', () => {
  assert.deepEqual(validateSpec(baseline), []);
});

test('missing requirement fails validation', () => {
  const changed = baseline.replace(/^\| R48 \|.*(?:\r?\n|$)/m, '');
  assert.ok(validateSpec(changed).some(e => e.startsWith('R:')));
});

test('duplicate gate fails validation', () => {
  const row = baseline.split(/\r?\n/).find(line => line.startsWith('| G01 |'));
  assert.ok(validateSpec(baseline + '\n' + row).some(e => e.startsWith('G:')));
});

test('reverting unlimited family wording fails validation', () => {
  const changed = baseline.replace('**家族の人数上限は設けない。旧10名上限案は不採用。**', '家族の人数は10名まで。');
  assert.ok(validateSpec(changed).some(e => e.includes('R02:')));
});

test('losing no-growth shared AI condition fails validation', () => {
  const changed = baseline.replace('AIのグループ共通枠は人数で自動増加しない。', 'AIの回数は人数に比例する。');
  assert.ok(validateSpec(changed).some(e => e.includes('R02:')));
});

test('free additional members must not erase the second-member pricing tier', () => {
  const changed = baseline.replaceAll('2人以上1,480円/月', '全員980円/月');
  assert.ok(validateSpec(changed).some(e => e.startsWith('C04:')));
});

test('missing acceptance test fails validation', () => {
  const changed = baseline.replace(/^24\. .*$/m, '');
  assert.ok(validateSpec(changed).some(e => e.startsWith('Acceptance tests:')));
});

test('all local markdown links resolve', () => {
  assert.deepEqual(validateLocalLinks(repoRoot), []);
});

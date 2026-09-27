import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validateSpec(source) {
  const errors = [];
  for (const [prefix, count] of [['R', 48], ['G', 6], ['E', 10]]) {
    const ids = [...source.matchAll(new RegExp('^\\| (' + prefix + '\\d{2}) \\|', 'gm'))].map(m => m[1]);
    const expected = Array.from({ length: count }, (_, i) => prefix + String(i + 1).padStart(2, '0'));
    if (JSON.stringify(ids) !== JSON.stringify(expected)) errors.push(prefix + ': missing, duplicate, or out-of-order IDs');
  }
  const r02 = source.split(/\r?\n/).find(line => line.startsWith('| R02 |')) ?? '';
  for (const required of ['家族の人数上限は設けない', '3人目以降の追加料金なし', '人数で自動増加しない', 'ページ分割']) {
    if (!r02.includes(required)) errors.push('R02: missing ' + required);
  }
  const c04 = source.split(/\r?\n/).find(line => line.startsWith('| C04 |')) ?? '';
  for (const required of ['1人利用980円/月', '2人以上1,480円/月', '税込', '年払い15%', '9,996円／15,096円', 'b2c-2026-09-26-v2']) {
    if (!c04.includes(required)) errors.push('C04: missing ' + required);
  }
  const acceptance = source.split('## 7. 絶対に削らない受入試験')[1]?.split('## 8.')[0] ?? '';
  const numbers = [...acceptance.matchAll(/^(\d+)\. /gm)].map(m => Number(m[1]));
  if (JSON.stringify(numbers) !== JSON.stringify(Array.from({ length: 24 }, (_, i) => i + 1))) {
    errors.push('Acceptance tests: expected items 1 through 24');
  }
  if (!source.includes('実装完了・公開承認ではない')) errors.push('Approval must not imply release');
  if (source.includes('\uFFFD')) errors.push('Unicode replacement character found');
  return errors;
}

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : extname(path) === '.md' ? [path] : [];
  });
}

export function validateLocalLinks(root) {
  const errors = [];
  for (const file of [resolve(root, 'README.md'), ...markdownFiles(resolve(root, 'docs'))]) {
    const content = readFileSync(file, 'utf8');
    for (const [, link] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const relativePath = link.split('#')[0];
      if (!existsSync(resolve(dirname(file), relativePath))) errors.push(file + ': missing link ' + link);
    }
  }
  return errors;
}

export function runChecks(root = repoRoot) {
  const source = readFileSync(resolve(root, 'docs/ssot/product-requirements.md'), 'utf8');
  const errors = [...validateSpec(source), ...validateLocalLinks(root)];
  assert.deepEqual(errors, [], errors.join('\n'));
  return 'Baseline OK: R48 / G6 / E10 / acceptance24; no-cap and price wording; local links.';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(runChecks());
  console.log('Documentation checks only; no application, payment, authorization or recovery tests were run.');
}

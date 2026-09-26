import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(join(directory, entry.name)) : /\.(tsx?|json)$/.test(entry.name) ? [join(directory, entry.name)] : []);
test('all screen sources and app title omit development-preview and sample UI labels in both languages', () => {
  for (const path of ['apps/mobile/app.json', 'apps/mobile/src/App.tsx', ...files('apps/mobile/src/components')]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /開発プレビュー|表示サンプル|操作確認用|家族プランのサンプル|Development preview|This preview|this preview|Preview onboarding|sample tasks|interaction sample/, path);
  }
});
test('removing development labels keeps Maps privacy and procedure safety', () => {
  const app = readFileSync('apps/mobile/src/App.tsx', 'utf8');
  const specialists = readFileSync('apps/mobile/src/components/SpecialistsScreen.tsx', 'utf8');
  assert.match(app, /提出・申請などの手続き自体が完了するわけではありません/);
  assert.match(specialists, /相談内容や家族の情報は自動送信しません/);
  assert.match(specialists, /売却・処分の前に専門家へ確認/);
  assert.doesNotMatch(specialists, /地図は準備中/);
  assert.match(app, /initialAnswers=\{answers\}/);
  assert.doesNotMatch(app, /useState\(demoTasks\)/);
});

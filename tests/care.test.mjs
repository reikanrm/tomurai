import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { careMoods, toggleCareMood } from '../apps/mobile/src/data/care.ts';

test('moods have stable unique IDs and labels in both languages', () => {
  assert.equal(careMoods.length, 5);
  assert.equal(new Set(careMoods.map(mood => mood.id)).size, careMoods.length);
  for (const mood of careMoods) {
    assert.ok(mood.label.ja);
    assert.ok(mood.label.en);
    assert.ok(mood.icon);
    assert.notEqual(mood.id, mood.label.ja);
    assert.notEqual(mood.id, mood.label.en);
  }
});

test('mood choice is optional, replaceable, and can be cleared', () => {
  for (const mood of careMoods) {
    assert.equal(toggleCareMood(null, mood.id), mood.id);
    assert.equal(toggleCareMood(mood.id, mood.id), null);
  }
  assert.equal(toggleCareMood('calm', 'tearful'), 'tearful');
});

test('care contains both approved Japanese messages and retains voluntary support', () => {
  const source = readFileSync(new URL('../apps/mobile/src/components/CareScreen.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('今の気持ちに、正解はありません。\\n何かを感じても、何も感じなくても。\\n今は、そのままで大丈夫です。'));
  assert.ok(source.includes('気持ちは、日によって変わることがあります。\\n無理に整理しようとせず、今の自分に合った過ごし方を探してみましょう。'));
  assert.ok(source.includes('選ばなくても大丈夫です。気分の履歴は保存しません。'));
  assert.match(source, /onPress=\{onFindSupport\}/);
  assert.match(source, /onPress=\{onPause\}/);
  assert.doesNotMatch(source, /悲しむことは、愛していた証|悲しいはず|愛していたはず|頑張りましたね|元気を出して/);
});

test('care does not advertise unavailable recording or development features', () => {
  const source = readFileSync(new URL('../apps/mobile/src/components/CareScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /思い出を書き留めておく|Write down a memory|準備中|Coming later|プレビュー|preview|サンプル|sample|未接続/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as catalog from '../apps/mobile/src/data/life-notes.ts';
import * as theme from '../apps/mobile/src/theme.ts';

const expectedChapters = [
  ['me', 'わたしについて', 'About me', 6],
  ['medical', '医療・介護について', 'Medical and care preferences', 7],
  ['money', 'お金・資産について', 'Money and assets', 1],
  ['digital', 'デジタルの整理', 'Digital arrangements', 1],
  ['legal', '遺言・相続・重要書類', 'Wills, inheritance and documents', 5],
  ['funeral', '供養・お別れについて', 'Remembrance and farewell', 6],
  ['message', '大切な人へ', 'For people close to me', 5],
  ['future', 'これからのこと', 'Looking ahead', 5],
];

const source = readFileSync(new URL('../apps/mobile/src/components/LifeNotesScreen.tsx', import.meta.url), 'utf8');
function harness() {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  let hookIndex = 0;
  const state = [];
  const element = (type, props) => ({ type, props: props ?? {}, children: props?.children });
  const context = { exports: {}, require: id => {
    if (id === 'react') return { useState: initial => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    } };
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'Fragment' };
    if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: styles => styles } };
    if (id === '../data/life-notes') return catalog;
    if (id === '../theme') return theme;
    throw Error(`Unexpected life-note component import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return props => { hookIndex = 0; return context.exports.LifeNotesScreen(props); };
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const chapters = tree => nodes(tree).filter(node => node.type === 'Pressable' && typeof node.props['aria-expanded'] === 'boolean');
const chapter = (tree, title) => chapters(tree).find(node => text(node).includes(title));
const flatText = tree => nodes(tree).filter(node => node.type === 'Text').map(text);
const props = (locale, eligible = true) => ({ locale, eligible, onBack: () => {} });

test('the bilingual catalogue has exactly the observed eight chapters and thirty-six topic labels', () => {
  assert.equal(catalog.lifeChapters.length, 8);
  assert.equal(new Set(catalog.lifeChapters.map(item => item.id)).size, 8);
  assert.equal(catalog.lifeChapters.reduce((sum, item) => sum + item.items.length, 0), 36);
  catalog.lifeChapters.forEach((item, index) => {
    const [id, ja, en, count] = expectedChapters[index];
    assert.deepEqual([item.id, item.title.ja, item.title.en, item.items.length], [id, ja, en, count]);
    assert.deepEqual(Object.keys(item).sort(), ['id', 'items', 'title']);
    for (const entry of [item.title, ...item.items]) {
      assert.deepEqual(Object.keys(entry).sort(), ['en', 'ja']);
      assert.ok(entry.ja.trim());
      assert.ok(entry.en.trim());
      assert.doesNotMatch(entry.ja + entry.en, /password|パスワード|暗証番号|ログイン情報|認証コード|secret/i);
    }
  });
  for (const locale of ['ja', 'en']) {
    const titles = catalog.lifeChapters.flatMap(item => item.items.map(entry => entry[locale]));
    assert.equal(new Set(titles).size, 36);
  }
});

test('free access renders no chapters, item labels, sharing controls or input fields in either language', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()(props(locale, false));
    assert.equal(chapters(tree).length, 0);
    const labels = flatText(tree);
    for (const item of catalog.lifeChapters) {
      assert.equal(labels.includes(item.title[locale]), false);
      for (const entry of item.items) assert.equal(labels.includes(entry[locale]), false);
    }
    const buttons = nodes(tree).filter(node => node.type === 'Pressable');
    assert.equal(buttons.length, 1);
    assert.match(text(buttons[0]), locale === 'ja' ? /ホームに戻る/ : /Back to home/);
    assert.match(text(tree), locale === 'ja' ? /法人の福利厚生/ : /corporate benefits/);
    assert.doesNotMatch(text(tree), /共有設定|Sharing settings/);
  }
});

test('corporate access initially offers all chapters collapsed and explicitly identifies unconnected saving/sharing', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()(props(locale));
    assert.equal(chapters(tree).length, 8);
    for (const button of chapters(tree)) {
      assert.equal(button.props['aria-expanded'], false);
      assert.equal(button.props.accessibilityState.expanded, false);
      assert.equal(button.props.accessibilityRole, 'button');
      assert.ok(button.props.style.minHeight >= 44);
    }
    assert.match(text(tree), locale === 'ja' ? /ノートの保存・共有は準備中/ : /Saving and sharing are being prepared/);
    assert.match(text(tree), locale === 'ja' ? /個人情報やパスワードは入力しないでください/ : /Do not enter personal information or passwords/);
    const sharing = nodes(tree).find(node => node.type === 'Pressable' && text(node).includes(locale === 'ja' ? '共有設定' : 'Sharing settings'));
    assert.ok(sharing);
    assert.equal(sharing.props.disabled, true);
    assert.equal(sharing.props.accessibilityState.disabled, true);
    assert.equal(sharing.props.onPress, undefined);
  }
});

test('all thirty-six topics can be reviewed independently; each is marked entry/storage pending with no form', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness(), input = props(locale);
    const observed = [];
    for (const item of catalog.lifeChapters) {
      chapter(render(input), item.title[locale]).props.onPress();
      const expanded = render(input), labels = flatText(expanded);
      assert.equal(chapters(expanded).filter(button => button.props['aria-expanded']).length, 1);
      assert.equal(chapter(expanded, item.title[locale]).props.accessibilityState.expanded, true);
      assert.equal(labels.filter(label => label === (locale === 'ja' ? '入力・保存の準備中' : 'Entry and storage pending')).length, item.items.length);
      for (const entry of item.items) {
        assert.equal(labels.filter(label => label === entry[locale]).length, 1);
        observed.push(entry[locale]);
      }
      for (const other of catalog.lifeChapters.filter(other => other.id !== item.id)) {
        for (const entry of other.items) assert.equal(labels.includes(entry[locale]), false);
      }
      for (const node of nodes(expanded)) {
        assert.ok(['View', 'Text', 'Pressable', 'Fragment'].includes(node.type));
        assert.equal(node.props.onChangeText, undefined);
        assert.equal(node.props.onChange, undefined);
        assert.equal(node.props.onSubmitEditing, undefined);
        assert.equal(node.props.value, undefined);
        assert.equal(node.props.defaultValue, undefined);
      }
      chapter(expanded, item.title[locale]).props.onPress();
      assert.ok(chapters(render(input)).every(button => !button.props['aria-expanded']));
    }
    assert.equal(observed.length, 36);
  }
});

test('opening another chapter replaces the open chapter; language change preserves only the chosen catalogue section', () => {
  const render = harness();
  chapter(render(props('ja')), catalog.lifeChapters[0].title.ja).props.onPress();
  chapter(render(props('ja')), catalog.lifeChapters[1].title.ja).props.onPress();
  const english = render(props('en'));
  assert.equal(chapters(english).filter(button => button.props['aria-expanded']).length, 1);
  assert.equal(chapter(english, catalog.lifeChapters[1].title.en).props['aria-expanded'], true);
  for (const entry of catalog.lifeChapters[1].items) {
    assert.ok(flatText(english).includes(entry.en));
    assert.equal(flatText(english).includes(entry.ja), false);
  }
});

test('losing eligibility removes the catalogue even while a sensitive topic is open', () => {
  const render = harness();
  chapter(render(props('ja')), '医療・介護について').props.onPress();
  assert.ok(flatText(render(props('ja'))).includes('延命治療についての考え'));
  const free = render(props('ja', false));
  assert.equal(chapters(free).length, 0);
  for (const item of catalog.lifeChapters) {
    for (const entry of item.items) assert.equal(flatText(free).includes(entry.ja), false);
  }
});

test('privacy/death boundaries are explained without claiming encryption, saving or sharing success', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()(props(locale));
    assert.match(text(tree), locale === 'ja' ? /初期状態は自分だけ/ : /Private by default/);
    assert.match(text(tree), locale === 'ja' ? /勤務先には内容を共有しません/ : /employer cannot read/);
    assert.match(text(tree), locale === 'ja' ? /死亡の届け出だけでノートが公開されることはありません/ : /death report alone does not release/);
    assert.doesNotMatch(text(tree), /暗号化済み|保存しました|共有しました|死亡確認済み|Encrypted|Saved successfully|Shared successfully|Death verified/i);
  }
  assert.doesNotMatch(source, /TextInput|fetch\s*\(|axios|AsyncStorage|SecureStore|FileSystem|onSave|onShare|setItem\s*\(/);
});

test('home callback works without inputs for free and corporate views in both languages', () => {
  for (const locale of ['ja', 'en']) for (const eligible of [false, true]) {
    let calls = 0;
    const tree = harness()({ locale, eligible, onBack: () => { calls++; } });
    nodes(tree).find(node => node.type === 'Pressable' && text(node) === (locale === 'ja' ? 'ホームに戻る' : 'Back to home')).props.onPress();
    assert.equal(calls, 1);
  }
});

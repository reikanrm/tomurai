import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as care from '../apps/mobile/src/data/care.ts';
import * as theme from '../apps/mobile/src/theme.ts';

// Isolated component behavior with inert native elements; this does not claim
// actual native layout, screen-reader output, navigation or Maps integration.
const source = readFileSync(new URL('../apps/mobile/src/components/CareScreen.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function harness() {
  let hookIndex = 0;
  const state = [];
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: initial => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
  };
  const native = { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } };
  const context = { exports: {}, require: id => {
    if (id === 'react') return react;
    if (id === 'react-native') return native;
    if (id === '../data/care') return care;
    if (id === '../theme') return theme;
    // Full SVG geometry/accessibility is exercised by care-icons.test.mjs.
    if (id === './CareActionIcon') return { CareActionIcon: 'CareActionIcon' };
    throw Error(`Unexpected component import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return props => { hookIndex = 0; return context.exports.CareScreen(props); };
}

const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
const input = locale => ({ locale, onPause: () => {}, onFindSupport: () => {} });
const actions = tree => nodes(tree).filter(node => typeof node.props['aria-expanded'] === 'boolean');
const actionButton = (tree, id, locale) => actions(tree).find(node => text(node).includes(care.selfCareActions.find(option => option.id === id).title[locale]));
const moodButton = (tree, id, locale) => nodes(tree).find(node => node.props.accessibilityLabel === care.careMoods.find(option => option.id === id).label[locale]);

test('all three self-care suggestions are available without choosing a mood or action in either language', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()(input(locale));
    assert.equal(actions(tree).length, 3);
    assert.ok(actions(tree).every(node => node.props['aria-expanded'] === false));
    for (const option of care.selfCareActions) {
      assert.ok(text(tree).includes(option.title[locale]));
      assert.equal(text(tree).includes(option.body[locale]), false);
    }
    assert.ok(care.careMoods.every(option => moodButton(tree, option.id, locale).props['aria-pressed'] === false));
    assert.ok(text(tree).includes(locale === 'ja' ? '何も選ばずに過ごしてもかまいません' : 'leave everything unselected'));
  }
});

test('a suggestion opens, toggles closed, replaces another suggestion and can be explicitly closed', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness(), props = input(locale);
    for (const option of care.selfCareActions) {
      actionButton(render(props), option.id, locale).props.onPress();
      const expanded = render(props);
      assert.equal(actionButton(expanded, option.id, locale).props['aria-expanded'], true);
      assert.ok(text(expanded).includes(option.body[locale]));
      actionButton(expanded, option.id, locale).props.onPress();
      assert.ok(actions(render(props)).every(node => node.props['aria-expanded'] === false));
    }
    actionButton(render(props), 'water', locale).props.onPress();
    actionButton(render(props), 'rest', locale).props.onPress();
    const replaced = render(props);
    assert.equal(actions(replaced).filter(node => node.props['aria-expanded']).length, 1);
    assert.equal(text(replaced).includes(care.selfCareActions[0].body[locale]), false);
    assert.ok(text(replaced).includes(care.selfCareActions[1].body[locale]));
    nodes(replaced).find(node => node.type === 'Pressable' && text(node) === (locale === 'ja' ? '案内を閉じる' : 'Close this suggestion')).props.onPress();
    assert.ok(actions(render(props)).every(node => node.props['aria-expanded'] === false));
  }
});

test('mood selection neither chooses nor filters actions, and an action never changes the selected mood', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness(), props = input(locale);
    for (const mood of care.careMoods) {
      moodButton(render(props), mood.id, locale).props.onPress();
      let tree = render(props);
      assert.equal(actions(tree).length, 3);
      assert.ok(actions(tree).every(node => node.props['aria-expanded'] === false));
      actionButton(tree, 'connection', locale).props.onPress();
      tree = render(props);
      assert.equal(moodButton(tree, mood.id, locale).props['aria-pressed'], true);
      moodButton(tree, mood.id, locale).props.onPress();
      tree = render(props);
      assert.equal(actionButton(tree, 'connection', locale).props['aria-expanded'], true);
      assert.ok(care.careMoods.every(option => moodButton(tree, option.id, locale).props['aria-pressed'] === false));
      actionButton(tree, 'connection', locale).props.onPress();
    }
  }
});

test('support search and pause callbacks remain available with no selections and with every suggestion open', () => {
  for (const locale of ['ja', 'en']) {
    let supportCalls = 0, pauseCalls = 0;
    const render = harness();
    const props = { locale, onPause: () => { pauseCalls++; }, onFindSupport: () => { supportCalls++; } };
    for (const selected of [null, ...care.selfCareActions.map(option => option.id)]) {
      if (selected) actionButton(render(props), selected, locale).props.onPress();
      const tree = render(props);
      nodes(tree).find(node => (node.props.accessibilityLabel ?? '').includes('Google Maps')).props.onPress();
      nodes(tree).find(node => node.type === 'Pressable' && text(node).includes(locale === 'ja' ? '少し、間（ま）を置く' : 'Take a little space')).props.onPress();
    }
    assert.equal(supportCalls, 4);
    assert.equal(pauseCalls, 4);
  }
});

test('changing language preserves local selection while a newly mounted care screen starts unselected', () => {
  const render = harness();
  moodButton(render(input('ja')), 'nothing', 'ja').props.onPress();
  actionButton(render(input('ja')), 'water', 'ja').props.onPress();
  const english = render(input('en'));
  assert.equal(moodButton(english, 'nothing', 'en').props['aria-pressed'], true);
  assert.equal(actionButton(english, 'water', 'en').props['aria-expanded'], true);
  assert.ok(text(english).includes(care.selfCareActions[0].body.en));
  assert.equal(text(english).includes(care.selfCareActions[0].body.ja), false);
  const newScreen = harness()(input('en'));
  assert.ok(actions(newScreen).every(node => node.props['aria-expanded'] === false));
  assert.ok(care.careMoods.every(option => moodButton(newScreen, option.id, 'en').props['aria-pressed'] === false));
});

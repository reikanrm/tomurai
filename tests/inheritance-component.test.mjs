import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as inheritance from '../apps/mobile/src/domain/inheritance.ts';
import * as theme from '../apps/mobile/src/theme.ts';

// Execute the component with inert native elements and local hook state. These
// checks cover props/conditional rendering, not native layout, AX or navigation.
const source = readFileSync(new URL('../apps/mobile/src/components/InheritanceNotice.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function harness() {
  let hookIndex = 0;
  const state = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState: initial => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
  };
  const native = { Linking: { openURL: async () => {} }, Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } };
  const context = { exports: {}, require: id => {
    if (id === 'react') return react;
    if (id === 'react-native') return native;
    if (id === '../domain/inheritance') return inheritance;
    if (id === '../theme') return theme;
    throw Error(`Unexpected component import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return props => { hookIndex = 0; return context.exports.InheritanceNotice(props); };
}

const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
const props = locale => ({ locale, deathDate: '2026-01-01', today: '2026-02-01', consideration: 'unknown',
  fortyNineCompletion: { completed: true, confirmedOn: '2026-02-01' }, onFindSupport: () => {} });

test('a new completion reminder and disposal warning are visible while details are collapsed in either language', () => {
  for (const locale of ['ja', 'en']) for (const context of ['overview', 'belongings']) {
    const input = { ...props(locale), context, onConsiderationChange: () => {} };
    const tree = harness()(input);
    const copy = text(tree);
    assert.ok(copy.includes(inheritance.getInheritanceNotice(input).reminderText[locale]));
    assert.ok(copy.includes(inheritance.inheritanceWarning[locale]));
    assert.equal(nodes(tree).filter(node => node.props['aria-expanded'] === false).length, 1);
    assert.equal(nodes(tree).some(node => (node.props.accessibilityLabel ?? '').includes('Google Maps')), false);
    assert.equal(copy.includes(locale === 'ja' ? '（任意）' : '(Optional)'), false);
  }
});

test('expansion keeps warning and confirmation copy, reveals optional choices and invokes the existing Maps callback', () => {
  for (const locale of ['ja', 'en']) {
    let answer = null, mapsOpened = false;
    const render = harness();
    const input = { ...props(locale), onConsiderationChange: value => { answer = value; }, onFindSupport: () => { mapsOpened = true; } };
    nodes(render(input)).find(node => node.props['aria-expanded'] === false).props.onPress();
    const expanded = render(input);
    assert.ok(text(expanded).includes(inheritance.inheritanceWarning[locale]));
    assert.ok(text(expanded).includes(inheritance.getInheritanceNotice(input).reminderText[locale]));
    nodes(expanded).find(node => node.props.accessibilityLabel === (locale === 'ja' ? 'いいえ' : 'No')).props.onPress();
    assert.equal(answer, 'no');
    nodes(expanded).find(node => (node.props.accessibilityLabel ?? '').includes('Google Maps')).props.onPress();
    assert.equal(mapsOpened, true);
    nodes(expanded).find(node => node.props['aria-expanded'] === true).props.onPress();
    assert.ok(text(render({ ...input, consideration: answer })).includes(inheritance.inheritanceWarning[locale]));
  }
});

test('current cancellation removes the event reminder on rerender without hiding safety guidance', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness();
    const input = props(locale);
    const confirmationCopy = inheritance.getInheritanceNotice(input).reminderText[locale];
    assert.ok(text(render(input)).includes(confirmationCopy));
    const cancelled = render({ ...input, fortyNineCompletion: { ...input.fortyNineCompletion, completed: false } });
    assert.equal(text(cancelled).includes(confirmationCopy), false);
    assert.ok(text(cancelled).includes(inheritance.inheritanceWarning[locale]));
  }
});

test('a non-respondent can read the completed-service notice and support link without being offered answer controls', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness();
    const input = props(locale);
    nodes(render(input)).find(node => node.props['aria-expanded'] === false).props.onPress();
    const tree = render(input);
    assert.ok(text(tree).includes(inheritance.inheritanceWarning[locale]));
    assert.equal(text(tree).includes(locale === 'ja' ? '（任意）' : '(Optional)'), false);
    assert.ok(nodes(tree).some(node => (node.props.accessibilityLabel ?? '').includes('Google Maps')));
  }
});

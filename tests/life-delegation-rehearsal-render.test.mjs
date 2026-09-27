import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import * as domain from '../apps/mobile/src/domain/life-delegation-rehearsal.ts';
import * as catalog from '../apps/mobile/src/data/life-notes.ts';
import * as theme from '../apps/mobile/src/theme.ts';
const source = readFileSync(new URL('../apps/mobile/src/components/LifeDelegationRehearsal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
const nodes = x => Array.isArray(x) ? x.flatMap(nodes) : x && typeof x === 'object' ? [x, ...nodes(x.children ?? [])] : [];
const text = x => Array.isArray(x) ? x.map(text).join('') : x && typeof x === 'object' ? text(x.children ?? []) : typeof x === 'string' || typeof x === 'number' ? String(x) : '';
function harness(locale = 'ja', enabled = true) {
  let index = 0, hooks = [], effects = [];
  const react = { Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useEffect(fn, deps) { const i = index++; if (!hooks[i] || deps.some((d, k) => d !== hooks[i][k])) { effects.push(fn); hooks[i] = deps; } } };
  const native = Object.fromEntries(['View', 'Text', 'Pressable'].map(x => [x, x]));
  native.StyleSheet = { create: x => x };
  const ctx = { exports: {}, React: react, require(id) {
    if (id === 'react') return react; if (id === 'react-native') return native;
    if (id === '../theme') return theme; if (id === '../data/life-notes') return catalog;
    if (id === '../domain/life-delegation-rehearsal') return domain;
    throw Error(id);
  } };
  vm.runInNewContext(compiled, ctx);
  const render = () => { index = 0; const tree = ctx.exports.LifeDelegationRehearsal({ locale, enabled });
    const pending = effects; effects = []; pending.forEach(fn => fn()); return tree; };
  const node = id => nodes(render()).find(n => n.props.testID === id);
  return { render, node, setEnabled(v) { enabled = v; }, setLocale(v) { locale = v; },
    press(id) { const n = node(id); assert.ok(n, `Missing ${id}`); assert.notEqual(n.props.disabled, true, `Disabled ${id}`); n.props.onPress(); } };
}

test('both languages drive grant, selected draft, parent review and confirmation with no real saving', () => {
  for (const locale of ['ja', 'en']) {
    const h = harness(locale);
    h.press('life-start');
    assert.match(text(h.render()), locale === 'ja' ? /仮データ|実際の認証・保存・共有は行いません/ : /Synthetic|No real sign-in, saving or sharing/);
    assert.equal(h.node('life-grant').props.disabled, true);
    h.press('life-select-future-try'); h.press('life-grant');
    h.press('life-role-employee');
    assert.ok(h.node('life-field-future-try'));
    assert.equal(h.node('life-field-future-family'), undefined);
    h.press('life-write-future-try-a');
    assert.match(text(h.node('life-field-future-try')), locale === 'ja' ? /下書き/ : /Employee draft/);
    assert.equal(h.node('life-confirm'), undefined);
    h.press('life-role-parent'); h.press('life-review-future-try');
    assert.ok(h.node('life-review-content'));
    h.press('life-confirm');
    assert.equal(h.node('life-review-future-try'), undefined);
    assert.match(text(h.node('life-field-future-try')), locale === 'ja' ? /確定内容/ : /Confirmed/);
    assert.equal(nodes(h.render()).some(n => n.type === 'TextInput' || n.props.href || n.props.allowFontScaling === false), false);
    for (const n of nodes(h.render()).filter(n => n.type === 'Pressable')) {
      assert.ok(['button', 'radio', 'checkbox'].includes(n.props.accessibilityRole));
      const styles = [n.props.style].flat().filter(Boolean);
      assert.ok(styles.some(s => s.minHeight >= 44));
    }
    h.press('life-end'); assert.ok(h.node('life-start'));
  }
});

test('employee view before approval and after cancellation/expiry contains no private sample records', () => {
  for (const stop of ['life-revoke', 'life-expire']) {
    const h = harness(); h.press('life-start'); h.press('life-role-employee');
    assert.equal(h.node('life-field-future-try'), undefined);
    h.press('life-role-parent'); h.press('life-select-future-try'); h.press('life-grant');
    h.press('life-role-employee'); h.press('life-write-future-try-a'); h.press('life-role-parent');
    if (stop === 'life-expire') h.press('life-scenarios');
    h.press(stop); h.press('life-role-employee');
    assert.equal(h.node('life-field-future-try'), undefined);
    assert.equal(h.node('life-review-content'), undefined);
    h.press('life-role-parent'); assert.ok(h.node('life-review-future-try'));
  }
});

test('a draft changed after review shows conflict, not a misleading confirmation', () => {
  const h = harness(); h.press('life-start'); h.press('life-select-future-try'); h.press('life-grant');
  h.press('life-role-employee'); h.press('life-write-future-try-a');
  h.press('life-role-parent'); h.press('life-review-future-try');
  h.press('life-role-employee'); h.press('life-write-future-try-b');
  h.press('life-role-parent'); h.press('life-confirm');
  assert.equal(h.node('life-error').props.accessibilityRole, 'alert');
  assert.match(text(h.node('life-error')), /更新|changed/);
  assert.ok(h.node('life-review-future-try'));
});

test('qualification loss/restoration and inability to approve keep their explicit boundaries', () => {
  const h = harness(); h.press('life-start'); h.press('life-select-future-try'); h.press('life-grant');
  h.press('life-scenarios'); h.press('life-employee-eligibility'); h.press('life-employee-eligibility');
  h.press('life-role-employee'); assert.equal(h.node('life-field-future-try'), undefined);
  h.press('life-role-parent'); h.press('life-grant');
  h.press('life-role-employee'); h.press('life-write-future-try-b'); h.press('life-role-parent');
  h.press('life-parent-eligibility'); assert.equal(h.node('life-review-future-try').props.disabled, true);
  h.press('life-discard-future-try'); assert.equal(h.node('life-review-future-try'), undefined);
  h.press('life-parent-eligibility'); h.press('life-parent-approval');
  assert.equal(h.node('life-grant').props.disabled, true);
});

test('disabled entry renders nothing and clears session; locale switch does not reset a draft', () => {
  const h = harness('ja', false); assert.equal(h.render(), null);
  h.setEnabled(true); h.press('life-start'); h.press('life-select-future-try'); h.press('life-grant');
  h.press('life-role-employee'); h.press('life-write-future-try-a'); h.setLocale('en');
  assert.match(text(h.node('life-field-future-try')), /Employee draft/);
  h.setEnabled(false); assert.equal(h.render(), null);
  h.setEnabled(true); assert.ok(h.node('life-start'));
});

test('legacy rehearsal is no longer in the product route and remains isolated from persistence or messaging', () => {
  const app = readFileSync(new URL('../apps/mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /LifeDelegationRehearsal|EXPO_PUBLIC_LIFE_REHEARSAL/);
  assert.match(app, /<LifeNotesWorkspace key=\{previewRevision\} locale=\{locale\} port=\{lifePort\}/);
  assert.match(app, /screen === 'life-notes'/);
  assert.doesNotMatch(source, /fetch\s*\(|Linking\.|Share\.|AsyncStorage|localStorage|SecureStore|TextInput|setPreviewAccess/);
  const domainSource = readFileSync(new URL('../apps/mobile/src/domain/life-delegation-rehearsal.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(domainSource, /fetch\s*\(|localStorage|AsyncStorage|Date\.now|setItem\s*\(/);
});

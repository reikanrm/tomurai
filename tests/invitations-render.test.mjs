import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as theme from '../apps/mobile/src/theme.ts';

// Inert native-element handler checks, not actual rendering or real invitation/API coverage.
const source = readFileSync(new URL('../apps/mobile/src/components/FamilyScreen.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
function harness() {
  let hook = 0;
  const state = [];
  const react = {
    Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = hook++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
  };
  const context = { exports: {}, React: react, require(id) {
    if (id === 'react') return react;
    if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: style => style } };
    if (id === '../theme') return theme;
    throw Error(`Unexpected import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return props => { hook = 0; return context.exports.FamilyScreen(props); };
}
const access = { membership: 'active', canManageBilling: true, isRespondent: true, entitlement: 'free', activeMemberCount: 1 };
const props = (locale, changed = {}) => ({ locale, access, onBack() {}, onReviewPlan() {}, ...changed });
const button = (tree, label) => nodes(tree).find(node => node.type === 'Pressable' && text(node) === label);

test('active family members can review preparation; no link, secret, join or success is fabricated', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness(), input = props(locale);
    const initial = render(input);
    assert.ok(text(initial).includes(locale === 'ja' ? '家族一覧・参加申請は、まだ取得できません。' : 'Family members and participation requests cannot be loaded yet.'));
    button(initial, locale === 'ja' ? '招待の準備をする' : 'Prepare an invitation').props.onPress();
    const opened = render(input);
    assert.ok(text(opened).includes(locale === 'ja' ? 'リンクは発行されていません' : 'No invitation link has been issued'));
    assert.ok(text(opened).includes(locale === 'ja' ? '合言葉は別の方法で' : 'Share the passphrase separately'));
    assert.ok(text(opened).includes(locale === 'ja' ? '7日間・1人1回' : 'Seven days · one recipient'));
    assert.ok(text(opened).includes(locale === 'ja' ? 'ノートが自動で公開されることはありません' : 'Notes are never shared automatically'));
    assert.equal(nodes(opened).some(node => node.props.href || node.props.url || node.type === 'TextInput'), false);
    assert.equal(nodes(opened).some(node => node.type === 'Pressable' && /発行しました|送信しました|Joined|Sent successfully/.test(text(node))), false);
    assert.ok(nodes(opened).every(node => node.props.allowFontScaling !== false));
  }
});

test('pending members cannot prepare invitations, inspect requests or open billing', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()(props(locale, { access: { ...access, membership: 'pending', entitlement: 'b2c_solo' } }));
    assert.ok(text(tree).includes(locale === 'ja' ? '参加の承認をお待ちください' : 'Please wait for participation approval'));
    assert.equal(button(tree, locale === 'ja' ? '招待の準備をする' : 'Prepare an invitation'), undefined);
    assert.equal(button(tree, locale === 'ja' ? '参加申請を確認する' : 'Review participation requests'), undefined);
    assert.equal(button(tree, locale === 'ja' ? 'プランを確認する' : 'Review plans'), undefined);
  }
});

test('request review reports unavailable, not zero requests or approved participation', () => {
  for (const locale of ['ja', 'en']) {
    const render = harness(), input = props(locale);
    button(render(input), locale === 'ja' ? '参加申請を確認する' : 'Review participation requests').props.onPress();
    const tree = render(input);
    assert.ok(text(tree).includes(locale === 'ja' ? '申請を取得・承認する機能は準備中です' : 'Loading and approving participation requests is not available yet'));
    assert.equal(nodes(tree).some(node => node.type === 'Pressable' && /承認する|Approve request/.test(text(node))), false);
    assert.doesNotMatch(text(tree), /申請はありません|No requests/);
  }
});

test('solo plan review distinguishes payer and invited member; neither sends or changes plan', () => {
  for (const canManageBilling of [true, false]) {
    let reviewed = 0;
    const render = harness();
    const input = props('ja', { access: { ...access, entitlement: 'b2c_solo', canManageBilling }, onReviewPlan: () => { reviewed++; } });
    const tree = render(input);
    button(tree, canManageBilling ? 'プランを確認する' : '契約者への依頼を確認する').props.onPress();
    assert.equal(reviewed, 1);
    assert.ok(text(tree).includes('招待しただけで料金は変わりません'));
    assert.equal(input.access.entitlement, 'b2c_solo');
  }
});

test('back works and changing to pending hides previously opened sections', () => {
  let back = 0;
  const render = harness();
  const input = props('ja', { onBack: () => { back++; } });
  button(render(input), '招待の準備をする').props.onPress();
  button(render(input), '参加申請を確認する').props.onPress();
  const pending = render({ ...input, access: { ...access, membership: 'pending' } });
  assert.equal(nodes(pending).some(node => node.props.testID === 'invitation-preparation'), false);
  assert.equal(nodes(pending).some(node => node.props.testID === 'participation-unavailable'), false);
  button(pending, '←　ホームへ戻る').props.onPress();
  assert.equal(back, 1);
});

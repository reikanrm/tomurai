import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import * as domain from '../apps/mobile/src/domain/invitation-rehearsal.ts';
import * as theme from '../apps/mobile/src/theme.ts';
const source = readFileSync(new URL('../apps/mobile/src/components/InvitationRehearsal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
const nodes = x => Array.isArray(x) ? x.flatMap(nodes) : x && typeof x === 'object' ? [x, ...nodes(x.children ?? [])] : [];
const text = x => Array.isArray(x) ? x.map(text).join('') : x && typeof x === 'object' ? text(x.children ?? []) : typeof x === 'string' ? x : '';
function harness(locale = 'ja', initialPlan = 'free') {
  let hook = 0, session = null, hooks = [], key, reviews = 0;
  const react = { Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) { const i = hook++; if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], v => { hooks[i] = typeof v === 'function' ? v(hooks[i]) : v; }]; } };
  const native = Object.fromEntries(['Pressable', 'Text', 'TextInput', 'View'].map(x => [x, x]));
  native.StyleSheet = { create: x => x };
  const ctx = { exports: {}, React: react, require(id) {
    if (id === 'react') return react; if (id === 'react-native') return native;
    if (id === '../theme') return theme; if (id === '../domain/invitation-rehearsal') return domain;
    if (id === './AppIcon') return { AppIcon: 'AppIcon' }; throw Error(id);
  } };
  vm.runInNewContext(compiled, ctx);
  const render = () => {
    const nextKey = `${session?.invitation?.id ?? 'start'}:${!!session}`;
    if (key !== nextKey) { key = nextKey; hooks = []; }
    hook = 0;
    return ctx.exports.InvitationRehearsal({ locale, initialPlan, session,
      onStart: entitlement => { session = domain.beginRehearsal({ membership: 'active', activeMemberCount: 1, entitlement }); },
      onCommand: command => { session = domain.rehearsalCommand(session, command, Date.now()); },
      onEnd: () => { session = null; }, onReviewPlan: () => reviews++ });
  };
  return { render, get session() { return session; }, get reviews() { return reviews; },
    press(label) { const node = nodes(render()).find(x => ['button', 'checkbox', 'radio'].includes(x.props.accessibilityRole) && text(x) === label);
      assert.ok(node, `Missing action ${label}`); assert.notEqual(node.props.disabled, true); node.props.onPress(); },
    input(value) { nodes(render()).find(x => x.type === 'TextInput').props.onChangeText(value); } };
}
test('Japanese and English buttons drive the full rehearsal, with explicit local-only notices', () => {
  for (const en of [false, true]) {
    const h = harness(en ? 'en' : 'ja'), t = (ja, english) => en ? english : ja;
    h.press(t('招待の流れを試す', 'Try the invitation flow'));
    assert.ok(text(h.render()).includes(t('実際の送信・ログイン・共有は行いません', 'No real sending, sign-in or sharing')));
    h.press(t('招待を作る', 'Create an invitation'));
    h.press(t('別経路で伝える合言葉を確認', 'View passphrase for a separate channel'));
    assert.ok(text(h.render()).includes(domain.REHEARSAL_PASSPHRASE));
    h.press(t('受け取る側を試す', 'Try the recipient’s view'));
    h.press(t('確認用アカウントでログインする（練習）', 'Sign in with the rehearsal account'));
    h.input('wrong'); h.press(t('参加を申請する', 'Request participation'));
    assert.ok(nodes(h.render()).some(x => x.props.accessibilityRole === 'alert'));
    h.input(domain.REHEARSAL_PASSPHRASE); h.press(t('参加を申請する', 'Request participation'));
    assert.equal(h.session.members.length, 0);
    h.press(t('招待する側へ戻る', 'Return to the inviter’s view'));
    const approve = nodes(h.render()).find(x => x.type === 'Pressable' && text(x) === t('参加を承認する', 'Approve participation'));
    assert.equal(approve.props.disabled, true);
    h.press(t('申請者が招待した相手であることを確認した（練習）', 'I checked this is the intended recipient (rehearsal)'));
    h.press(t('参加を承認する', 'Approve participation'));
    assert.equal(h.session.members.length, 1);
    assert.ok(text(h.render()).includes(t('この端末のみ', 'this device only')));
    assert.equal(nodes(h.render()).some(x => x.props.href || x.props.url || x.props.allowFontScaling === false), false);
    h.press(t('練習を終了してリセット', 'End and clear rehearsal'));
    assert.equal(h.session, null);
  }
});
test('solo rehearsal never changes plans or completes membership; reset offers a new scenario', () => {
  const h = harness('ja', 'b2c_solo');
  for (const label of ['招待の流れを試す', '招待を作る', '受け取る側を試す', '確認用アカウントでログインする（練習）']) h.press(label);
  h.input(domain.REHEARSAL_PASSPHRASE);
  for (const label of ['参加を申請する', '招待する側へ戻る', '申請者が招待した相手であることを確認した（練習）', '参加を承認する']) h.press(label);
  assert.equal(h.session.error, 'plan_change_required');
  assert.equal(h.session.members.length, 0);
  h.press('プランの案内を見る'); assert.equal(h.reviews, 1);
  h.press('この招待を取り消す');
  assert.equal(h.session.invitation.status, 'revoked');
  h.press('新しい招待を作る'); h.press('7日経過を試す');
  assert.ok(text(h.render()).includes('期限切れ'));
});
test('integration isolates rehearsal state and disables the entry without an explicit build flag', () => {
  const app = readFileSync(new URL('../apps/mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const rehearsalEnabled = __DEV__ \|\| process\.env\.EXPO_PUBLIC_INVITATION_REHEARSAL === 'true'/);
  assert.match(app, /rehearsalEnabled && activeMember/);
  assert.match(app, /const changePreview[\s\S]*?setInvitationRehearsal\(null\)/);
  assert.doesNotMatch(source, /fetch\(|Linking\.|Share\.|AsyncStorage|localStorage|setPreviewAccess/);
  const pkg = JSON.parse(readFileSync(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts['build:web'], /--clear/, 'Avoid reusing inlined rehearsal flags from the previous build');
});

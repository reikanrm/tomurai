import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as consultation from '../apps/mobile/src/domain/consultation.ts';
import * as theme from '../apps/mobile/src/theme.ts';

const partner = { id: 'synthetic-consultation', name: { ja: '合成相談先', en: 'Synthetic support' },
  fields: ['law'], regions: ['JP'], permission: 'approved', permissionConfirmedOn: '2026-09-01',
  validFrom: '2026-09-01', validUntil: '2026-09-30', contactVerifiedOn: '2026-09-01',
  contactUrl: 'https://support.example/contact?channel=tomurai' };
const context = { partner, today: '2026-09-26', registered: true, entitled: false };
const input = { sendConsent: true, operationId: 'synthetic-request-1', transportAvailable: true };
const pending = () => consultation.beginConsultation(consultation.initialConsultationState(), context, input);
const receipt = { requestId: input.operationId, recipientPartnerId: partner.id, receiptId: 'synthetic-receipt-1', acceptedAt: '2026-09-26T01:00:00.000Z' };

test('registration is independent of entitlement; valid free and entitled people take separate routes', () => {
  for (const entitled of [false, true]) assert.equal(consultation.consultationRoute({ ...context, registered: false, entitled }), 'registration');
  assert.equal(consultation.consultationRoute(context), 'request');
  assert.equal(consultation.consultationRoute({ ...context, entitled: true }), 'external');
  assert.equal(consultation.externalConsultationUrl(context), null);
  assert.equal(consultation.externalConsultationUrl({ ...context, entitled: true }), partner.contactUrl);
  assert.equal(consultation.consultationRoute({ ...context, partner: { ...partner, permission: 'withdrawn' } }), 'unavailable');
  assert.equal(consultation.consultationRoute({ ...context, today: '2026-10-01' }), 'unavailable');
  assert.equal(consultation.consultationRoute({ ...context, partner: { ...partner, contactUrl: 'javascript:alert(1)' } }), 'unavailable');
});

test('registration consent cannot replace sending consent and the disconnected flow never starts a request', () => {
  const initial = consultation.initialConsultationState();
  for (const sendConsent of [false, undefined]) {
    const result = consultation.beginConsultation(initial, context, { ...input, sendConsent, registrationConsent: true });
    assert.notEqual(result.status, 'pending');
    assert.equal(result.request, null);
  }
  const unavailable = consultation.beginConsultation(initial, context, { ...input, transportAvailable: false });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.request, null);
  for (const patch of [{ registered: false }, { entitled: true }, { today: '2026-10-01' }]) {
    assert.equal(consultation.beginConsultation(initial, { ...context, ...patch }, input).request, null);
  }
  assert.equal(consultation.beginConsultation(initial, context, { ...input, operationId: '' }).request, null);
});

test('request metadata contains only recipient and operation identifiers, with no personal data', () => {
  const state = pending();
  assert.equal(state.status, 'pending');
  assert.deepEqual(state.request, { requestId: input.operationId, recipientPartnerId: partner.id });
  assert.equal(state.sendConsent, true);
  assert.deepEqual(consultation.beginConsultation(state, context, { ...input, operationId: 'duplicate' }), state);
});

test('communication uncertainty and withdrawal cannot trigger automatic retry or claim unsending', () => {
  const state = consultation.markConsultationUncertain(pending());
  assert.equal(state.status, 'uncertain');
  assert.deepEqual(consultation.beginConsultation(state, context, { ...input, operationId: 'retry' }), state);
  const withdrawn = consultation.withdrawConsultationConsent(pending());
  assert.equal(withdrawn.status, 'uncertain');
  assert.equal(withdrawn.sendConsent, false);
  assert.deepEqual(withdrawn.request, state.request);
  assert.deepEqual(consultation.beginConsultation(withdrawn, context, input), withdrawn);
});

test('only a verified matching receipt can mark accepted; no client flag or wrong recipient is sufficient', () => {
  const state = pending();
  assert.notEqual(consultation.recordConsultationReceipt(state, receipt).status, 'accepted');
  assert.notEqual(consultation.recordConsultationReceipt(state, { ...receipt, accepted: true }, () => false).status, 'accepted');
  for (const patch of [{ requestId: 'wrong' }, { recipientPartnerId: 'wrong' }, { receiptId: '' }, { acceptedAt: 'not-a-date' }]) {
    assert.notEqual(consultation.recordConsultationReceipt(state, { ...receipt, ...patch }, () => true).status, 'accepted');
  }
  assert.notEqual(consultation.recordConsultationReceipt(state, receipt, () => { throw Error('verification unavailable'); }).status, 'accepted');
  assert.equal(consultation.recordConsultationReceipt(state, receipt, () => true).status, 'accepted');
  const verified = consultation.recordConsultationReceipt(consultation.markConsultationUncertain(state), receipt, () => true);
  assert.equal(verified.status, 'accepted');
  assert.deepEqual(consultation.beginConsultation(verified, context, input), verified);
  const withdrawn = consultation.withdrawConsultationConsent(verified);
  assert.equal(withdrawn.status, 'accepted');
  assert.equal(withdrawn.sendConsent, false);
  assert.notEqual(consultation.recordConsultationReceipt(consultation.initialConsultationState(), receipt, () => true).status, 'accepted');
});

const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
function harness(openURL = async () => {}) {
  const source = readFileSync(new URL('../apps/mobile/src/components/ConsultationSheet.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  let hookIndex = 0; const state = []; let effects = [];
  const element = (type, props) => ({ type, props, children: props?.children });
  const context = { exports: {}, URL, require: id => {
    if (id === 'react') return {
      useState: initial => { const index = hookIndex++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
      useRef: initial => { const index = hookIndex++; return state[index] ??= { current: initial }; },
      useEffect: (effect, dependencies) => { const index = hookIndex++;
        if (!state[index] || dependencies.some((dependency, i) => dependency !== state[index][i])) {
          state[index] = dependencies; effects.push(effect);
        }
      },
    };
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    if (id === 'react-native') return { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', Linking: { openURL }, StyleSheet: { create: styles => styles } };
    if (id === '../domain/consultation') return consultation;
    if (id === '../theme') return theme;
    throw Error(`Unexpected import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return props => { hookIndex = 0; effects = []; const tree = context.exports.ConsultationSheet(props); effects.forEach(effect => effect()); return tree; };
}

test('the unregistered UI gives an honest registration path without charging or fake success in both languages', () => {
  for (const locale of ['ja', 'en']) {
    const tree = harness()({ ...context, registered: false, locale, onClose: () => {} });
    assert.match(text(tree), locale === 'ja' ? /登録機能は準備中/ : /Registration is not available yet/);
    assert.doesNotMatch(text(tree), /購入|アップグレード|登録しました|Request sent|Registered successfully/);
    assert.equal(nodes(tree).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'link').length, 0);
  }
});

test('free flow requires its own confirmation and ends in unavailable, without a network call or personal input', () => {
  let calls = 0;
  for (const locale of ['ja', 'en']) {
    const render = harness(() => { calls++; }), props = { ...context, locale, onClose: () => {} };
    let tree = render(props);
    const checkbox = nodes(tree).find(node => node.props.accessibilityRole === 'checkbox');
    assert.equal(checkbox.props.accessibilityState.checked, false);
    const confirm = nodes(tree).find(node => node.type === 'Pressable' && node.props.testID === 'consultation-confirm');
    assert.equal(confirm.props.disabled, true);
    checkbox.props.onPress();
    tree = render(props);
    nodes(tree).find(node => node.props.testID === 'consultation-confirm').props.onPress();
    tree = render(props);
    assert.match(text(tree), locale === 'ja' ? /送信していません/ : /Nothing has been sent/);
    assert.doesNotMatch(text(tree), /受け付けました|Request sent/);
    assert.equal(nodes(tree).some(node => node.type === 'TextInput'), false);
  }
  assert.equal(calls, 0);
});

test('entitled external contact is explicit, URL-unmodified, duplicate-safe and failure is not receipt success', async () => {
  const calls = [];
  let reject;
  const render = harness(url => { calls.push(url); return new Promise((_, fail) => { reject = fail; }); });
  const props = { ...context, entitled: true, locale: 'ja', onClose: () => {} };
  let tree = render(props);
  assert.deepEqual(calls, []);
  const link = nodes(tree).find(node => node.props.accessibilityRole === 'link');
  const first = link.props.onPress();
  await link.props.onPress();
  assert.deepEqual(calls, [partner.contactUrl]);
  reject(Error('cannot open'));
  await first;
  tree = render(props);
  assert.match(text(tree), /問い合わせ先を開けませんでした/);
  assert.doesNotMatch(text(tree), /送信しました|受け付けました/);
});

test('confirmation does not carry to another recipient, and invalid listing removes contact actions', () => {
  const render = harness(), props = { ...context, locale: 'ja', onClose: () => {} };
  nodes(render(props)).find(node => node.props.accessibilityRole === 'checkbox').props.onPress();
  const changed = render({ ...props, partner: { ...partner, id: 'different-recipient' } });
  assert.equal(nodes(changed).find(node => node.props.accessibilityRole === 'checkbox').props.accessibilityState.checked, false);
  const expired = render({ ...props, today: '2026-10-01' });
  assert.equal(nodes(expired).some(node => node.props.accessibilityRole === 'link' || node.props.accessibilityRole === 'checkbox'), false);
  assert.match(text(expired), /現在ご利用いただけません/);
});

test('successful external URL handoff is not a receipt and a changed destination requires fresh consent', async () => {
  for (const locale of ['ja', 'en']) {
    const calls = [], render = harness(async url => { calls.push(url); });
    let closes = 0;
    const props = { ...context, entitled: true, locale, onClose: () => { closes++; } };
    const tree = render(props);
    await nodes(tree).find(node => node.props.accessibilityRole === 'link').props.onPress();
    assert.deepEqual(calls, [partner.contactUrl]);
    assert.doesNotMatch(text(render(props)), /送信しました|受け付けました|Request sent|Request received/);
    nodes(tree).find(node => node.type === 'Modal').props.onRequestClose();
    assert.equal(closes, 1);
    const expired = render({ ...props, today: '2026-10-01' });
    assert.equal(nodes(expired).some(node => node.props.accessibilityRole === 'link'), false);
  }
  const render = harness(), props = { ...context, locale: 'ja', onClose: () => {} };
  nodes(render(props)).find(node => node.props.accessibilityRole === 'checkbox').props.onPress();
  const changed = render({ ...props, partner: { ...partner, contactUrl: 'https://new.example/contact' } });
  assert.equal(nodes(changed).find(node => node.props.accessibilityRole === 'checkbox').props.accessibilityState.checked, false);
});

test('leaving the registered request route clears consent even when later returning to the same recipient', () => {
  const render = harness(), props = { ...context, locale: 'ja', onClose: () => {} };
  nodes(render(props)).find(node => node.props.accessibilityRole === 'checkbox').props.onPress();
  assert.equal(nodes(render(props)).find(node => node.props.accessibilityRole === 'checkbox').props.accessibilityState.checked, true);
  render({ ...props, registered: false });
  assert.equal(nodes(render(props)).find(node => node.props.accessibilityRole === 'checkbox').props.accessibilityState.checked, false);
});

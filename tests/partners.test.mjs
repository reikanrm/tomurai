import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as theme from '../apps/mobile/src/theme.ts';
import * as partners from '../apps/mobile/src/domain/partners.ts';
import * as calendar from '../apps/mobile/src/domain/calendar.ts';

// Synthetic fixtures only; these are not real offices or registered listings.
const partner = (id = 'synthetic-alpha', overrides = {}) => ({
  id, name: { ja: '合成アルファ事務所', en: 'Synthetic Alpha Office' },
  fields: ['law'], regions: ['JP-13'], permission: 'approved',
  permissionConfirmedOn: '2026-09-01', validFrom: '2026-09-01', validUntil: '2026-09-30',
  contactUrl: 'https://alpha.example/contact', contactVerifiedOn: '2026-09-01', ...overrides,
});
const options = { field: 'law', region: 'JP-13', today: '2026-09-26', locale: 'ja' };
const select = (records, overrides = {}) => partners.selectPartners(records, { ...options, ...overrides });

test('the production registry has no fabricated partners and zero listings is valid', () => {
  assert.deepEqual(partners.registeredPartners, []);
  assert.deepEqual(select([]), []);
});

test('permission, verification dates and inclusive listing dates must all be confirmed and valid', () => {
  const valid = partner();
  assert.deepEqual(select([valid]), [valid]);
  for (const field of ['permissionConfirmedOn', 'contactVerifiedOn', 'validFrom', 'validUntil']) {
    for (const value of ['', undefined, '2026-02-30', '26-09-01']) {
      assert.deepEqual(select([partner('invalid', { [field]: value })]), [], `${field}: ${value}`);
    }
  }
  for (const permission of ['pending', 'withdrawn', undefined, 'yes']) {
    assert.deepEqual(select([partner('invalid', { permission })]), []);
  }
  for (const field of ['permissionConfirmedOn', 'contactVerifiedOn']) {
    assert.deepEqual(select([partner('future', { [field]: '2026-09-27' })]), []);
  }
  assert.deepEqual(select([valid], { today: '2026-09-01' }), [valid]);
  assert.deepEqual(select([valid], { today: '2026-09-30' }), [valid]);
  assert.deepEqual(select([valid], { today: '2026-08-31' }), []);
  assert.deepEqual(select([valid], { today: '2026-10-01' }), []);
  assert.deepEqual(select([partner('inverted', { validFrom: '2026-09-30', validUntil: '2026-09-01' })]), []);
  assert.deepEqual(select([valid], { today: 'not-a-date' }), []);
});

test('fields and supported region codes match explicitly, with nationwide-only results for an unknown region', () => {
  const local = partner(), national = partner('synthetic-national', { regions: ['JP'] });
  assert.deepEqual(select([local], { field: 'tax' }), []);
  assert.deepEqual(select([local], { region: 'JP-14' }), []);
  assert.deepEqual(select([local, national], { region: undefined }), [national]);
  assert.deepEqual(select([local, national], { region: '' }), [national]);
  assert.deepEqual(select([local, national], { region: 'Tokyo' }), []);
  assert.deepEqual(select([local, national], { region: 'JP-48' }), []);
  assert.deepEqual(select([local, national], { field: 'unsupported' }), []);
  assert.equal(select([partner('multi', { fields: ['law', 'tax'], regions: ['JP-13', 'JP-14'] })], { field: 'tax', region: 'JP-14' }).length, 1);
  for (const patch of [{ fields: [] }, { fields: ['law', 'unsupported'] }, { regions: [] }, { regions: ['JP-99'] }]) {
    assert.deepEqual(select([partner('invalid', patch)]), []);
  }
});

test('only explicit public HTTPS URLs without credentials, local hosts or unusual ports can be listed', () => {
  assert.equal(partners.isSafePartnerUrl('https://alpha.example/contact'), true);
  for (const contactUrl of [undefined, '', 'http://alpha.example', 'javascript:alert(1)', 'data:text/plain,x',
    '//alpha.example', 'https://user:secret@alpha.example', 'https://localhost', 'https://a.localhost',
    'https://127.0.0.1', 'https://127.1', 'https://2130706433', 'https://10.0.0.1', 'https://[::1]',
    'https://service.local', 'https://service.internal', 'https://alpha.example:8443',
    ' https://alpha.example', 'https://alpha.example\n', 'https:\\alpha.example']) {
    assert.equal(partners.isSafePartnerUrl(contactUrl), false, String(contactUrl));
    assert.deepEqual(select([partner('invalid', { contactUrl })]), []);
  }
});

test('names are stable, locale-aware and never a recommendation rank; inputs remain untouched', () => {
  const first = partner('b', { name: { ja: 'あい事務所', en: 'Alpha' } });
  const tied = partner('a', { name: { ja: 'あい事務所', en: 'Alpha' } });
  const last = partner('c', { name: { ja: 'わか事務所', en: 'Zulu' } });
  const records = [last, first, tied], before = structuredClone(records);
  for (const locale of ['ja', 'en']) {
    assert.deepEqual(select(records, { locale }).map(item => item.id), ['a', 'b', 'c']);
    assert.deepEqual(select([...records].reverse(), { locale }).map(item => item.id), ['a', 'b', 'c']);
  }
  assert.deepEqual(records, before);
  for (const patch of [{ id: '' }, { name: { ja: '', en: 'Alpha' } }, { name: { ja: '合成', en: '' } }, { name: null }]) {
    assert.deepEqual(select([partner('invalid', patch)]), []);
  }
  assert.deepEqual(select([partner('duplicate'), partner('duplicate', { permission: 'withdrawn' })]), []);
  assert.deepEqual(select([null, {}, { name: null }]), []);
  assert.deepEqual(select(null), []);
});

const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
function harness() {
  const source = readFileSync(new URL('../apps/mobile/src/components/SpecialistsScreen.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  let hookIndex = 0;
  const state = [];
  const context = { exports: {}, require: id => {
    if (id === 'react') return { useState: initial => {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    } };
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element };
    if (id === 'react-native') return { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } };
    if (id === '../domain/partners') return partners;
    if (id === '../domain/calendar') return calendar;
    if (id === '../theme') return theme;
    throw Error(`Unexpected import: ${id}`);
  } };
  const element = (type, props) => ({ type, props, children: props?.children });
  vm.runInNewContext(compiled, context);
  return props => { hookIndex = 0; return context.exports.SpecialistsScreen(props); };
}

test('zero results show honest empty states and the final Google Maps action in every field in both languages', () => {
  for (const locale of ['ja', 'en']) {
    const calls = [], render = harness();
    const tree = render({ locale, today: options.today, onOpenMap: query => calls.push(query), error: '' });
    const maps = nodes(tree).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'link');
    assert.equal(maps.length, 4);
    assert.equal(nodes(tree).filter(node => node.type === 'Text' && text(node).includes(locale === 'ja' ? 'この分野の掲載パートナーは現在ありません' : 'No listed partners in this field')).length, 4);
    for (const button of maps) {
      assert.match(text(button), locale === 'ja' ? /その他で探す/ : /Find other options/);
      button.props.onPress();
    }
    assert.deepEqual(calls, ['弁護士 司法書士 相続', '税理士 相続', 'グリーフケア カウンセリング', '遺品整理']);
    assert.match(text(tree), locale === 'ja' ? /掲載事業者から掲載料を受け取り/ : /receive listing fees/);
    assert.doesNotMatch(text(tree), /送信しました|Request sent|おすすめ順|Recommended order/);
  }
});

test('a permitted partner appears only in its matching field; consultation passes only the selected listing', () => {
  for (const locale of ['ja', 'en']) {
    const chosen = [], listed = partner();
    const tree = harness()({ locale, partners: [listed], region: 'JP-13', today: options.today,
      onOpenMap: () => {}, onConsult: item => chosen.push(item), error: '' });
    const consultation = nodes(tree).filter(node => node.type === 'Pressable' && (node.props.accessibilityLabel ?? '').includes(listed.name[locale]));
    assert.equal(consultation.length, 1);
    consultation[0].props.onPress();
    assert.deepEqual(chosen, [listed]);
    assert.match(text(tree), locale === 'ja' ? /名称順/ : /name order/);
  }
});

test('missing consultation connection cannot imply success, and map errors remain visible as alerts', () => {
  const render = harness(), listed = partner();
  const props = { locale: 'ja', partners: [listed], region: 'JP-13', today: options.today, onOpenMap: () => {}, error: '地図を開けませんでした' };
  const tree = render(props);
  const button = nodes(tree).find(node => node.type === 'Pressable' && (node.props.accessibilityLabel ?? '').includes(listed.name.ja));
  assert.ok(button);
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.accessibilityState.disabled, true);
  assert.match(text(tree), /相談受付は準備中/);
  assert.ok(nodes(tree).some(node => node.props.accessibilityRole === 'alert' && text(node) === props.error));
  assert.doesNotMatch(text(tree), /送信しました|受け付けました/);
});

test('Maps stays after the list and expanded guidance, and a withdrawn or expired listing disappears on render', () => {
  const render = harness(), listed = partner();
  const props = { locale: 'ja', partners: [listed], region: 'JP-13', today: options.today,
    onOpenMap: () => {}, onConsult: () => {}, error: '' };
  const initial = render(props);
  const hints = nodes(initial).filter(node => node.type === 'Pressable' && typeof node.props['aria-expanded'] === 'boolean');
  assert.equal(hints.length, 4);
  for (const hint of hints) {
    hint.props.onPress();
    const tree = render(props);
    const card = nodes(tree).find(node => node.type === 'View' &&
      Array.isArray(node.children) && node.children.some(child => child?.type === 'Pressable' && child.props.accessibilityRole === 'link') &&
      nodes(node).some(child => child.props['aria-expanded'] === true));
    assert.ok(card);
    assert.equal(card.children.filter(Boolean).at(-1).props.accessibilityRole, 'link');
  }
  const withdrawn = render({ ...props, partners: [partner(listed.id, { permission: 'withdrawn' })] });
  assert.equal(text(withdrawn).includes(listed.name.ja), false);
  const expired = render({ ...props, today: '2026-10-01' });
  assert.equal(text(expired).includes(listed.name.ja), false);
  assert.equal(nodes(expired).filter(node => node.type === 'Pressable' && node.props.accessibilityRole === 'link').length, 4);
});

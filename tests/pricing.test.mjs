import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as theme from '../apps/mobile/src/theme.ts';
import * as rows from '../apps/mobile/src/domain/task-row-layout.ts';
import * as pricing from '../apps/mobile/src/domain/pricing.ts';

test('v2 annual guidance is exactly 15% off twelve unchanged monthly payments, tax included', () => {
  assert.equal(pricing.newSignupPriceVersion, 'b2c-2026-09-26-v2');
  for (const [count, plan, month, year] of [[1, 'solo', 980, 9996], [2, 'family', 1480, 15096]]) {
    const monthly = pricing.getNewSignupPrice(count, 'month');
    const annual = pricing.getNewSignupPrice(count, 'year');
    assert.equal(monthly.amount, month);
    assert.equal(annual.amount, year);
    assert.equal(annual.amount, monthly.amount * 12 * 85 / 100);
    assert.equal(annual.annualDiscountPercent, 15);
    assert.equal(annual.plan, plan);
    assert.equal(annual.version, pricing.newSignupPriceVersion);
    assert.equal(annual.interval, 'year');
    assert.equal(annual.currency, 'JPY');
    assert.equal(annual.taxIncluded, true);
    assert.equal(Number.isSafeInteger(annual.amount), true);
  }
});

test('explicit v1 contract lookup remains 20% off after v2 is selected; catalog and quotes are immutable', () => {
  const existingContract = Object.freeze({ priceVersion: 'b2c-2026-09-26-v1' });
  for (const [plan, monthly, annual] of [['solo', 980, 9408], ['family', 1480, 14208]]) {
    pricing.getNewSignupPrice(plan === 'solo' ? 1 : 2, 'year');
    const quote = pricing.getB2cPrice(existingContract.priceVersion, plan, 'year');
    assert.equal(quote.amount, annual);
    assert.equal(quote.annualDiscountPercent, 20);
    assert.equal(quote.version, existingContract.priceVersion);
    assert.equal(pricing.getB2cPrice(existingContract.priceVersion, plan, 'month').amount, monthly);
    assert.equal(Object.isFrozen(quote), true);
  }
  assert.equal(Object.isFrozen(pricing.b2cPriceCatalog), true);
  for (const version of Object.values(pricing.b2cPriceCatalog)) {
    assert.equal(Object.isFrozen(version), true);
    for (const plan of ['solo', 'family']) assert.equal(Object.isFrozen(version[plan]), true);
  }
  assert.throws(() => { pricing.b2cPriceCatalog['b2c-2026-09-26-v1'].solo.year = 9996; }, TypeError);
  assert.equal(existingContract.priceVersion, 'b2c-2026-09-26-v1');
});

test('unknown or missing versions and malformed terms never fall back to a new contract price', () => {
  for (const version of [undefined, null, '', 'latest', 'b2c-2026-09-26-v3', '__proto__', 'constructor']) {
    assert.equal(pricing.getB2cPrice(version, 'solo', 'year'), null);
  }
  for (const plan of [undefined, null, '', 'corporate', '__proto__']) {
    assert.equal(pricing.getB2cPrice(pricing.newSignupPriceVersion, plan, 'year'), null);
  }
  for (const interval of [undefined, null, '', 'annual', 'constructor']) {
    assert.equal(pricing.getB2cPrice(pricing.newSignupPriceVersion, 'solo', interval), null);
    assert.equal(pricing.getNewSignupPrice(1, interval), null);
  }
});

test('one versus two approved members is the only price boundary and invalid counts have no offer', () => {
  for (const count of [2, 3, 100, 10000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(pricing.getNewSignupPrice(count, 'month').amount, 1480);
    assert.equal(pricing.getNewSignupPrice(count, 'year').amount, 15096);
  }
  for (const count of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, null, '1']) {
    assert.equal(pricing.getNewSignupPrice(count, 'month'), null);
    assert.equal(pricing.getNewSignupPrice(count, 'year'), null);
  }
});

// Execute the sheet's render and handlers with inert native elements. This does
// not claim native layout, screen-reader behavior, or actual Stripe integration.
const compiled = ts.transpileModule(readFileSync('apps/mobile/src/components/AccessGate.tsx', 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function sheetHarness(props) {
  let index = 0;
  const state = [];
  const react = {
    Fragment: 'Fragment',
    createElement: (type, input, ...children) => ({ type, props: input ?? {}, children }),
    useState: initial => {
      const current = index++;
      if (!(current in state)) state[current] = typeof initial === 'function' ? initial() : initial;
      return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value; }];
    },
    useEffect: () => {},
    useId: () => 'pricing-test',
  };
  const native = {
    Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
    StyleSheet: { create: value => value, absoluteFill: {} },
  };
  const svg = { __esModule: true, default: 'Svg', ...Object.fromEntries(['Defs', 'FeGaussianBlur', 'Filter', 'G', 'Line', 'Path', 'Rect', 'Text'].map(name => [name, name])) };
  const imports = {
    react, 'react-native': native, 'react-native-svg': svg,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../theme': theme, '../domain/task-row-layout': rows, '../domain/pricing': pricing,
  };
  const context = { React: react, exports: {}, require: id => { assert.ok(imports[id], id); return imports[id]; } };
  vm.runInNewContext(compiled, context);
  return () => { index = 0; return context.exports.AccessSheet(props); };
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const annualRadio = (tree, locale) => nodes(tree).find(node => node.props.accessibilityRole === 'radio' && text(node).includes(locale === 'ja' ? '年払い' : 'Yearly'));

for (const locale of ['ja', 'en']) {
  test(`new-signup sheet uses the 15% annual price and unchanged monthly price in ${locale}`, () => {
    for (const [activeMemberCount, monthly, yearly] of [[1, '980', '9,996'], [2, '1,480', '15,096'], [100, '1,480', '15,096']]) {
      const render = sheetHarness({ visible: true, locale, action: 'checkout', activeMemberCount, onClose: () => {} });
      const initial = render();
      assert.ok(text(initial).includes(`¥${monthly}`));
      const annual = annualRadio(initial, locale);
      assert.ok(annual);
      annual.props.onPress();
      const selected = render();
      assert.ok(text(selected).includes(`¥${yearly}`), `expected ${yearly}; got ${text(selected)}`);
      assert.ok(text(annualRadio(selected, locale)).includes('15%'));
      assert.equal(annualRadio(selected, locale).props['aria-checked'], true);
      assert.ok(text(selected).includes(locale === 'ja' ? '税込' : 'Tax included'));
      assert.ok(text(selected).includes(locale === 'ja' ? 'ご契約中の料金は変更されません' : 'Existing contract prices are unchanged'));
      for (const old of ['20%', '9,408', '14,208']) assert.equal(text(selected).includes(old), false);
      nodes(selected).find(node => node.props.accessibilityRole === 'radio' && !node.props['aria-checked']).props.onPress();
      assert.ok(text(render()).includes(`¥${monthly}`));
    }
  });

  test(`purchase and request remain disabled and closing has no payment side effect in ${locale}`, () => {
    for (const action of ['checkout', 'request']) {
      let closed = 0;
      const props = Object.freeze({ visible: true, locale, action, activeMemberCount: 2, onClose: () => { closed++; } });
      const render = sheetHarness(props);
      const tree = render();
      const disabled = nodes(tree).filter(node => node.type === 'Pressable' && node.props.disabled);
      assert.equal(disabled.length, 1);
      assert.equal(disabled[0].props.accessibilityState.disabled, true);
      assert.equal(disabled[0].props['aria-disabled'], true);
      assert.equal(disabled[0].props.onPress, undefined);
      assert.ok(text(disabled[0]).includes(locale === 'ja' ? '準備中' : 'not available yet'));
      nodes(tree).find(node => node.props.accessibilityLabel === (locale === 'ja' ? '閉じる' : 'Close')).props.onPress();
      assert.equal(closed, 1);
      assert.equal(props.activeMemberCount, 2);
    }
  });

  test(`unconfirmed member count does not offer a fabricated solo price in ${locale}`, () => {
    const tree = sheetHarness({ visible: true, locale, action: 'checkout', activeMemberCount: 0, onClose: () => {} })();
    assert.equal(text(tree).includes('¥'), false);
    assert.equal(nodes(tree).filter(node => node.props.accessibilityRole === 'radio').length, 0);
    assert.ok(text(tree).includes(locale === 'ja' ? '人数を確認できない' : 'member count could not be confirmed'));
    assert.equal(nodes(tree).find(node => node.props.disabled).props.onPress, undefined);
  });
}

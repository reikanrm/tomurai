import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as care from '../apps/mobile/src/data/care.ts';
import * as theme from '../apps/mobile/src/theme.ts';

// Component wiring/props only. Real Iconoir exports are checked separately;
// native layout and screen-reader output still require device validation.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const react = {
  Fragment: 'Fragment',
  createElement: (type, props, ...children) => typeof type === 'function'
    ? type({ ...props, children }) : { type, props: props ?? {}, children },
  useState: initial => [initial, () => {}],
};
const element = (type, props) => typeof type === 'function'
  ? type(props) : { type, props: props ?? {}, children: props?.children };
function compile(path, dependencies) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, require: id => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx: element, jsxs: element, Fragment: 'Fragment' };
    if (id in dependencies) return dependencies[id];
    throw Error(`Unexpected component import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const native = { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } };
const names = ['EmojiSatisfied', 'EmojiSad', 'EmojiPuzzled', 'EmojiQuite', 'Heart',
  'Book', 'JournalPage', 'BoxIso', 'HomeSimple', 'TaskList', 'Community',
  'CoffeeCup', 'Wind', 'ChatBubbleEmpty', 'Walking', 'EditPencil', 'Check'];
const iconoir = Object.fromEntries(names.map(name => [name, props => ({ type: `Iconoir:${name}`, props, children: [] })]));
function components() {
  const { AppIcon } = compile('../apps/mobile/src/components/AppIcon.tsx', {
    'iconoir-react-native': iconoir, '../theme': theme, 'react-native': native,
  });
  const dependencies = { './AppIcon': { AppIcon }, '../theme': theme, 'react-native': native };
  const { CareActionIcon } = compile('../apps/mobile/src/components/CareActionIcon.tsx', dependencies);
  const { CareMoodIcon } = compile('../apps/mobile/src/components/CareMoodIcon.tsx', dependencies);
  return { AppIcon, CareActionIcon, CareMoodIcon };
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
const iconsIn = tree => nodes(tree).filter(node => typeof node.type === 'string' && node.type.startsWith('Iconoir:'));
const styles = value => Object.assign({}, ...(Array.isArray(value) ? value : [value]).filter(Boolean));
const moodMap = { calm: 'EmojiSatisfied', tearful: 'EmojiSad', unsettled: 'EmojiPuzzled', nothing: 'EmojiQuite', remember: 'Heart' };
const actionMap = { tea: 'CoffeeCup', breath: 'Wind', message: 'ChatBubbleEmpty', move: 'Walking', write: 'EditPencil' };

function decorative(icon) {
  assert.equal(icon.props.accessible, false);
  assert.equal(icon.props['aria-hidden'], true);
  assert.equal(icon.props.focusable, false);
  assert.equal(icon.props.pointerEvents, 'none');
  assert.equal(icon.props.onPress, undefined);
  assert.equal(icon.props.accessibilityLabel, undefined);
  assert.equal(icon.props.strokeWidth, 1.5);
}

test('all five moods use the agreed Iconoir components with stable semantic IDs and decorative 28px artwork', () => {
  const { CareMoodIcon } = components();
  assert.deepEqual(care.careMoods.map(mood => mood.id), Object.keys(moodMap));
  for (const [mood, name] of Object.entries(moodMap)) {
    const rendered = iconsIn(CareMoodIcon({ mood }));
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0].type, `Iconoir:${name}`);
    assert.equal(rendered[0].props.width, 28);
    assert.equal(rendered[0].props.height, 28);
    assert.equal(rendered[0].props.color, theme.colors.ink);
    decorative(rendered[0]);
  }
});

test('all five existing care action APIs use the agreed 26px Iconoir components without adding actions', () => {
  const { CareActionIcon } = components();
  for (const [name, expected] of Object.entries(actionMap)) {
    const rendered = iconsIn(CareActionIcon({ name }));
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0].type, `Iconoir:${expected}`);
    assert.equal(rendered[0].props.width, 26);
    assert.equal(rendered[0].props.height, 26);
    decorative(rendered[0]);
  }
});

test('care renders five named mood controls and the unchanged three actions in both languages', () => {
  const { AppIcon, CareActionIcon, CareMoodIcon } = components();
  const { CareScreen } = compile('../apps/mobile/src/components/CareScreen.tsx', {
    'react-native': native, '../data/care': care, '../theme': theme,
    './CareActionIcon': { CareActionIcon }, './CareMoodIcon': { CareMoodIcon }, './AppIcon': { AppIcon },
  });
  for (const locale of ['ja', 'en']) {
    const tree = CareScreen({ locale, onPause: () => {}, onFindSupport: () => {} });
    assert.equal(iconsIn(tree).length, 10);
    assert.equal(nodes(tree).filter(node => typeof node.props['aria-expanded'] === 'boolean').length, 3);
    for (const mood of care.careMoods) {
      const button = nodes(tree).find(node => node.props.accessibilityLabel === mood.label[locale]);
      assert.ok(button);
      assert.equal(button.props.accessibilityRole, 'button');
      assert.equal(button.props.accessibilityState.selected, false);
      assert.equal(button.props['aria-pressed'], false);
      assert.ok(text(button).includes(mood.label[locale]));
      assert.equal(iconsIn(button)[0].type, `Iconoir:${moodMap[mood.id]}`);
      assert.equal(styles(button.props.style).width, 76);
      assert.equal(styles(button.props.style).minHeight, 108);
      assert.equal(styles(button.props.style).borderRadius, 14);
      assert.ok(nodes(button).some(node => {
        const style = styles(node.props.style);
        return style.width === 40 && style.height === 40 && style.borderRadius === 20;
      }), 'a soft round 40px backdrop surrounds the mood artwork');
      const label = nodes(button).find(node => node.type === 'Text' && text(node) === mood.label[locale]);
      assert.equal(styles(label.props.style).fontSize, 11);
      assert.equal(label.props.numberOfLines, undefined, 'labels must be allowed to grow');
    }
    assert.deepEqual(iconsIn(tree).slice(5).map(node => node.type),
      ['CoffeeCup', 'Wind', 'ChatBubbleEmpty', 'ChatBubbleEmpty', 'Wind'].map(name => `Iconoir:${name}`));
    assert.doesNotMatch(text(tree), /😌|😢|😠|😶|🤍/);
    for (const action of care.selfCareActions) assert.ok(text(tree).includes(action.title[locale]));
  }
});

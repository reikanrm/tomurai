import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as care from '../apps/mobile/src/data/care.ts';
import * as theme from '../apps/mobile/src/theme.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const react = {
  Fragment: 'Fragment',
  createElement: (type, props, ...children) => typeof type === 'function'
    ? type({ ...props, children }) : { type, props: props ?? {}, children },
  useState: initial => [initial, () => {}],
};
function compile(path, dependencies) {
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, require: id => {
    if (id === 'react') return react;
    if (id in dependencies) return dependencies[id];
    throw Error(`Unexpected component import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
function icons() {
  return compile('../apps/mobile/src/components/CareActionIcon.tsx', {
    'react-native-svg': { __esModule: true, default: 'svg', Path: 'path', Circle: 'circle' },
  });
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';

const attributeName = name => name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
const visualAttributes = props => Object.fromEntries(Object.entries(props)
  .filter(([key]) => !['key', 'children', 'accessible', 'aria-hidden', 'focusable', 'style'].includes(key))
  .map(([key, value]) => [key === 'viewBox' ? key : attributeName(key), String(value)]));
const svgTags = source => [...source.matchAll(/<(svg|path|circle)\b([^>]*)>/g)].map(match => ({
  type: match[1],
  props: Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])),
}));

test('all five native care icons have the exact Web SVG geometry, dimensions, stroke, color and opacity', () => {
  const { CareActionIcon } = icons();
  const web = read('../index.html');
  for (const name of ['tea', 'breath', 'message', 'move', 'write']) {
    const source = web.match(new RegExp(`${name}: ` + '`(<svg[\\s\\S]*?</svg>)`'))?.[1];
    assert.ok(source, `Web reference must contain ${name}`);
    const rendered = nodes(CareActionIcon({ name })).map(node => ({ type: node.type, props: visualAttributes(node.props) }));
    assert.deepEqual(rendered, svgTags(source), `${name}: every SVG attribute and child order must match`);
  }
});

test('icons are decorative and do not create extra screen-reader or keyboard targets', () => {
  const { CareActionIcon } = icons();
  for (const name of ['tea', 'breath', 'message', 'move', 'write']) {
    const icon = CareActionIcon({ name });
    assert.equal(icon.props.accessible, false);
    assert.equal(icon.props['aria-hidden'], true);
    assert.equal(icon.props.focusable, false);
    assert.equal(icon.props.onPress, undefined);
    assert.equal(icon.props.accessibilityLabel, undefined);
    assert.equal(icon.props.style.flexShrink, 0);
  }
});

test('care displays the mapped icons in both languages without replacing mood icons or adding actions', () => {
  const { CareActionIcon } = icons();
  const { CareScreen } = compile('../apps/mobile/src/components/CareScreen.tsx', {
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: styles => styles } },
    '../data/care': care,
    '../theme': theme,
    './CareActionIcon': { CareActionIcon },
  });
  const expected = ['tea', 'breath', 'message', 'message', 'breath'];
  for (const locale of ['ja', 'en']) {
    const tree = CareScreen({ locale, onPause: () => {}, onFindSupport: () => {} });
    const renderedIcons = nodes(tree).filter(node => node.type === 'svg');
    assert.equal(renderedIcons.length, expected.length);
    renderedIcons.forEach((node, index) => {
      const normalize = svg => nodes(svg).map(item => ({ type: item.type, props: visualAttributes(item.props) }));
      assert.deepEqual(normalize(node), normalize(CareActionIcon({ name: expected[index] })));
    });
    assert.equal(nodes(tree).filter(node => typeof node.props['aria-expanded'] === 'boolean').length, 3);
    for (const mood of care.careMoods) {
      const button = nodes(tree).find(node => node.props.accessibilityLabel === mood.label[locale]);
      assert.ok(button);
      assert.ok(text(button).includes(mood.icon));
      assert.equal(nodes(button).some(node => node.type === 'svg'), false);
    }
    for (const action of care.selfCareActions) assert.ok(text(tree).includes(action.title[locale]));
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, resolve, sep } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as theme from '../apps/mobile/src/theme.ts';

const require = createRequire(import.meta.url);
const entry = require.resolve('iconoir-react-native');
const packageRoot = dirname(dirname(entry));
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const packageInfo = readJson(resolve(packageRoot, 'package.json'));
const names = ['EmojiSatisfied', 'EmojiSad', 'EmojiPuzzled', 'EmojiQuite', 'Heart',
  'Book', 'JournalPage', 'BoxIso', 'HomeSimple', 'TaskList', 'Community',
  'CoffeeCup', 'Wind', 'ChatBubbleEmpty', 'Walking', 'EditPencil', 'Check'];

// Execute the installed public Iconoir entry and its actual adopted icon modules.
// Only the React / native SVG render boundaries are inert. This is neither a
// snapshot of copied SVG paths nor proof of native layout or screen readers.
const element = (type, props, ...children) => typeof type === 'function'
  ? type({ ...props, children }) : { type, props: props ?? {}, children };
const react = {
  createElement: element,
  createContext: defaults => ({ defaults, Provider: 'ContextProvider' }),
  useContext: context => context.defaults,
  forwardRef: render => props => render(props, null),
};
const svg = { __esModule: true, default: 'Svg', ...Object.fromEntries(
  ['Path', 'Circle', 'Rect', 'G', 'Line', 'Polyline', 'Polygon', 'Ellipse', 'Defs', 'ClipPath', 'Mask'].map(name => [name, name])) };
const cache = new Map();
function loadPackageFile(path) {
  const file = resolve(path);
  assert.ok(file.startsWith(packageRoot + sep), 'test loader stays inside the installed package');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const packageRequire = id => {
    if (id === 'react') return react;
    if (id === 'react-native-svg') return svg;
    assert.ok(id.startsWith('./') || id.startsWith('../'), `Unexpected package dependency ${id}`);
    // The entry eagerly imports the entire library. Non-adopted icons are
    // outside this test and remain absent, so a wrong export mapping fails.
    if (file === entry && !names.includes(basename(id, '.js')) && basename(id, '.js') !== 'IconoirContext') {
      return { __esModule: true, default: undefined };
    }
    return loadPackageFile(resolve(dirname(file), id));
  };
  vm.compileFunction(readFileSync(file, 'utf8'), ['require', 'module', 'exports'], { filename: file })(packageRequire, module, module.exports);
  return module.exports;
}
const actualIcons = loadPackageFile(entry);
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];

function appIcon() {
  const path = new URL('../apps/mobile/src/components/AppIcon.tsx', import.meta.url);
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, require: id => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx: (type, props) => element(type, props), jsxs: (type, props) => element(type, props) };
    if (id === 'iconoir-react-native') return actualIcons;
    if (id === '../theme') return theme;
    throw Error(`Unexpected adapter import: ${id}`);
  } };
  vm.runInNewContext(compiled, context);
  return context.exports.AppIcon;
}

test('mobile pins the MIT Iconoir release and retains the existing peer-compatible native dependencies', () => {
  const mobile = readJson(new URL('../apps/mobile/package.json', import.meta.url));
  const lock = readJson(new URL('../package-lock.json', import.meta.url));
  assert.equal(mobile.dependencies['iconoir-react-native'], '7.12.1');
  assert.equal(packageInfo.version, '7.12.1');
  assert.equal(packageInfo.license, 'MIT');
  assert.match(readFileSync(resolve(packageRoot, 'LICENSE'), 'utf8'), /MIT License/);
  assert.equal(lock.packages['node_modules/iconoir-react-native'].version, '7.12.1');
  assert.match(lock.packages['node_modules/iconoir-react-native'].integrity, /^sha512-/);
  assert.equal(mobile.dependencies.react, '19.2.3');
  assert.equal(mobile.dependencies['react-native'], '0.86.3');
  assert.equal(mobile.dependencies['react-native-svg'], '15.15.4');
  assert.deepEqual(packageInfo.peerDependencies, { react: '18 || 19', 'react-native': '>=0.78.0', 'react-native-svg': '^15.12.0' });
});

test('every adopted name exists in the installed public exports and renders the actual SVG artwork', () => {
  for (const name of names) {
    assert.equal(typeof actualIcons[name], 'function', `${name} must be a real public component`);
    const rendered = actualIcons[name]({ width: 28, height: 28, strokeWidth: 1.5, color: '#232922' });
    assert.equal(rendered.type, 'Svg');
    assert.equal(rendered.props.viewBox, '0 0 24 24');
    assert.ok(nodes(rendered).some(node => node.type === 'Path' && typeof node.props.d === 'string'), `${name} contains real artwork`);
    assert.equal(rendered.props.width, 28);
    assert.equal(rendered.props.height, 28);
  }
});

test('the shared adapter reaches official components with consistent default size, stroke, color and decorative semantics', () => {
  const AppIcon = appIcon();
  for (const name of names) {
    const actual = AppIcon({ name });
    assert.equal(actual.type, 'Svg');
    assert.equal(actual.props.width, 24);
    assert.equal(actual.props.height, 24);
    assert.equal(actual.props.strokeWidth, 1.5);
    assert.equal(actual.props.color, theme.colors.ink);
    assert.equal(actual.props.accessible, false);
    assert.equal(actual.props['aria-hidden'], true);
    assert.equal(actual.props.focusable, false);
    assert.equal(actual.props.pointerEvents, 'none');
    assert.equal(actual.props.accessibilityElementsHidden, true);
    assert.equal(actual.props.importantForAccessibility, 'no-hide-descendants');
    assert.equal(actual.props.strokeLinecap, 'round');
    assert.equal(actual.props.strokeLinejoin, 'round');
    assert.equal(actual.props.onPress, undefined);
    assert.equal(actual.props.accessibilityLabel, undefined);
    const expected = actualIcons[name]({});
    const shape = tree => nodes(tree).filter(node => node.type !== 'Svg').map(node => ({ type: node.type, d: node.props.d }));
    assert.deepEqual(shape(actual), shape(expected), `${name} must not substitute or redraw another icon`);
  }
});

test('size/color/stroke overrides reach Iconoir without introducing an extra accessible target', () => {
  const AppIcon = appIcon();
  const rendered = AppIcon({ name: 'Heart', size: 22, color: theme.colors.green, strokeWidth: 1.75,
    accessible: true, accessibilityLabel: 'Must not be forwarded', onPress: () => {}, pointerEvents: 'auto' });
  assert.equal(rendered.props.width, 22);
  assert.equal(rendered.props.height, 22);
  assert.equal(rendered.props.strokeWidth, 1.75);
  assert.equal(rendered.props.color, theme.colors.green);
  assert.equal(rendered.props.accessible, false);
  assert.equal(rendered.props['aria-hidden'], true);
  assert.equal(rendered.props.focusable, false);
  assert.equal(rendered.props.pointerEvents, 'none', 'decorative SVG cannot capture clicks or pointer focus');
  assert.equal(rendered.props.accessibilityLabel, undefined);
  assert.equal(rendered.props.onPress, undefined);
});

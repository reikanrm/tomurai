import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import * as startup from '../apps/mobile/src/domain/startup.ts';

const source = readFileSync(new URL('../apps/mobile/src/components/StartupEntrance.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
function harness(animate, appState = 'active') {
  const listeners = new Map(), cleanups = [], animations = [];
  let progress, resolve;
  const promise = new Promise(res => { resolve = res; });
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useRef: current => ({ current }),
    useEffect: fn => cleanups.push(fn()) };
  const subscribe = (event, callback) => { listeners.set(event, callback); return { remove: () => listeners.delete(event) }; };
  const native = { AccessibilityInfo: { addEventListener: subscribe, isReduceMotionEnabled: () => promise },
    AppState: { currentState: appState, addEventListener: subscribe }, Easing: { cubic: 'cubic', out: x => x },
    Animated: { View: 'Animated.View', Value: class {
      constructor(value) { this.value = value; progress = this; }
      setValue(value) { this.value = value; }
      interpolate(options) { return options; }
    }, timing(value, options) { const animation = { options, started: false, stopped: false,
      start() { this.started = true; }, stop() { this.stopped = true; } }; animations.push(animation); return animation; } },
  };
  const ctx = { exports: {}, React: react, require: id => id === 'react' ? react : id === 'react-native' ? native : startup };
  vm.runInNewContext(compiled, ctx);
  const tree = ctx.exports.StartupEntrance({ animate, children: 'next screen' });
  return { tree, progress, listeners, animations, resolve, cleanup: () => cleanups.forEach(fn => fn?.()) };
}
test('entrance uses native 320ms opacity and a restrained 8px transform', () => {
  const h = harness(true);
  assert.equal(h.progress.value, 0);
  assert.equal(h.animations[0].started, true);
  assert.equal(h.animations[0].options.duration, 320);
  assert.equal(h.animations[0].options.useNativeDriver, true);
  assert.equal(h.tree.props.style.transform[0].translateY.outputRange.join(','), '8,0');
  h.cleanup();
  assert.equal(h.animations[0].stopped, true);
  assert.equal(h.listeners.size, 0);
});
test('no animation on direct entry; background and reduced motion immediately reveal content', async () => {
  const still = harness(false);
  assert.equal(still.progress.value, 1);
  assert.equal(still.animations.length, 0);
  for (const event of ['change', 'reduceMotionChanged']) {
    const h = harness(true);
    h.listeners.get(event)(event === 'change' ? 'background' : true);
    assert.equal(h.progress.value, 1);
    assert.equal(h.animations[0].stopped, true);
    h.resolve(false);
    await Promise.resolve();
    assert.equal(h.progress.value, 1);
    h.cleanup();
  }
  const background = harness(true, 'background');
  assert.equal(background.progress.value, 1);
  assert.equal(background.animations[0].started, false);
  background.cleanup();
});
test('a late motion query cannot modify the unmounted entrance', async () => {
  const h = harness(true);
  h.cleanup();
  h.resolve(true);
  await Promise.resolve();
  assert.equal(h.progress.value, 0);
  assert.equal(h.listeners.size, 0);
});

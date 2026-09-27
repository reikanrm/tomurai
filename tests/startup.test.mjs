import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as startup from '../apps/mobile/src/domain/startup.ts';
import * as theme from '../apps/mobile/src/theme.ts';
const { createStartupSequence, STARTUP_DELAY_MS, STARTUP_FADE_MS } = startup;

// Synthetic clock/animation ports: these tests do not claim native rendering coverage.
function harness() {
  let now = 0;
  const scheduled = [];
  const fades = [];
  let completions = 0;
  const sequence = createStartupSequence({
    now: () => now,
    schedule(callback, delayMs) {
      const timer = { callback, due: now + delayMs, cancelled: false };
      scheduled.push(timer);
      return () => { timer.cancelled = true; };
    },
    fade(callback) {
      const animation = { callback, cancelled: false };
      fades.push(animation);
      return () => { animation.cancelled = true; };
    },
    onComplete() { completions++; },
  });
  return {
    sequence, scheduled, fades,
    get completions() { return completions; },
    advance(ms) {
      now += ms;
      for (const timer of scheduled.filter(item => !item.cancelled && item.due <= now)) {
        timer.cancelled = true;
        timer.callback();
      }
    },
  };
}
const active = { active: true, screenReader: false, reduceMotion: false };

test('startup uses three seconds then a brief fade, completing exactly once', () => {
  const h = harness();
  assert.equal(STARTUP_DELAY_MS, 3_000);
  assert.ok(STARTUP_FADE_MS > 0 && STARTUP_FADE_MS <= 400);
  h.sequence.update(active);
  h.advance(2_999);
  assert.equal(h.fades.length, 0);
  h.advance(1);
  assert.equal(h.fades.length, 1);
  assert.equal(h.completions, 0);
  h.fades[0].callback();
  h.fades[0].callback();
  h.sequence.continue();
  h.sequence.update(active);
  assert.equal(h.completions, 1);
});

test('unknown or enabled screen reader never starts an automatic countdown', () => {
  for (const screenReader of [null, true]) {
    const h = harness();
    h.sequence.update({ ...active, screenReader });
    h.advance(60_000);
    assert.equal(h.scheduled.length, 0);
    assert.equal(h.completions, 0);
    h.sequence.continue();
    h.fades[0].callback();
    assert.equal(h.completions, 1);
  }
});

test('late accessibility resolution starts a full three seconds, not from mount time', () => {
  const h = harness();
  h.sequence.update({ ...active, screenReader: null });
  h.advance(20_000);
  h.sequence.update(active);
  h.advance(2_999);
  assert.equal(h.fades.length, 0);
  h.advance(1);
  assert.equal(h.fades.length, 1);
});

test('background time is excluded and stale cancelled timers cannot advance', () => {
  const h = harness();
  h.sequence.update(active);
  h.advance(1_000);
  h.sequence.update({ ...active, active: false });
  assert.equal(h.scheduled[0].cancelled, true);
  h.advance(30_000);
  h.scheduled[0].callback();
  assert.equal(h.fades.length, 0);
  h.sequence.update(active);
  h.advance(1_999);
  assert.equal(h.fades.length, 0);
  h.advance(1);
  assert.equal(h.fades.length, 1);
});

test('backgrounding during fade cancels it and resumes safely without another delay', () => {
  const h = harness();
  h.sequence.update(active);
  h.advance(3_000);
  h.sequence.update({ ...active, active: false });
  assert.equal(h.fades[0].cancelled, true);
  h.fades[0].callback();
  assert.equal(h.completions, 0);
  h.sequence.continue();
  assert.equal(h.completions, 0);
  h.sequence.update(active);
  assert.equal(h.fades.length, 2);
  h.fades[1].callback();
  assert.equal(h.completions, 1);
});

test('enabling screen reader cancels countdown and fade without automatic completion', () => {
  for (const elapsed of [1_000, 3_000]) {
    const h = harness();
    h.sequence.update(active);
    h.advance(elapsed);
    h.sequence.update({ ...active, screenReader: true });
    h.advance(10_000);
    for (const animation of h.fades) animation.callback();
    assert.equal(h.completions, 0);
    h.sequence.continue();
    h.fades.at(-1).callback();
    assert.equal(h.completions, 1);
  }
});

test('reduced or unknown motion setting advances without fade', () => {
  for (const reduceMotion of [true, null]) {
    const h = harness();
    h.sequence.update({ ...active, reduceMotion });
    h.advance(3_000);
    assert.equal(h.fades.length, 0);
    assert.equal(h.completions, 1);
  }
});

test('enabling reduced motion while fading cancels animation and completes once', () => {
  const h = harness();
  h.sequence.update(active);
  h.advance(3_000);
  h.sequence.update({ ...active, reduceMotion: true });
  assert.equal(h.fades[0].cancelled, true);
  h.fades[0].callback();
  assert.equal(h.completions, 1);
});

test('manual continue cancels countdown and fades exactly once before completing', () => {
  const h = harness();
  h.sequence.update(active);
  h.sequence.continue();
  h.sequence.continue();
  assert.equal(h.scheduled[0].cancelled, true);
  h.scheduled[0].callback();
  h.advance(10_000);
  assert.equal(h.fades.length, 1);
  assert.equal(h.completions, 0);
  h.fades[0].callback();
  h.fades[0].callback();
  assert.equal(h.completions, 1);
});

test('manual fade pauses in background and reduced motion can finish it immediately', () => {
  const h = harness();
  h.sequence.update(active);
  h.sequence.continue();
  h.sequence.update({ ...active, active: false });
  assert.equal(h.fades[0].cancelled, true);
  h.fades[0].callback();
  assert.equal(h.completions, 0);
  h.sequence.update({ ...active, reduceMotion: true });
  assert.equal(h.completions, 1);
});

test('manual completion reports whether entrance animation is safe', () => {
  for (const conditions of [active, { ...active, reduceMotion: true }, { ...active, screenReader: null }]) {
    const calls = [];
    let finish;
    const s = createStartupSequence({ now: () => 0, schedule: () => () => {}, fade: cb => { finish = cb; return () => {}; }, onComplete: animated => calls.push(animated) });
    s.update(conditions);
    s.continue();
    finish?.();
    assert.deepEqual(calls, [conditions.reduceMotion === false]);
  }
});

test('unmount clears countdown or fade; late callbacks cannot invoke onComplete', () => {
  for (const elapsed of [1_000, 3_000]) {
    const h = harness();
    h.sequence.update(active);
    h.advance(elapsed);
    h.sequence.dispose();
    h.sequence.dispose();
    for (const timer of h.scheduled) { assert.equal(timer.cancelled, true); timer.callback(); }
    for (const animation of h.fades) { assert.equal(animation.cancelled, true); animation.callback(); }
    h.sequence.update(active);
    h.sequence.continue();
    assert.equal(h.completions, 0);
  }
});

test('unchanged conditions do not restart the countdown or fade', () => {
  const h = harness();
  h.sequence.update(active);
  h.advance(1_000);
  h.sequence.update({ ...active });
  h.advance(2_000);
  h.sequence.update({ ...active });
  assert.equal(h.scheduled.length, 1);
  assert.equal(h.fades.length, 1);
});

// Executes component effects/handlers against deterministic native ports, not a
// renderer or device. Native visual layout and VoiceOver/TalkBack remain separate QA.
const componentSource = readFileSync(new URL('../apps/mobile/src/components/StartupIntro.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(componentSource, {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
}).outputText;
const descendants = value => Array.isArray(value) ? value.flatMap(descendants)
  : value && typeof value === 'object' ? [value, ...descendants(value.children ?? [])] : [];
const content = value => Array.isArray(value) ? value.map(content).join('')
  : value && typeof value === 'object' ? content(value.children ?? []) : typeof value === 'string' ? value : '';
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function componentHarness() {
  let now = 0, hookIndex = 0;
  const hooks = [], cleanups = [], effects = [], timers = [], animations = [];
  const listeners = new Map();
  const reader = deferred(), motion = deferred();
  const subscribe = (event, callback) => {
    listeners.set(event, callback);
    return { remove: () => listeners.delete(event) };
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef(value) {
      const index = hookIndex++;
      return hooks[index] ??= { current: value };
    },
    useState(initial) {
      const index = hookIndex++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], value => { hooks[index] = value; }];
    },
    useEffect(callback) {
      const index = hookIndex++;
      if (!(index in hooks)) { hooks[index] = true; effects.push(callback); }
    },
  };
  const native = {
    View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    StyleSheet: { create: styles => styles },
    Easing: { ease: 'ease', inOut: value => value },
    AppState: { currentState: 'active', addEventListener: subscribe },
    AccessibilityInfo: {
      addEventListener: subscribe,
      isScreenReaderEnabled: () => reader.promise,
      isReduceMotionEnabled: () => motion.promise,
    },
    Animated: {
      View: 'Animated.View',
      Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } },
      timing(value, options) {
        const animation = {
          value, options, stopped: false,
          start(callback) { this.callback = callback; },
          stop() { this.stopped = true; this.callback?.({ finished: false }); },
          finish() { value.setValue(options.toValue); this.callback({ finished: true }); },
        };
        animations.push(animation);
        return animation;
      },
    },
  };
  const context = {
    React: react, exports: {}, performance: { now: () => now },
    setTimeout(callback, delay) {
      const timer = { callback, due: now + delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) { timer.cancelled = true; },
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') return native;
      if (id === '../domain/startup') return startup;
      if (id === '../theme') return theme;
      if (id === './EnsoProgress') return { EnsoProgress: 'EnsoProgress' };
      throw Error(`Unexpected import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context);
  return {
    reader, motion, listeners, animations, timers,
    render(props) {
      hookIndex = 0;
      const tree = context.exports.StartupIntro(props);
      for (const callback of effects.splice(0)) cleanups.push(callback());
      return tree;
    },
    advance(ms) {
      now += ms;
      for (const timer of timers.filter(item => !item.cancelled && item.due <= now)) {
        timer.cancelled = true;
        timer.callback();
      }
    },
    unmount() { for (const cleanup of cleanups.splice(0)) cleanup(); },
  };
}

test('component exposes only brand, short copy and an accessible manual action in both locales', () => {
  for (const locale of ['ja', 'en']) {
    const h = componentHarness();
    let completions = 0;
    const tree = h.render({ locale, onComplete: () => { completions++; } });
    assert.ok(content(tree).includes('Tomurai'));
    assert.ok(content(tree).includes(locale === 'ja' ? '必要なことをひとつずつ。' : 'One thing at a time.'));
    const logo = descendants(tree).find(node => node.type === 'EnsoProgress');
    assert.equal(logo.props.appearance, 'brand');
    assert.equal(logo.props.label, '');
    assert.ok(descendants(tree).every(node => node.props.allowFontScaling !== false));
    const action = descendants(tree).find(node => node.type === 'Pressable');
    assert.equal(action.props.accessibilityRole, 'button');
    assert.equal(content(action), locale === 'ja' ? '続ける' : 'Continue');
    action.props.onPress();
    assert.equal(completions, 1);
    h.unmount();
  }
  const onboarding = readFileSync(new URL('../apps/mobile/src/components/Onboarding.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(onboarding, /必要なことを、\\nひとつずつ。/);
});

test('component waits for accessibility, uses native fade and latest callback without flashing back', async () => {
  const h = componentHarness();
  let oldCalls = 0, newCalls = 0;
  h.render({ locale: 'ja', onComplete: () => { oldCalls++; } });
  h.advance(10_000);
  assert.equal(h.timers.length, 0);
  h.reader.resolve(false);
  h.motion.resolve(false);
  await Promise.resolve();
  const tree = h.render({ locale: 'ja', onComplete: () => { newCalls++; } });
  assert.ok(content(tree).includes('スキップ'));
  h.advance(3_000);
  assert.equal(h.animations.length, 1);
  assert.equal(h.animations[0].options.duration, STARTUP_FADE_MS);
  assert.equal(h.animations[0].options.useNativeDriver, true);
  h.animations[0].finish();
  assert.equal(oldCalls, 0);
  assert.equal(newCalls, 1);
  assert.equal(h.animations[0].value.value, 0);
  h.unmount();
  assert.equal(h.listeners.size, 0);
});

test('newer screen-reader/motion events win over stale initial asynchronous results', async () => {
  const h = componentHarness();
  let completions = 0;
  const props = { locale: 'ja', onComplete: () => { completions++; } };
  h.render(props);
  h.listeners.get('screenReaderChanged')(true);
  h.listeners.get('reduceMotionChanged')(true);
  h.reader.resolve(false);
  h.motion.resolve(false);
  await Promise.resolve();
  h.advance(10_000);
  assert.equal(h.timers.length, 0);
  assert.ok(content(h.render(props)).includes('続ける'));
  h.listeners.get('screenReaderChanged')(false);
  h.advance(3_000);
  assert.equal(h.animations.length, 0);
  assert.equal(completions, 1);
  h.unmount();
});

test('failed accessibility query stays manual and late queries after unmount cannot schedule work', async () => {
  const h = componentHarness();
  let completions = 0;
  const props = { locale: 'en', onComplete: () => { completions++; } };
  h.render(props);
  h.reader.reject(Error('synthetic unavailable accessibility service'));
  h.motion.reject(Error('synthetic unavailable accessibility service'));
  await Promise.resolve();
  await Promise.resolve();
  h.advance(10_000);
  assert.equal(h.timers.length, 0);
  descendants(h.render(props)).find(node => node.type === 'Pressable').props.onPress();
  assert.equal(completions, 1);
  h.unmount();
  const late = componentHarness();
  late.render(props);
  late.unmount();
  late.reader.resolve(false);
  late.motion.resolve(false);
  await Promise.resolve();
  assert.equal(late.timers.length, 0);
  assert.equal(late.listeners.size, 0);
});

test('component AppState subscription pauses/resumes remaining time and unmount cancels timers', async () => {
  const h = componentHarness();
  h.render({ locale: 'ja', onComplete() { assert.fail('Unmounted startup must not complete'); } });
  h.reader.resolve(false);
  h.motion.resolve(false);
  await Promise.resolve();
  h.advance(1_000);
  h.listeners.get('change')('background');
  h.advance(20_000);
  assert.equal(h.animations.length, 0);
  h.listeners.get('change')('active');
  h.advance(1_999);
  assert.equal(h.animations.length, 0);
  h.unmount();
  h.advance(1);
  assert.equal(h.animations.length, 0);
  assert.equal(h.listeners.size, 0);
  assert.ok(h.timers.every(timer => timer.cancelled));
});

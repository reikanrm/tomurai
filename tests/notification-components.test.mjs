import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as theme from '../apps/mobile/src/theme.ts';

// Effects and handlers only, with deterministic native ports. Not a device renderer.
function harness(file) {
  const source = readFileSync(new URL(`../apps/mobile/src/components/${file}.tsx`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
  let hook = 0, now = 0, resolveReader, rejectReader;
  const hooks = [], effects = [], timers = [], listeners = new Map();
  const reader = new Promise((resolve, reject) => { resolveReader = resolve; rejectReader = reject; });
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef(initial) { const index = hook++; return hooks[index] ??= { current: initial }; },
    useState(initial) {
      const index = hook++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], next => { hooks[index] = next; }];
    },
    useEffect(callback, deps) {
      const index = hook++, previous = hooks[index];
      if (!previous || deps.some((value, position) => value !== previous.deps[position])) {
        previous?.cleanup?.();
        hooks[index] = { deps };
        effects.push(() => { hooks[index].cleanup = callback(); });
      }
    },
  };
  const native = {
    View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: styles => styles },
    AccessibilityInfo: {
      isScreenReaderEnabled: () => reader,
      addEventListener: (event, callback) => { listeners.set(event, callback); return { remove: () => listeners.delete(event) }; },
    },
  };
  const context = {
    exports: {}, React: react,
    setTimeout(callback, delay) { const timer = { callback, due: now + delay, cancelled: false }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.cancelled = true; },
    require(id) {
      if (id === 'react') return react;
      if (id === 'react-native') return native;
      if (id === 'react-native-svg') return { default: 'Svg', Path: 'Path' };
      if (id === '../theme') return theme;
      throw Error(`Unexpected import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context);
  return {
    timers, listeners, resolveReader, rejectReader,
    render(name, props) { hook = 0; const tree = context.exports[name](props); for (const effect of effects.splice(0)) effect(); return tree; },
    advance(ms) {
      now += ms;
      for (const timer of timers.filter(item => !item.cancelled && item.due <= now)) { timer.cancelled = true; timer.callback(); }
    },
    unmount() { for (const value of hooks) value?.cleanup?.(); },
  };
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';

test('completion prefers newer screen-reader event over stale initial response', async () => {
  const h = harness('CompletionMessage');
  let closed = 0;
  const props = { locale: 'ja', onClose: () => { closed++; }, onDisable() {} };
  h.render('CompletionMessage', props);
  h.listeners.get('screenReaderChanged')(true);
  h.render('CompletionMessage', props);
  h.resolveReader(false);
  await Promise.resolve();
  h.render('CompletionMessage', props);
  h.advance(60_000);
  assert.equal(closed, 0);
  assert.equal(h.timers.length, 0);
  h.unmount();
  assert.equal(h.listeners.size, 0);
});

test('completion rerender does not extend timer and invokes the latest close callback', async () => {
  const h = harness('CompletionMessage');
  let oldCalls = 0, newCalls = 0;
  const props = { locale: 'ja', onClose: () => { oldCalls++; }, onDisable() {} };
  h.render('CompletionMessage', props);
  h.resolveReader(false);
  await Promise.resolve();
  h.render('CompletionMessage', props);
  h.advance(5_000);
  h.render('CompletionMessage', { ...props, locale: 'en', onClose: () => { newCalls++; } });
  assert.equal(h.timers.length, 1);
  h.advance(1_000);
  assert.equal(oldCalls, 0);
  assert.equal(newCalls, 1);
  h.unmount();
});

test('completion cleanup makes an already queued timer harmless after unmount', async () => {
  const h = harness('CompletionMessage');
  let closed = 0;
  const props = { locale: 'ja', onClose: () => { closed++; }, onDisable() {} };
  h.render('CompletionMessage', props);
  h.resolveReader(false); await Promise.resolve();
  h.render('CompletionMessage', props);
  const timer = h.timers[0];
  h.unmount();
  assert.equal(timer.cancelled, true);
  timer.callback();
  assert.equal(closed, 0);
});

test('unknown/failed detection remains manual; later enabling reader cancels automatic dismissal', async () => {
  const failed = harness('CompletionMessage');
  let closed = 0, disabled = 0;
  const props = { locale: 'en', onClose: () => { closed++; }, onDisable: () => { disabled++; } };
  failed.render('CompletionMessage', props);
  failed.rejectReader(Error('synthetic unavailable service'));
  await Promise.resolve(); await Promise.resolve();
  const tree = failed.render('CompletionMessage', props);
  failed.advance(60_000);
  assert.equal(closed, 0);
  nodes(tree).find(node => node.type === 'Pressable' && text(node) === 'Dismiss').props.onPress();
  nodes(tree).find(node => node.type === 'Pressable' && text(node) === 'Hide for this session').props.onPress();
  assert.equal(closed, 1); assert.equal(disabled, 1);
  failed.unmount();
  const enabled = harness('CompletionMessage');
  enabled.render('CompletionMessage', props);
  enabled.resolveReader(false); await Promise.resolve();
  enabled.render('CompletionMessage', props);
  enabled.listeners.get('screenReaderChanged')(true);
  enabled.render('CompletionMessage', props);
  enabled.advance(60_000);
  assert.equal(closed, 1);
  enabled.unmount();
});

const own = { id: 'synthetic-own', ownerId: 'self', date: '2026-09-26', read: false };
const other = { ...own, id: 'synthetic-other', ownerId: 'other' };
test('unavailable, omitted and failed notification sources never report zero or expose stale rows', () => {
  for (const locale of ['ja', 'en']) for (const sourceState of [undefined, 'unavailable', 'error']) {
    const h = harness('NotificationScreen');
    const tree = h.render('NotificationScreen', { locale, sourceState, userId: 'self', items: [own], onRead() { assert.fail('No stale read actions'); }, onBack() {} });
    assert.doesNotMatch(text(tree), /新しいお知らせはありません|No new notifications/);
    assert.equal(text(tree).includes(own.date), false);
    assert.ok(text(tree).includes(sourceState === 'error'
      ? locale === 'ja' ? '読み込めませんでした' : 'could not be loaded'
      : locale === 'ja' ? 'お知らせ一覧は準備中' : 'notification list is not available yet'));
    const bell = h.render('NotificationButton', { locale, sourceState, unread: 0, onPress() {} });
    assert.doesNotMatch(bell.props.accessibilityLabel, /未読0件|0 unread/);
  }
});

test('only a loaded list has empty state and owner-specific read actions', () => {
  const h = harness('NotificationScreen');
  const calls = [];
  const props = { locale: 'ja', sourceState: 'loaded', userId: 'self', items: [], onRead: id => calls.push(id), onBack() {} };
  assert.ok(text(h.render('NotificationScreen', props)).includes('新しいお知らせはありません'));
  const tree = h.render('NotificationScreen', { ...props, items: [own, other] });
  nodes(tree).filter(node => node.type === 'Pressable' && text(node).includes(own.date)).forEach(node => node.props.onPress());
  assert.deepEqual(calls, [own.id]);
  const bell = h.render('NotificationButton', { locale: 'en', sourceState: 'loaded', unread: 2, onPress() {} });
  assert.match(bell.props.accessibilityLabel, /2 unread/);
});

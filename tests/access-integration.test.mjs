import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-wiring regression checks only. These do not execute React, inspect native
// accessibility trees, or prove server authorization. See access.test.mjs for
// executable selector cases and the recorded Android checks for UI evidence.
const app = readFileSync('apps/mobile/src/App.tsx', 'utf8');
const menu = readFileSync('apps/mobile/src/components/DevelopmentMenu.tsx', 'utf8');

test('access wiring: development entry, menu and mutation are guarded, not enabled by a URL', () => {
  assert.match(app, /resolveAccess\(previewAccess, __DEV__\)/);
  assert.match(app, /\{__DEV__ && <DevelopmentButton/);
  assert.match(app, /\{__DEV__ && developmentOpen && <DevelopmentMenu/);
  assert.match(app, /const changePreview = [\s\S]*?if \(!__DEV__\) return;/);
  assert.equal((menu.match(/if \(!__DEV__\) return null;/g) ?? []).length, 2);
  const queryFields = [...app.matchAll(/query\.get\('([^']+)'\)/g)].map(match => match[1]);
  assert.deepEqual(queryFields, ['screen', 'lang']);
  assert.doesNotMatch(menu, /AsyncStorage|localStorage|SecureStore|Linking|fetch\(/);
});

test('access wiring: first confirmation fixes task IDs and later confirmations retain them', () => {
  assert.match(app, /useState<readonly string\[\] \| null>\(null\)/);
  assert.match(app, /setFreeTaskIds\(current => freezeFreeTaskIds\(deriveGuidanceTasks\(nextPlan\), current\)\)/);
  assert.match(app, /activeMember && \(screen === 'home' \|\| screen === 'tasks'\) && freeTaskIds === null/);
  assert.doesNotMatch(app, /setFreeTaskIds\(null\)/);
});

test('access wiring: home, task filters, progress and details use only the access projection', () => {
  assert.match(app, /const visibleTasks = taskAccess\.visibleTasks;/);
  assert.match(app, /visibleTasks\.filter\(task => !task\.done\)\.slice\(0, 3\)\.map\(renderTask\)/);
  assert.match(app, /visibleTasks\.filter\(task => filter === 'all'/);
  assert.match(app, /const selected = visibleTasks\.find\(task => task\.id === selectedId\)/);
  assert.match(app, /const doneCount = visibleTasks\.filter\(task => task\.done\)\.length/);
  assert.match(app, /<EnsoProgress completed=\{doneCount\} total=\{visibleTasks\.length\}/);
  assert.doesNotMatch(app, /\btasks\.(?:map|filter)\([\s\S]*?\.map\(renderTask\)/);
});

test('access wiring: opening and updating task details are guarded by the current projection', () => {
  assert.match(app, /const openTask = [\s\S]*?if \(!visibleTasks\.some\(visible => visible\.id === task\.id\)\) return;/);
  assert.match(app, /const updateTask = [\s\S]*?if \(!selected\) return;/);
  assert.match(app, /<Modal visible=\{!!selected\}/);
});

test('access wiring: changing preview closes task, pause and purchase state before applying it', () => {
  const change = app.slice(app.indexOf('const changePreview ='), app.indexOf('const renderTask ='));
  for (const reset of ['setSelectedId(null)', 'setAssignee(null)', 'setPause(false)', 'setAccessSheetOpen(false)', 'setDevelopmentOpen(false)']) {
    assert.ok(change.includes(reset), reset);
  }
  assert.doesNotMatch(change, /setFreeTaskIds/);
  assert.match(change, /setPreviewRevision\(current => current \+ 1\)/);
  assert.match(app, /<Onboarding key=\{previewRevision\}/);
  assert.match(app, /<GuidanceSettings key=\{previewRevision\}/);
  assert.match(app, /<ModalBackground hidden=\{!!selected \|\| pause \|\| developmentOpen \|\| accessSheetOpen\}/);
});

test('access wiring: preparation sheets cannot charge, send or grant access', () => {
  const gate = readFileSync('apps/mobile/src/components/AccessGate.tsx', 'utf8');
  assert.doesNotMatch(gate, /Linking|fetch\(|https:\/\/buy|setPreviewAccess|setEntitlement/);
  assert.match(gate, /決済の準備中/);
  assert.match(gate, /送信の準備中/);
  assert.equal((gate.match(/disabled accessibilityState=\{\{ disabled: true \}\}/g) ?? []).length, 2);
  assert.match(gate, /importantForAccessibility="no-hide-descendants" aria-hidden/);
  assert.match(gate, /FeGaussianBlur/);
});

test('access wiring: no task content is passed to locked decoration', () => {
  const gate = app.match(/<LockedTasks\s+[\s\S]*?\/>/g) ?? [];
  assert.equal(gate.length, 1);
  assert.match(gate[0], /locale=\{locale\} action=\{action\} onPress=/);
  assert.doesNotMatch(gate[0], /\btasks?\s*=|\b(?:title|description|date|count|assignee|progress|children)\s*=/);
  assert.match(app, /taskAccess\.hasLocked && action \? <LockedTasks/);
});

test('locked background uses public task text and the normal row geometry without stretching', () => {
  const gate = readFileSync('apps/mobile/src/components/AccessGate.tsx', 'utf8');
  assert.match(gate, /taskRowMetrics as row, publicPreviewTitles, wrapPreviewTitle, rowHeightFromLines/);
  assert.match(app, /taskRowMetrics as row/);
  assert.match(gate, /onLayout=\{event => setWidth\(event\.nativeEvent\.layout\.width\)\}/);
  assert.match(gate, /<Svg width=\{width\} height=\{backgroundHeight\}/);
  assert.doesNotMatch(gate, /preserveAspectRatio="none"/);
  assert.match(gate, /<SvgText[\s\S]*?fontFamily=\{fonts\.medium\} fontSize=\{row\.titleFontSize\}/);
  assert.match(gate, /日付は個別に確認/);
  assert.match(gate, /担当：未割当/);
  assert.match(gate, /pointerEvents="none" accessible=\{false\}/);
  assert.match(app, /itemTitle: \{ fontFamily: fonts\.medium, fontSize: row\.titleFontSize/);
});

test('access wiring: answer ownership is enforced separately and pending safety guidance is generic', () => {
  assert.match(app, /const canAnswer = canEditAnswers\(access\)/);
  assert.match(app, /screen === 'onboarding' && canAnswer && <Onboarding/);
  assert.match(app, /screen === 'guidance' && canAnswer && <GuidanceSettings/);
  assert.match(app, /deathDate=\{activeMember \? plan\.deathDate : ''\}/);
  assert.match(app, /consideration=\{activeMember \? plan\.inheritance : 'unknown'\}/);
  assert.match(app, /onConsiderationChange=\{canAnswer \?/);
  assert.match(app, /screen === 'specialists' && <SpecialistsScreen/);
  assert.match(app, /screen === 'care' && <>/);
});

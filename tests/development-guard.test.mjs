import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync, existsSync, symlinkSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/check-development.mjs', import.meta.url));
const canonical = '.agents/skills/tomurai-development/SKILL.md';
const adapter = '.claude/skills/tomurai-development/SKILL.md';
const metadata = '.agents/skills/tomurai-development/agents/openai.yaml';
const contract = 'docs/development/changes/TOM-67.json';
const evidence = 'docs/development/evidence/TOM-67.md';
const document = 'docs/ssot/example.md';
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GITHUB_') && !key.toUpperCase().startsWith('GIT_')));
function write(root, path, body) { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), body); }
function git(root, ...args) {
  return execFileSync('git', ['-c', 'user.name=Synthetic Tester', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.fsmonitor=false', '-c', 'init.templateDir=', '-c', `core.hooksPath=${resolve(root, '.git', 'disabled-hooks')}`, ...args], {
    cwd: root, env: { ...cleanEnv(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: resolve(root, '.git', 'disabled-global-config') }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'tomurai-development-'));
  t.after(() => {
    const target = resolve(root);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('tomurai-development-'));
    rmSync(target, { recursive: true, force: true });
  });
  git(root, 'init', '-b', 'dev');
  write(root, 'AGENTS.md', `Read [development](${canonical}).\n`);
  write(root, 'CLAUDE.md', '@AGENTS.md\n');
  write(root, canonical, '---\nname: tomurai-development\ndescription: Develop Tomurai safely.\n---\nRead AGENTS.md and the scoped ticket.\n');
  write(root, adapter, `---\nname: tomurai-development\ndescription: Develop Tomurai with the shared procedure.\n---\n必ず[共通手順](../../../${canonical})を全文読んでから開始する。\n`);
  write(root, metadata, 'interface:\n  display_name: "Tomurai Development"\n  short_description: "Safe Tomurai development"\n  default_prompt: "Use $tomurai-development for this change."\npolicy:\n  allow_implicit_invocation: true\n');
  write(root, document, '# Synthetic specification\n');
  write(root, evidence, '# Synthetic evidence; no production approval\n');
  write(root, 'src/a.ts', 'export const value = 1;\n');
  write(root, 'index.html', '<!doctype html><title>Synthetic mock</title>');
  git(root, 'add', '--all'); git(root, 'commit', '--no-gpg-sign', '-m', 'synthetic baseline');
  return root;
}
function manifest(paths = ['src/a.ts'], overrides = {}) {
  return { version: 1, ticket: 'TOM-67', requirements: ['C01', 'R44'], gates: ['G06'],
    allowedPaths: [contract, evidence, document, ...paths], evidence,
    docs: { mode: 'updated', reason: 'Synthetic specification updated.', paths: [document] },
    testCommands: ['node --test tests/synthetic.test.mjs'], ...overrides };
}
function put(root, value = manifest()) { write(root, contract, JSON.stringify(value, null, 2) + '\n'); }
function check(root, args = [], env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env: { ...cleanEnv(), ...env }, encoding: 'utf8' });
  return { ...result, output: result.stdout + result.stderr };
}
function passes(result) { assert.equal(result.status, 0, result.output); assert.match(result.output, /Development checks OK/); }
function fails(result, pattern) { assert.notEqual(result.status, 0, result.output); assert.match(result.output, pattern); }

test('valid dev change covers committed, staged, unstaged and untracked files', t => {
  const root = fixture(t), base = git(root, 'rev-parse', 'HEAD');
  write(root, 'src/committed.ts', '1'); git(root, 'add', '--all'); git(root, 'commit', '-m', 'synthetic change');
  write(root, 'src/staged.ts', '2'); git(root, 'add', '--all');
  write(root, 'src/a.ts', '3'); write(root, 'src/untracked.ts', '4');
  put(root, manifest(['src/a.ts', 'src/committed.ts', 'src/staged.ts', 'src/untracked.ts']));
  passes(check(root, ['--base', base]));
});

test('ordinary structural checks do not claim change scope or impose dev branch', t => {
  const root = fixture(t); git(root, 'branch', '-m', 'main'); put(root);
  passes(check(root));
  fails(check(root, ['--base', 'HEAD']), /branch.*dev/i);
});

test('uncovered untracked and staged files fail even with an unrelated current contract', t => {
  const root = fixture(t); put(root); write(root, 'src/untracked.ts', '1');
  fails(check(root, ['--base', 'HEAD']), /uncovered.*src\/untracked\.ts/i);
  git(root, 'add', 'src/untracked.ts');
  fails(check(root, ['--base', 'HEAD']), /uncovered.*src\/untracked\.ts/i);
});

test('unchanged historical contracts cannot authorize a new change', t => {
  const root = fixture(t); put(root); git(root, 'add', '--all'); git(root, 'commit', '-m', 'old contract');
  write(root, 'src/a.ts', '2');
  fails(check(root, ['--base', 'HEAD']), /uncovered.*src\/a\.ts/i);
});

test('deleted contracts cannot authorize changes', t => {
  const root = fixture(t); put(root); git(root, 'add', '--all'); git(root, 'commit', '-m', 'old contract');
  rmSync(resolve(root, contract)); write(root, 'src/a.ts', '2');
  fails(check(root, ['--base', 'HEAD']), /uncovered/i);
});

test('rename requires both source and destination paths', t => {
  const root = fixture(t); renameSync(resolve(root, 'src/a.ts'), resolve(root, 'src/b.ts')); git(root, 'add', '--all');
  put(root, manifest(['src/b.ts']));
  fails(check(root, ['--base', 'HEAD']), /uncovered.*src\/a\.ts/i);
  put(root, manifest(['src/a.ts', 'src/b.ts'])); passes(check(root, ['--base', 'HEAD']));
});

test('protected paths stay rejected when renamed, deleted or reverted in the worktree', t => {
  const root = fixture(t);
  const original = readFileSync(resolve(root, 'index.html'), 'utf8');
  write(root, 'index.html', 'changed'); git(root, 'add', 'index.html'); write(root, 'index.html', original);
  put(root, manifest(['index.html'])); fails(check(root, ['--base', 'HEAD']), /protected.*index\.html/i);
  renameSync(resolve(root, 'index.html'), resolve(root, 'src/old-mock.html')); git(root, 'add', '--all');
  put(root, manifest(['index.html', 'src/old-mock.html'])); fails(check(root, ['--base', 'HEAD']), /protected.*index\.html/i);
});

test('protected commit changes cannot be hidden by an inverse unstaged edit', t => {
  const root = fixture(t), base = git(root, 'rev-parse', 'HEAD');
  const original = readFileSync(resolve(root, 'index.html'), 'utf8');
  write(root, 'index.html', 'changed'); git(root, 'add', '--all'); git(root, 'commit', '-m', 'change mock');
  write(root, 'index.html', original); put(root, manifest(['index.html']));
  fails(check(root, ['--base', base]), /protected.*index\.html/i);
});

for (const path of ['.env', 'nested/.ENV.local', 'keys/client.pem', 'signing.p12', 'id_ed25519', 'node_modules/x.js', 'apps/mobile/dist/bundle.js', '.expo/cache.json', 'coverage/result.json']) {
  test(`sensitive or generated diff is rejected: ${path}`, t => {
    const root = fixture(t); write(root, path, 'synthetic'); put(root, manifest([path]));
    fails(check(root, ['--base', 'HEAD']), /forbidden/i);
  });
}

test('ignored local build artifacts are outside scope, not claimed scanned', t => {
  const root = fixture(t); write(root, '.gitignore', 'node_modules/\n.env\n'); git(root, 'add', '--all'); git(root, 'commit', '-m', 'ignores');
  write(root, 'node_modules/ignored.js', 'synthetic'); write(root, '.env', 'SYNTHETIC=1');
  put(root); passes(check(root, ['--base', 'HEAD']));
});

const malformed = [
  ['unknown key', x => ({ ...x, extra: true })], ['wrong version', x => ({ ...x, version: '1' })],
  ['wrong ticket', x => ({ ...x, ticket: 'TOM-0' })], ['filename mismatch', x => ({ ...x, ticket: 'TOM-68' })],
  ['array ticket', x => ({ ...x, ticket: ['TOM-67'] })],
  ['unknown requirement', x => ({ ...x, requirements: ['R49'] })], ['duplicate requirement', x => ({ ...x, requirements: ['C01', 'C01'] })],
  ['unknown gate', x => ({ ...x, gates: ['G07'] })], ['duplicate gates', x => ({ ...x, gates: ['G01', 'G01'] })],
  ['empty paths', x => ({ ...x, allowedPaths: [] })], ['duplicate paths', x => ({ ...x, allowedPaths: [...x.allowedPaths, 'src/a.ts'] })],
  ['missing evidence', x => ({ ...x, evidence: 'docs/missing.md' })], ['uncovered evidence', x => ({ ...x, allowedPaths: x.allowedPaths.filter(p => p !== evidence) })],
  ['missing self', x => ({ ...x, allowedPaths: x.allowedPaths.filter(p => p !== contract) })],
  ['empty docs reason', x => ({ ...x, docs: { ...x.docs, reason: ' ' } })],
  ['unknown nested key', x => ({ ...x, docs: { ...x.docs, extra: true } })],
  ['empty updated docs', x => ({ ...x, docs: { ...x.docs, paths: [] } })],
  ['not-required with paths', x => ({ ...x, docs: { ...x.docs, mode: 'not-required' } })],
  ['non-doc path', x => ({ ...x, docs: { ...x.docs, paths: ['src/a.ts'] } })],
  ['empty command', x => ({ ...x, testCommands: [' '] })], ['duplicate commands', x => ({ ...x, testCommands: ['npm test', 'npm test'] })],
  ['array root', () => []], ['null root', () => null],
];
test('strict manifest schema rejects malformed values', async t => {
  const root = fixture(t);
  for (const [name, mutate] of malformed) await t.test(name, () => { put(root, mutate(manifest())); fails(check(root), /manifest/i); });
  put(root, manifest([], { docs: { mode: 'not-required', reason: 'No behavior change.', paths: [] } })); passes(check(root));
});

test('JSON duplicate object keys are not silently accepted', t => {
  const root = fixture(t); write(root, contract, JSON.stringify(manifest()).replace('"version":1', '"version":2,"version":1'));
  fails(check(root), /duplicate.*key/i);
});

test('documentation-only changes may record no applicable release gate', t => {
  const root = fixture(t); put(root, manifest([], { gates: [] }));
  write(root, evidence, '# Synthetic documentation check\nGates: not applicable; no product behavior or release change.\n');
  passes(check(root));
});

test('paths must be normalized strict repo-relative filenames', async t => {
  const root = fixture(t);
  for (const path of ['../outside', '/absolute', 'C:/absolute', 'a\\b', './src/a.ts', 'src//a.ts', 'src/../a.ts', 'src/*', 'src/[ab].ts', 'src/{a,b}.ts', 'src', 'a\nb', 'a:b', '.git/config', '.GIT/config', 'trailing.', 'trailing ', '//host/share']) {
    await t.test(JSON.stringify(path), () => { put(root, manifest([path])); fails(check(root), /path|file/i); });
  }
});

test('commands are documentation and never executed', t => {
  const root = fixture(t), sentinel = resolve(root, 'executed.txt');
  put(root, manifest([], { testCommands: [`node -e "require('fs').writeFileSync('${sentinel.replaceAll('\\', '/')}', 'bad')"`, '$(echo should-not-run); https://example.invalid'] }));
  passes(check(root)); assert.equal(existsSync(sentinel), false);
});

test('skill adapters, AGENTS import and implicit invocation setting are verified', async t => {
  const root = fixture(t); put(root);
  const mutations = [[adapter, '---\nname: wrong\ndescription: adapter\n---\nNo shared reference'], ['CLAUDE.md', 'Different rules'], [metadata, 'policy:\n  allow_implicit_invocation: false\n'], ['AGENTS.md', 'No skill connection']];
  for (const [path, body] of mutations) await t.test(path, () => {
    const original = readFileSync(resolve(root, path), 'utf8'); write(root, path, body);
    fails(check(root), /skill|CLAUDE|AGENTS|implicit/i); write(root, path, original);
  });
});

test('external directory junction cannot supply evidence', t => {
  const root = fixture(t), outside = mkdtempSync(resolve(tmpdir(), 'tomurai-development-'));
  t.after(() => { assert.ok(resolve(outside).startsWith(resolve(tmpdir()) + sep)); rmSync(outside, { recursive: true, force: true }); });
  write(outside, 'evidence.md', '# Synthetic external evidence');
  symlinkSync(outside, resolve(root, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
  put(root, manifest(['external/evidence.md'], { evidence: 'external/evidence.md' }));
  fails(check(root), /symlink|outside|junction/i);
});

test('missing common-skill references and duplicate auto-selection keys are rejected', t => {
  const root = fixture(t); put(root);
  const original = readFileSync(resolve(root, canonical), 'utf8');
  write(root, canonical, original + '\nRead [required reference](references/missing.md).\n');
  fails(check(root), /missing|reference|link/i);
  write(root, canonical, original);
  const yaml = readFileSync(resolve(root, metadata), 'utf8');
  write(root, metadata, yaml + '  allow_implicit_invocation: false\n');
  fails(check(root), /implicit|duplicate/i);
  write(root, metadata, yaml + 'policy:\n  allow_implicit_invocation: false\n');
  fails(check(root), /implicit|duplicate/i);
});

test('base must be a commit and may not inject git options', async t => {
  const root = fixture(t); put(root);
  for (const ref of ['--help', 'HEAD:src/a.ts', 'missing-ref', 'HEAD;echo injected']) {
    await t.test(ref, () => fails(check(root, ['--base', ref]), /base/i));
  }
  fails(check(root, ['--target', 'dev']), /argument|option/i);
});

test('detached HEAD requires matching GitHub event target dev', async t => {
  const root = fixture(t); put(root); git(root, 'checkout', '--detach');
  fails(check(root, ['--base', 'HEAD']), /branch.*dev/i);
  const eventPath = resolve(root, '.git', 'synthetic-event.json');
  const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'pull_request' };
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { ref: 'dev' }, head: { ref: 'topic' } } }));
  passes(check(root, ['--base', 'HEAD'], env));
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { ref: 'main' }, head: { ref: 'dev' } } }));
  fails(check(root, ['--base', 'HEAD'], env), /branch|event|target/i);
  writeFileSync(eventPath, JSON.stringify({ ref: 'refs/heads/dev' }));
  passes(check(root, ['--base', 'HEAD'], { ...env, GITHUB_EVENT_NAME: 'push' }));
  fails(check(root, ['--base', 'HEAD'], env), /branch|event|target/i);
  fails(check(root, ['--base', 'HEAD'], { ...env, GITHUB_EVENT_PATH: '' }), /branch|event|target/i);
  git(root, 'switch', '-c', 'main');
  fails(check(root, ['--base', 'HEAD'], { ...env, GITHUB_EVENT_NAME: 'push' }), /branch.*dev/i);
});

test('Git repository and index overrides are discarded regardless of environment key case', t => {
  const root = fixture(t); put(root); write(root, 'src/a.ts', 'synthetic change');
  for (const key of ['GIT_DIR', 'git_dir', 'Git_Dir', 'GIT_INDEX_FILE', 'git_index_file']) {
    passes(check(root, ['--base', 'HEAD'], { [key]: resolve(root, 'nonexistent-override') }));
  }
});

test('alternate index cannot conceal a force-staged ignored file', t => {
  const root = fixture(t); write(root, '.gitignore', 'src/uncovered.ts\n');
  git(root, 'add', '--all'); git(root, 'commit', '-m', 'ignore synthetic file');
  const alternate = resolve(root, '.git', 'alternate-index'); copyFileSync(resolve(root, '.git', 'index'), alternate);
  write(root, 'src/uncovered.ts', 'synthetic'); git(root, 'add', '-f', 'src/uncovered.ts'); put(root);
  fails(check(root, ['--base', 'HEAD']), /uncovered.*src\/uncovered\.ts/i);
  fails(check(root, ['--base', 'HEAD'], { Git_Index_File: alternate }), /uncovered.*src\/uncovered\.ts/i);
});

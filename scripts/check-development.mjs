import { readFileSync, readdirSync, lstatSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const canonical = '.agents/skills/tomurai-development/SKILL.md';
const adapter = '.claude/skills/tomurai-development/SKILL.md';
const metadata = '.agents/skills/tomurai-development/agents/openai.yaml';
const manifestDirectory = 'docs/development/changes';
const protectedHtml = new Set(['index.html', 'contact.html', 'privacy.html', 'terms.html']);
const generatedDirectories = new Set(['node_modules', 'dist', 'build', 'coverage', 'preview', '.expo', '.next', '.turbo', '.cache']);
const fail = message => { throw new Error(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// Restrict portable paths before any filesystem read. Directory symlinks include
// Windows junctions. The checker deliberately does not follow either kind.
export function validateRepoPath(root, path, { mustExist = false, markdown = false } = {}) {
  requireThat(typeof path === 'string' && path.length > 0, 'Invalid path: expected a nonempty string');
  const segments = path.split('/');
  requireThat(!/[\x00-\x1f\x7f<>:"|?*\\[\]{}]/.test(path) && !path.startsWith('/') && segments.every(segment =>
    segment && segment !== '.' && segment !== '..' && segment.toLowerCase() !== '.git' && !/[. ]$/.test(segment) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)), `Invalid normalized repo path: ${JSON.stringify(path)}`);
  if (markdown) requireThat(extname(path) === '.md', `Expected markdown file: ${path}`);
  let current = resolve(root);
  let missing = false;
  for (let i = 0; i < segments.length; i += 1) {
    current = resolve(current, segments[i]);
    let info;
    try { info = lstatSync(current); } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') { missing = true; break; }
      throw error;
    }
    requireThat(!info.isSymbolicLink(), `Symlink/junction path is not permitted: ${path}`);
    requireThat(i === segments.length - 1 ? info.isFile() : info.isDirectory(), `Expected regular file path: ${path}`);
  }
  requireThat(!mustExist || !missing, `Missing file: ${path}`);
  return path;
}

function textFile(root, path) {
  validateRepoPath(root, path, { mustExist: true });
  requireThat(lstatSync(resolve(root, path)).size <= 1024 * 1024, `File exceeds validation limit: ${path}`);
  return readFileSync(resolve(root, path), 'utf8');
}

// JSON.parse rejects malformed JSON but would otherwise silently use the last
// duplicate object key. Walk the already syntax-checked tokens to reject that.
export function parseStrictJson(text) {
  const value = JSON.parse(text);
  let at = 0;
  const whitespace = () => { while (/\s/.test(text[at] ?? '') && at < text.length) at += 1; };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      if (text[at] === '\\') at += 2;
      else if (text[at++] === '"') break;
    }
    return JSON.parse(text.slice(start, at));
  };
  const walk = () => {
    whitespace();
    if (text[at] === '"') { string(); return; }
    if (text[at] === '{') {
      at += 1; whitespace(); const keys = new Set();
      if (text[at] === '}') { at += 1; return; }
      for (;;) {
        whitespace(); const key = string();
        requireThat(!keys.has(key), `Duplicate JSON object key: ${key}`); keys.add(key);
        whitespace(); at += 1; walk(); whitespace();
        if (text[at++] === '}') return;
      }
    }
    if (text[at] === '[') {
      at += 1; whitespace(); if (text[at] === ']') { at += 1; return; }
      for (;;) { walk(); whitespace(); if (text[at++] === ']') return; }
    }
    while (at < text.length && !/[\s,}\]]/.test(text[at])) at += 1;
  };
  walk();
  return value;
}

function exactKeys(value, keys, label) {
  requireThat(record(value), `${label}: expected an object`);
  requireThat(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `${label}: missing or unknown key`);
}
function strings(value, label, { empty = false, pattern, caseInsensitive = false } = {}) {
  requireThat(Array.isArray(value) && (empty || value.length > 0), `${label}: expected ${empty ? 'an' : 'a nonempty'} array`);
  requireThat(value.every(item => nonempty(item) && item.trim() === item && (!pattern || pattern.test(item))), `${label}: invalid or empty value`);
  const keys = value.map(item => caseInsensitive ? item.toLowerCase() : item);
  requireThat(new Set(keys).size === keys.length, `${label}: duplicate value`);
  return value;
}

export function validateManifest(root, path, value) {
  exactKeys(value, ['version', 'ticket', 'requirements', 'gates', 'allowedPaths', 'evidence', 'docs', 'testCommands'], 'manifest');
  requireThat(value.version === 1, 'manifest: version must be number 1');
  requireThat(typeof value.ticket === 'string' && /^TOM-[1-9]\d*$/.test(value.ticket) && basename(path) === `${value.ticket}.json`, 'manifest: ticket must match TOM-number filename');
  strings(value.requirements, 'manifest requirements', { pattern: /^(?:C(?:0[1-9]|1\d)|R(?:0[1-9]|[1-3]\d|4[0-8]))$/ });
  strings(value.gates, 'manifest gates', { empty: true, pattern: /^G0[1-6]$/ });
  strings(value.allowedPaths, 'manifest allowedPaths', { caseInsensitive: true }).forEach(p => validateRepoPath(root, p));
  requireThat(value.allowedPaths.includes(path), 'manifest: allowedPaths must include the contract itself');
  validateRepoPath(root, value.evidence, { mustExist: true, markdown: true });
  requireThat(value.allowedPaths.includes(value.evidence), 'manifest: evidence must be included in allowedPaths');
  exactKeys(value.docs, ['mode', 'reason', 'paths'], 'manifest docs');
  requireThat(['updated', 'not-required'].includes(value.docs.mode) && nonempty(value.docs.reason), 'manifest docs: invalid mode or empty reason');
  strings(value.docs.paths, 'manifest docs paths', { empty: value.docs.mode === 'not-required', caseInsensitive: true });
  requireThat(value.docs.mode !== 'not-required' || value.docs.paths.length === 0, 'manifest docs: not-required requires empty paths');
  for (const p of value.docs.paths) {
    validateRepoPath(root, p, { mustExist: true });
    requireThat((p.startsWith('docs/') && ['.md', '.json'].includes(extname(p))) || ['AGENTS.md', 'CLAUDE.md', 'README.md'].includes(p), `manifest docs: expected document path: ${p}`);
    requireThat(value.allowedPaths.includes(p), `manifest docs: path must be included in allowedPaths: ${p}`);
  }
  strings(value.testCommands, 'manifest testCommands');
  return value;
}

function frontmatter(text, label) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  requireThat(match, `${label}: missing skill frontmatter`);
  const names = [...match[1].matchAll(/^name:\s*["']?([^\r\n"']+)["']?\s*$/gm)];
  requireThat(names.length === 1 && names[0][1].trim() === 'tomurai-development', `${label}: wrong skill name`);
  requireThat(/^description:\s*\S/m.test(match[1]), `${label}: missing skill description`);
}

export function validateSkillConnections(root) {
  const agents = textFile(root, 'AGENTS.md'), claude = textFile(root, 'CLAUDE.md');
  requireThat(agents.includes(canonical), 'AGENTS.md: missing common skill reference');
  requireThat(/^@AGENTS\.md\s*$/m.test(claude), 'CLAUDE.md: expected @AGENTS.md import');
  frontmatter(textFile(root, canonical), 'Common skill');
  const entry = textFile(root, adapter); frontmatter(entry, 'Claude skill');
  const targets = [...entry.matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
  requireThat(targets.some(target => !/^(?:[a-z]+:|\/|\\)/i.test(target) && resolve(root, dirname(adapter), target) === resolve(root, canonical)), 'Claude skill: missing relative link to common skill');
  requireThat(/必読|必ず|全文|\bmust\b/i.test(entry), 'Claude skill: common procedure must be required reading');
  const seen = new Set();
  const links = path => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const [, target] of textFile(root, path).matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      requireThat(!/^(?:[a-z]+:|\/|\\)/i.test(target), `Invalid skill link: ${target}`);
      const linked = relative(root, resolve(root, dirname(path), target.split('#')[0])).replaceAll('\\', '/');
      validateRepoPath(root, linked, { mustExist: true });
      if (linked.startsWith('.agents/skills/tomurai-development/') && linked.endsWith('.md')) links(linked);
    }
  };
  links(canonical); links(adapter);
  const yaml = textFile(root, metadata);
  requireThat([...yaml.matchAll(/^policy:/gm)].length === 1, 'Codex skill: duplicate or missing implicit invocation policy');
  const policy = yaml.match(/^policy:[ \t]*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m)?.[1] ?? '';
  requireThat([...policy.matchAll(/^\s+allow_implicit_invocation:/gm)].length === 1 &&
    [...policy.matchAll(/^\s+allow_implicit_invocation:\s*true\s*(?:#.*)?$/gm)].length === 1, 'Codex skill: implicit invocation must be true without duplicate keys');
  requireThat(/^\s+default_prompt:.*\$tomurai-development/m.test(yaml), 'Codex skill: default_prompt must reference $tomurai-development');
}

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...env, GIT_OPTIONAL_LOCKS: '0' },
  });
}
function gitPaths(output) {
  const entries = output.split('\0'); const paths = [];
  for (let i = 0; i < entries.length && entries[i];) {
    const status = entries[i++];
    requireThat(/^[ACDMRTUXB]\d*$/.test(status), `Unexpected git diff status: ${status}`);
    paths.push(entries[i++]);
    if (/^[RC]/.test(status)) paths.push(entries[i++]);
  }
  requireThat(paths.every(nonempty), 'Malformed git diff paths');
  return paths;
}
function verifiedDev(root, env) {
  const branch = git(root, ['branch', '--show-current']).trim();
  if (branch === 'dev') return;
  requireThat(branch === '' && env.GITHUB_ACTIONS === 'true', `Development branch must be dev (found ${branch || 'detached HEAD'})`);
  let event;
  try { event = parseStrictJson(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); }
  catch { fail('GitHub event target dev could not be verified'); }
  const verified = env.GITHUB_EVENT_NAME === 'push' ? event?.ref === 'refs/heads/dev'
    : env.GITHUB_EVENT_NAME === 'pull_request' && event?.pull_request?.base?.ref === 'dev';
  requireThat(verified, 'GitHub event target must be dev');
}

export function changedPaths(root, base) {
  requireThat(nonempty(base) && !base.startsWith('-') && !/[\x00-\x20\x7f]/.test(base), 'Invalid base ref');
  let commit;
  try { commit = git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim(); }
  catch { fail('Base ref does not resolve to a commit'); }
  requireThat(/^[a-f0-9]{40,64}$/.test(commit), 'Invalid base commit');
  const flags = ['--name-status', '-z', '--no-ext-diff', '--no-textconv', '--find-renames'];
  const paths = new Set([
    ...gitPaths(git(root, ['diff', ...flags, commit, 'HEAD', '--'])),
    ...gitPaths(git(root, ['diff', ...flags, '--cached', 'HEAD', '--'])),
    ...gitPaths(git(root, ['diff', ...flags, '--'])),
    ...git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean),
  ]);
  return [...paths].sort();
}

function forbidden(path) {
  const lower = path.toLowerCase(), parts = lower.split('/'), name = parts.at(-1);
  return parts.some(part => generatedDirectories.has(part)) ||
    (name === '.env' || name.startsWith('.env.')) && name !== '.env.example' ||
    /\.(?:pem|key|p12|pfx|keystore|jks|mobileprovision|apk|aab|ipa|tsbuildinfo|log)$/.test(name) ||
    /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.|$)/.test(name) ||
    /^(?:credentials|service-account|service_account|serviceaccount)(?:[.-].*)?\.json$/.test(name) ||
    ['google-services.json', 'googleservice-info.plist', '.npmrc', '.pypirc'].includes(name);
}

export function runDevelopmentChecks(root = process.cwd(), { base, env = process.env } = {}) {
  root = realpathSync.native(resolve(root));
  validateSkillConnections(root);
  const manifests = new Map(), folder = resolve(root, manifestDirectory);
  if (existsSync(folder)) {
    requireThat(!lstatSync(folder).isSymbolicLink() && lstatSync(folder).isDirectory(), 'Invalid manifest directory');
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.name.endsWith('.json')) continue;
      const path = `${manifestDirectory}/${entry.name}`;
      try { manifests.set(path, validateManifest(root, path, parseStrictJson(textFile(root, path)))); }
      catch (error) { fail(`manifest ${path}: ${error.message}`); }
    }
  }
  let changed = [];
  if (base !== undefined) {
    const gitRoot = realpathSync.native(git(root, ['rev-parse', '--show-toplevel']).trim());
    requireThat(gitRoot === root, 'Run the development checker at the Git repository root');
    verifiedDev(root, env); changed = changedPaths(root, base);
    const allowed = new Set(changed.flatMap(path => manifests.get(path)?.allowedPaths ?? []));
    for (const path of changed) {
      validateRepoPath(root, path);
      requireThat(!protectedHtml.has(path.toLowerCase()), `Protected HTML change: ${path}`);
      requireThat(!forbidden(path), `Forbidden sensitive/generated path: ${path}`);
      requireThat(allowed.has(path), `Uncovered change: ${path}`);
    }
    // Reject staged links/gitlinks even when an inverse unstaged edit disguises
    // their current filesystem type. No submodule or link target is traversed.
    for (const line of git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean)) {
      const match = line.match(/^(\d+) [a-f0-9]+ [0-3]\t([\s\S]+)$/);
      requireThat(match, 'Malformed Git index entry');
      if (changed.includes(match[2])) requireThat(!['120000', '160000'].includes(match[1]), `Symlink/gitlink change: ${match[2]}`);
    }
  }
  return `Development checks OK: skills / ${manifests.size} manifest(s)` + (base === undefined ? ' / structure only.' : ` / ${changed.length} scoped changed path(s) targeting dev.`);
}

function cli(args) {
  requireThat(args.length === 0 || args.length === 2 && args[0] === '--base', 'Invalid arguments. Usage: node scripts/check-development.mjs [--base REF]');
  console.log(runDevelopmentChecks(process.cwd(), { base: args[1] }));
  console.log('Contract text is not proof of test execution or release approval. No manifest commands were executed; ignored local files were not scanned.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); }
  catch (error) { console.error(`Development checks failed: ${error.message}`); process.exitCode = 1; }
}

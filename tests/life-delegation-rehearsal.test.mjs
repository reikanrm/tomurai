import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginLifeRehearsal, lifeRehearsalCommand, configureLifeScenario, projectLifeRehearsal,
  delegationStatus, DELEGATION_DURATION_MS, REHEARSAL_NOTE_ID,
} from '../apps/mobile/src/domain/life-delegation-rehearsal.ts';

const action = (state, actor, type, extra = {}) => lifeRehearsalCommand(state, {
  actor, type, noteId: REHEARSAL_NOTE_ID, expectedRevision: state.revision, ...extra,
});
const grant = state => action(state, 'parent', 'grant', { fields: ['future-try'] });
const write = (state, extra = {}) => action(state, 'employee', 'write', {
  fieldId: 'future-try', sample: 'a', grantId: state.delegation?.id, ...extra,
});
const ready = () => write(grant(beginLifeRehearsal()));
const clone = x => structuredClone(x);

test('synthetic flow separates permission, draft, reviewed version, confirmation and sharing', () => {
  let s = beginLifeRehearsal();
  assert.equal(projectLifeRehearsal(s, 'employee').fields.length, 0);
  assert.equal(s.sharingEnabled, false);
  s = grant(s);
  assert.equal(s.delegation.expiresAtMs - s.delegation.approvedAtMs, 30 * 24 * 60 * 60 * 1000);
  assert.equal(DELEGATION_DURATION_MS, 2592000000);
  s = write(s);
  assert.equal(s.fields[0].confirmed, 'initial');
  assert.equal(s.fields[0].draft.sample, 'a');
  assert.equal(action(s, 'parent', 'confirm').error, 'review_required');
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  s = action(s, 'parent', 'confirm');
  assert.equal(s.error, null);
  assert.equal(s.fields[0].confirmed, 'a');
  assert.equal(s.fields[0].draft, null);
  assert.equal(s.sharingEnabled, false);
});

test('only the parent grants a nonempty unique subset of the two fixture fields', () => {
  const s = beginLifeRehearsal();
  for (const actor of ['employee', 'company', 'other', '', null]) {
    assert.equal(action(s, actor, 'grant', { fields: ['future-try'] }).error, 'not_authorized');
  }
  for (const fields of [[], ['unknown'], ['future-try', 'future-try'], null, ['medical'], ['__proto__']]) {
    assert.equal(action(s, 'parent', 'grant', { fields }).error, 'invalid_request');
  }
  assert.equal(action(s, 'parent', 'grant', { fields: ['future-try', 'future-family'] }).error, null);
});

test('projection returns only selected content, no fields for other actors, and copies its data', () => {
  const s = ready();
  const view = projectLifeRehearsal(s, 'employee');
  assert.deepEqual(view.fields.map(f => f.id), ['future-try']);
  assert.doesNotMatch(JSON.stringify(view), /future-family/);
  for (const actor of ['company', 'other', undefined]) assert.deepEqual(projectLifeRehearsal(s, actor).fields, []);
  assert.equal(projectLifeRehearsal(s, 'parent').fields.length, 2);
  const before = clone(s);
  try { view.fields[0].draft.sample = 'b'; } catch {}
  assert.deepEqual(s, before);
});

test('write cannot bypass missing approval, field selection, note identity, or fixture sample boundary', () => {
  assert.equal(write(beginLifeRehearsal()).error, 'delegation_inactive');
  const s = grant(beginLifeRehearsal());
  for (const extra of [{ fieldId: 'future-family' }, { fieldId: 'unknown' }, { fieldId: '__proto__' }]) {
    assert.equal(write(s, extra).error, 'not_authorized');
  }
  for (const sample of ['personal text', 'initial', null, undefined]) assert.equal(write(s, { sample }).error, 'invalid_request');
  for (const actor of ['parent', 'company', 'other']) assert.equal(write(s, { actor }).error, 'not_authorized');
  assert.equal(write(s, { noteId: 'another-note' }).error, 'not_authorized');
  assert.equal(write(s, { grantId: 'another-grant' }).error, 'stale_delegation');
});

test('employee, company and other people cannot review/confirm/discard/revoke', () => {
  let s = ready();
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  for (const actor of ['employee', 'company', 'other']) for (const type of ['review', 'confirm', 'discard', 'revoke']) {
    const next = action(s, actor, type, { fieldId: 'future-try' });
    assert.equal(next.error, 'not_authorized');
    assert.deepEqual(next.fields, s.fields);
  }
  for (const type of ['share', 'delete-confirmed', 'unknown']) assert.equal(action(s, 'employee', type).error, 'invalid_request');
});

test('cancellation retains drafts and confirmed values; parent can still adopt or discard', () => {
  let s = ready();
  s = action(s, 'parent', 'revoke');
  assert.equal(delegationStatus(s), 'revoked');
  assert.deepEqual(projectLifeRehearsal(s, 'employee').fields, []);
  assert.equal(write(s).error, 'delegation_inactive');
  assert.equal(s.fields[0].draft.sample, 'a');
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  s = action(s, 'parent', 'confirm');
  assert.equal(s.fields[0].confirmed, 'a');
  s = write(grant(s), { sample: 'b' });
  s = action(s, 'parent', 'discard', { fieldId: 'future-try' });
  assert.equal(s.fields[0].draft, null);
  assert.equal(s.fields[0].confirmed, 'a');
});

test('expiry is exclusive; commands do not slide the thirty-day duration', () => {
  const base = grant(beginLifeRehearsal());
  for (const [delta, permitted] of [[DELEGATION_DURATION_MS - 1, true], [DELEGATION_DURATION_MS, false], [DELEGATION_DURATION_MS + 1, false]]) {
    const s = configureLifeScenario(base, { advanceMs: delta });
    assert.equal(projectLifeRehearsal(s, 'employee').fields.length, permitted ? 1 : 0);
    assert.equal(write(s).error, permitted ? null : 'delegation_inactive');
    assert.equal(s.delegation.expiresAtMs, base.delegation.expiresAtMs);
  }
  let s = ready();
  s = configureLifeScenario(s, { advanceMs: DELEGATION_DURATION_MS });
  assert.equal(s.fields[0].draft.sample, 'a');
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  assert.equal(action(s, 'parent', 'confirm').fields[0].confirmed, 'a');
});

test('either eligibility loss permanently invalidates the delegation; restoration requires a new grant', () => {
  for (const key of ['parentEligible', 'employeeEligible']) {
    const base = ready(), oldGrant = base.delegation.id;
    let s = configureLifeScenario(base, { [key]: false });
    assert.equal(delegationStatus(s), 'eligibility_lost');
    assert.equal(write(s).error, 'delegation_inactive');
    assert.equal(s.fields[0].draft.sample, 'a');
    s = configureLifeScenario(s, { [key]: true });
    assert.equal(write(s).error, 'delegation_inactive');
    s = grant(s);
    assert.notEqual(s.delegation.id, oldGrant);
    assert.equal(write(s, { grantId: oldGrant }).error, 'stale_delegation');
    assert.equal(s.fields[0].confirmed, 'initial');
    assert.equal(s.sharingEnabled, false);
  }
});

test('expired parent retains read/cancel/discard but cannot grant or finalize', () => {
  let s = ready();
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  s = configureLifeScenario(s, { parentEligible: false });
  assert.equal(projectLifeRehearsal(s, 'parent').fields.length, 2);
  assert.equal(grant(s).error, 'not_authorized');
  assert.equal(action(s, 'parent', 'confirm').error, 'not_authorized');
  assert.equal(action(s, 'parent', 'revoke').error, null);
  assert.equal(action(s, 'parent', 'discard', { fieldId: 'future-try' }).fields[0].draft, null);
});

test('parent unable to approve cannot be substituted by employee or support', () => {
  let s = configureLifeScenario(beginLifeRehearsal(), { parentCanApprove: false });
  assert.equal(grant(s).error, 'approval_unavailable');
  s = configureLifeScenario(ready(), { parentCanApprove: false });
  assert.equal(action(s, 'parent', 'review', { fieldId: 'future-try' }).error, 'approval_unavailable');
  assert.equal(action(s, 'parent', 'confirm').error, 'approval_unavailable');
  assert.equal(action(s, 'employee', 'confirm').error, 'not_authorized');
  assert.equal(s.fields[0].draft.sample, 'a');
});

test('stale state/confirmation/replay never overwrites a newer draft or confirmed value', () => {
  let s = ready();
  const beforeReview = clone(s);
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  assert.equal(write(s, { expectedRevision: beforeReview.revision }).error, 'revision_conflict');
  s = write(s, { sample: 'b' });
  assert.equal(action(s, 'parent', 'confirm').error, 'review_changed');
  assert.equal(s.fields[0].confirmed, 'initial');
  s = action(s, 'parent', 'review', { fieldId: 'future-try' });
  const oldRevision = s.revision;
  s = action(s, 'parent', 'confirm');
  assert.equal(action(s, 'parent', 'confirm', { expectedRevision: oldRevision }).error, 'revision_conflict');
  assert.equal(action(s, 'parent', 'confirm').error, 'review_required');
  assert.equal(s.fields[0].confirmed, 'b');
});

test('expiry during an in-flight write and regrant never reuses an old operation', () => {
  let s = grant(beginLifeRehearsal());
  const oldId = s.delegation.id, oldRevision = s.revision;
  s = configureLifeScenario(s, { advanceMs: DELEGATION_DURATION_MS });
  assert.equal(write(s, { expectedRevision: oldRevision }).error, 'revision_conflict');
  s = grant(s);
  assert.equal(write(s, { grantId: oldId }).error, 'stale_delegation');
  assert.equal(s.delegation.approvedAtMs, s.nowMs);
  assert.equal(s.delegation.expiresAtMs, s.nowMs + DELEGATION_DURATION_MS);
});

test('fixture controls reject malformed time/boolean values; inputs remain immutable', () => {
  const s = ready(), before = clone(s);
  for (const advanceMs of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(configureLifeScenario(s, { advanceMs }).error, 'invalid_request');
  }
  for (const patch of [{ parentEligible: 'true' }, { employeeEligible: undefined }, { parentCanApprove: null }, { unknown: true }]) {
    assert.equal(configureLifeScenario(s, patch).error, 'invalid_request');
  }
  assert.equal(grant(s).error, 'active_delegation');
  write(s); action(s, 'parent', 'revoke'); projectLifeRehearsal(s, 'parent');
  assert.deepEqual(s, before);
  assert.deepEqual(beginLifeRehearsal(), beginLifeRehearsal());
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRehearsal, rehearsalCommand, REHEARSAL_PASSPHRASE } from '../apps/mobile/src/domain/invitation-rehearsal.ts';
import { INVITATION_LIFETIME_MS } from '../apps/mobile/src/domain/invitations.ts';
const now = Date.parse('2026-09-27T03:00:00Z');
const access = { membership: 'active', activeMemberCount: 1, entitlement: 'free' };
const start = (override = {}) => beginRehearsal({ ...access, ...override });
const command = (s, type, options = {}, time = now) => rehearsalCommand(s, { type, expectedRevision: s.group.revision, ...options }, time);
const issued = (override) => command(start(override), 'create');
const request = (s) => command(s, 'request', { signedIn: true, passphrase: REHEARSAL_PASSPHRASE });

test('local invitation create → request → approve; immutable, no app rights or payment', () => {
  const initial = start(), before = structuredClone(initial);
  const created = command(initial, 'create');
  assert.deepEqual(initial, before);
  assert.equal(created.invitation.status, 'issued');
  assert.equal(created.invitation.expiresAtMs, now + INVITATION_LIFETIME_MS);
  const pending = request(created);
  assert.equal(pending.invitation.status, 'pending_approval');
  assert.equal(pending.members.length, 0);
  const approved = command(pending, 'approve');
  assert.equal(approved.invitation.status, 'accepted');
  assert.equal(approved.members.length, 1);
  assert.equal(approved.group.entitlement, 'free');
  assert.equal(approved.mode, 'local-only');
  assert.equal('token' in approved, false);
});

test('wrong passphrase and missing simulated sign-in never create a request', () => {
  const s = issued();
  for (const options of [{ signedIn: false, passphrase: REHEARSAL_PASSPHRASE }, { signedIn: true, passphrase: 'wrong' }]) {
    const next = command(s, 'request', options);
    assert.equal(next.invitation.status, 'issued');
    assert.ok(next.error);
    assert.equal(next.group.revision, s.group.revision);
  }
});

test('expired, cancelled, already accepted and stale double taps cannot join twice', () => {
  const s = issued();
  assert.equal(command(s, 'request', { signedIn: true, passphrase: REHEARSAL_PASSPHRASE }, s.invitation.expiresAtMs).error, 'expired');
  assert.equal(request(command(s, 'revoke')).error, 'revoked');
  const pending = request(s);
  const approved = command(pending, 'approve');
  assert.equal(request(approved).error, 'used');
  assert.equal(command(approved, 'revoke').error, 'used');
  const stale = rehearsalCommand(approved, { type: 'approve', expectedRevision: pending.group.revision }, now);
  assert.equal(stale.error, 'revision_conflict');
  assert.equal(stale.members.length, 1);
  assert.equal(command(s, 'create').error, 'outstanding_invitation');
});

test('pending preview cannot start, approval requires a request, solo waits without fake consent', () => {
  assert.equal(start({ membership: 'pending' }), null);
  assert.equal(command(issued(), 'approve').error, 'approval_not_requested');
  const pending = request(issued({ entitlement: 'b2c_solo' }));
  const denied = command(pending, 'approve');
  assert.equal(denied.error, 'plan_change_required');
  assert.equal(denied.members.length, 0);
  assert.equal(denied.group.entitlement, 'b2c_solo');
});

test('new invitation after acceptance has a different synthetic applicant; no member cap', () => {
  let s = start({ activeMemberCount: 100, entitlement: 'b2c_family' });
  for (let i = 0; i < 3; i++) s = command(request(command(s, 'create')), 'approve');
  assert.equal(new Set(s.members).size, 3);
  assert.equal(s.group.activeMemberCount, 103);
});

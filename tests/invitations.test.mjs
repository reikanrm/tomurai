import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvitation, requestParticipation, approveParticipation, revokeInvitation, INVITATION_LIFETIME_MS } from '../apps/mobile/src/domain/invitations.ts';

// Synthetic verified contexts only; these functions are not an auth/API adapter.
const now = Date.parse('2026-09-26T03:00:00Z');
const membership = (userId = 'member', groupId = 'family-a', status = 'active') => ({ userId, groupId, status });
const context = (overrides = {}) => ({
  actor: { userId: 'member', authenticated: true, accountActive: true },
  membership: membership(),
  group: { id: 'family-a', revision: 4, activeMemberCount: 1, entitlement: 'free', payerUserId: 'payer' },
  nowMs: now, rateLimitPassed: true, ...overrides,
});
const invite = (overrides = {}) => ({
  id: 'synthetic-invite', groupId: 'family-a', creatorId: 'member', createdAtMs: now - 1_000,
  expiresAtMs: now - 1_000 + INVITATION_LIFETIME_MS, revision: 0, status: 'issued',
  applicantId: null, requiresSoloUpgrade: false, ...overrides,
});
const pending = (overrides = {}) => invite({ status: 'pending_approval', applicantId: 'new-member', revision: 1, ...overrides });
const expected = (invitation = 0, group = 4) => ({ invitation, group });
const applicantContext = (overrides = {}) => context({ actor: { userId: 'new-member', authenticated: true, accountActive: true }, membership: null, ...overrides });
const verification = { tokenValid: true, passphraseValid: true };
const applicant = { userId: 'new-member', accountActive: true, membership: null };
const approvedUpgrade = { groupId: 'family-a', invitationId: 'synthetic-invite', payerUserId: 'payer', quoteId: 'synthetic-quote', acceptedAtMs: now - 500, entitlementActivatedAtMs: now - 100 };
const reason = (result, expectedReason) => { assert.equal(result.ok, false); assert.equal(result.reason, expectedReason); };
const safeEffects = result => {
  assert.equal(result.ok, true);
  assert.equal(result.billing, 'unchanged');
  assert.equal(result.noteSharing, 'unchanged');
  assert.equal('url' in result, false);
  assert.equal('token' in result, false);
};

test('creation proposes seven-day metadata only, without payment, membership or sharing changes', () => {
  const ctx = context({ group: { ...context().group, entitlement: 'b2c_solo' } });
  const before = structuredClone(ctx);
  const result = createInvitation(ctx, 'synthetic-invite', 4);
  safeEffects(result);
  assert.equal(result.membership, 'unchanged');
  assert.equal(result.invitation.expiresAtMs - now, 7 * 24 * 60 * 60 * 1_000);
  assert.equal(result.invitation.requiresSoloUpgrade, true);
  assert.equal(result.nextGroupRevision, 5);
  assert.deepEqual(ctx, before);
});

test('creation rejects unverified/disabled/non-member/foreign/expired membership before revisions', () => {
  const denied = [
    { actor: { ...context().actor, authenticated: false } },
    { actor: { ...context().actor, accountActive: false } },
    { membership: null }, { membership: membership('someone-else') },
    { membership: membership('member', 'family-b') },
    ...['pending', 'left'].map(status => ({ membership: membership('member', 'family-a', status) })),
  ];
  for (const change of denied) reason(createInvitation(context(change), 'synthetic-invite', -1), 'not_authorized');
  reason(createInvitation(context({ rateLimitPassed: false }), 'synthetic-invite', 4), 'rate_limited');
  reason(createInvitation(context(), 'synthetic-invite', 3), 'revision_conflict');
});

test('join requires verified login, token and separate passphrase; pending approval gives no membership', () => {
  for (const proof of [{ ...verification, tokenValid: false }, { ...verification, passphraseValid: false }]) {
    reason(requestParticipation(invite(), applicantContext(), expected(), proof), 'verification_required');
  }
  reason(requestParticipation(invite(), applicantContext({ actor: { userId: 'new-member', authenticated: false, accountActive: true } }), expected(), verification), 'not_authorized');
  reason(requestParticipation(invite(), applicantContext({ rateLimitPassed: false }), expected(), verification), 'rate_limited');
  const result = requestParticipation(invite(), applicantContext(), expected(), verification);
  safeEffects(result);
  assert.equal(result.invitation.status, 'pending_approval');
  assert.equal(result.invitation.applicantId, 'new-member');
  assert.equal(result.membership, 'unchanged');
});

test('expired, invalid dates, revoked, accepted, forwarded-reserved and duplicate joins fail closed', () => {
  for (const method of ['request', 'approve']) {
    const check = record => method === 'request'
      ? requestParticipation(record, applicantContext(), expected(record.revision), verification)
      : approveParticipation(record, context(), expected(record.revision), applicant, null);
    const base = method === 'request' ? invite() : pending();
    reason(check({ ...base, createdAtMs: now - INVITATION_LIFETIME_MS, expiresAtMs: now }), 'expired');
    reason(check({ ...base, expiresAtMs: NaN }), 'invalid_invitation');
    reason(check({ ...base, expiresAtMs: now + INVITATION_LIFETIME_MS * 2 }), 'invalid_invitation');
    reason(check({ ...base, status: 'revoked' }), 'revoked');
    reason(check({ ...base, status: 'accepted', applicantId: 'new-member' }), 'used');
    reason(check({ ...base, groupId: 'family-b' }), 'wrong_group');
  }
  reason(requestParticipation(pending(), applicantContext({ actor: { userId: 'forwarded-recipient', authenticated: true, accountActive: true } }), expected(1), verification), 'pending_approval');
  reason(requestParticipation(invite(), applicantContext({ membership: membership('new-member') }), expected(), verification), 'duplicate_member');
});

test('approval requires a different current family member and current applicant account/membership', () => {
  for (const change of [{ membership: null }, { membership: membership('member', 'family-b') }, { membership: membership('member', 'family-a', 'left') }]) {
    reason(approveParticipation(pending(), context(change), expected(1), applicant, null), 'not_authorized');
  }
  reason(approveParticipation(pending(), applicantContext({ membership: membership('new-member') }), expected(1), applicant, null), 'not_authorized');
  reason(approveParticipation(pending(), context(), expected(1), { ...applicant, accountActive: false }, null), 'invalid_applicant');
  reason(approveParticipation(pending(), context(), expected(1), { ...applicant, userId: 'someone-else' }, null), 'invalid_applicant');
  reason(approveParticipation(pending(), context(), expected(1), { ...applicant, membership: membership('new-member') }, null), 'duplicate_member');
  reason(approveParticipation(invite(), context(), expected(), applicant, null), 'approval_not_requested');
});

test('solo-to-family requires matching payer consent AND server-confirmed family entitlement', () => {
  const record = pending({ requiresSoloUpgrade: true });
  const solo = context({ group: { ...context().group, entitlement: 'b2c_solo' } });
  reason(approveParticipation(record, solo, expected(1), applicant, null), 'plan_change_required');
  reason(approveParticipation(record, solo, expected(1), applicant, approvedUpgrade), 'plan_change_required');
  const family = context({ group: { ...context().group, entitlement: 'b2c_family' } });
  for (const proof of [null, { ...approvedUpgrade, groupId: 'family-b' }, { ...approvedUpgrade, invitationId: 'other' },
    { ...approvedUpgrade, payerUserId: 'previous-payer' }, { ...approvedUpgrade, quoteId: '' },
    { ...approvedUpgrade, acceptedAtMs: now + 1 }, { ...approvedUpgrade, entitlementActivatedAtMs: null }]) {
    reason(approveParticipation(record, family, expected(1), applicant, proof), 'plan_change_required');
  }
  const result = approveParticipation(record, family, expected(1), applicant, approvedUpgrade);
  safeEffects(result);
  assert.equal(result.membership, 'activate_applicant');
  assert.equal(result.invitation.status, 'accepted');
});

test('unlimited members and free/beta/family/corporate plans do not trigger per-person charges', () => {
  for (const activeMemberCount of [1, 2, 3, 10, 100, 10_000]) {
    for (const entitlement of ['free', 'expired', 'beta', 'b2c_family', 'corporate']) {
      const ctx = context({ group: { ...context().group, activeMemberCount, entitlement } });
      const result = approveParticipation(pending(), ctx, expected(1), applicant, null);
      safeEffects(result);
      assert.equal(result.membership, 'activate_applicant');
    }
  }
});

test('expected invitation AND group revisions reject stale sequential concurrency attempts', () => {
  reason(requestParticipation(invite(), applicantContext(), expected(9), verification), 'revision_conflict');
  reason(requestParticipation(invite(), applicantContext(), expected(0, 3), verification), 'revision_conflict');
  const first = requestParticipation(invite(), applicantContext(), expected(), verification);
  const newContext = applicantContext({ group: { ...context().group, revision: first.nextGroupRevision } });
  reason(requestParticipation(first.invitation, newContext, expected(), verification), 'revision_conflict');
  const joined = approveParticipation(pending(), context(), expected(1), applicant, null);
  const current = context({ group: { ...context().group, revision: joined.nextGroupRevision } });
  reason(approveParticipation(joined.invitation, current, expected(1), applicant, null), 'revision_conflict');
});

test('revocation applies only to current family and outstanding invitation; accepted does not expel', () => {
  reason(revokeInvitation(pending(), context({ membership: null }), expected(1)), 'not_authorized');
  const revoked = revokeInvitation(pending(), context(), expected(1));
  safeEffects(revoked);
  assert.equal(revoked.invitation.status, 'revoked');
  assert.equal(revoked.membership, 'unchanged');
  reason(revokeInvitation(pending({ status: 'accepted' }), context(), expected(1)), 'used');
  reason(revokeInvitation(invite(), context(), expected(0, 3)), 'revision_conflict');
});

test('invalid group counts/revisions/timestamps never produce a mutation proposal', () => {
  for (const activeMemberCount of [0, -1, NaN, 1.5, Infinity]) {
    reason(createInvitation(context({ group: { ...context().group, activeMemberCount } }), 'synthetic-invite', 4), 'invalid_context');
  }
  reason(createInvitation(context({ nowMs: NaN }), 'synthetic-invite', 4), 'invalid_context');
  reason(createInvitation(context({ group: { ...context().group, entitlement: 'invented' } }), 'synthetic-invite', 4), 'invalid_context');
});

test('malformed context, invitation, revision, proof and applicant objects fail closed without throwing', () => {
  const rejected = result => assert.equal(result.ok, false);
  for (const ctx of [null, undefined, [], {}, context({ actor: null }), context({ group: null })]) {
    rejected(createInvitation(ctx, 'synthetic-invite', 4));
    rejected(requestParticipation(invite(), ctx, expected(), verification));
    rejected(approveParticipation(pending(), ctx, expected(1), applicant, null));
    rejected(revokeInvitation(pending(), ctx, expected(1)));
  }
  for (const invalid of [null, undefined, [], {}]) {
    rejected(requestParticipation(invalid, applicantContext(), expected(), verification));
    rejected(approveParticipation(invalid, context(), expected(1), applicant, null));
    rejected(revokeInvitation(invalid, context(), expected(1)));
    rejected(requestParticipation(invite(), applicantContext(), invalid, verification));
    rejected(approveParticipation(pending(), context(), invalid, applicant, null));
    rejected(revokeInvitation(pending(), context(), invalid));
    rejected(requestParticipation(invite(), applicantContext(), expected(), invalid));
    rejected(approveParticipation(pending(), context(), expected(1), invalid, null));
  }
});

test('unknown or missing applicant membership status cannot activate an applicant', () => {
  for (const status of ['not-a-valid-status', '', undefined, 'ACTIVE', 1, null]) {
    const malformedApplicant = { ...applicant, membership: membership(applicant.userId, 'family-a', status) };
    if (status === undefined) delete malformedApplicant.membership.status;
    reason(approveParticipation(pending(), context(), expected(1), malformedApplicant, null), 'invalid_applicant');
  }
  for (const malformed of [undefined, [], {}, 'active']) {
    reason(approveParticipation(pending(), context(), expected(1), { ...applicant, membership: malformed }, null), 'invalid_applicant');
  }
});

test('known pending or left applicant memberships remain valid without triggering charges or note sharing', () => {
  for (const status of ['pending', 'left']) {
    const result = approveParticipation(pending(), context(), expected(1), { ...applicant, membership: membership(applicant.userId, 'family-a', status) }, null);
    safeEffects(result);
    assert.equal(result.membership, 'activate_applicant');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lifeSharingVersion, canCreateLifeNote, createPrivateLifeNote, lifeOwnerPermissions,
  canReadLifeField, canLinkLifeFieldToCase,
} from '../apps/mobile/src/domain/life-access.ts';

// Synthetic policy IDs, no copied mock identities or private field values.
const now = 1000;
const note = (patch = {}) => ({ id: 'note-a', ownerId: 'owner-a', sharingEnabled: true, deleted: false, sharingVersion: lifeSharingVersion, ...patch });
const field = (patch = {}) => ({ id: 'field-a', kind: 'general', review: 'approved', ...patch });
const owner = (patch = {}) => ({
  userId: 'owner-a', authenticated: true, accountActive: true, actorKind: 'person',
  corporateEligibility: { userId: 'owner-a', corporationId: 'corporation-a', kind: 'employee', verified: true, status: 'active' },
  recipientMembership: null, ...patch,
});
const recipient = (patch = {}) => ({
  userId: 'recipient-a', authenticated: true, accountActive: true, actorKind: 'person', corporateEligibility: null,
  recipientMembership: { noteId: 'note-a', ownerId: 'owner-a', userId: 'recipient-a', status: 'active' }, ...patch,
});
const grant = (patch = {}) => ({
  id: 'grant-a', noteId: 'note-a', ownerId: 'owner-a', recipientId: 'recipient-a', fieldId: 'field-a',
  scopes: ['location'], timing: 'now', ownerConsented: true, revoked: false, version: lifeSharingVersion,
  grantedAtMs: 500, expiresAtMs: 1500, ...patch,
});
const caseContext = (patch = {}) => ({ id: 'case-a', deceasedOwnerId: 'owner-a', activeRecipientIds: ['recipient-a'], ...patch });
const link = (patch = {}) => ({ noteId: 'note-a', ownerId: 'owner-a', caseId: 'case-a', fieldId: 'field-a', scope: 'location', ...patch });

test('verified corporate employee or invited family can create only their own private note', () => {
  for (const kind of ['employee', 'invited-family']) {
    const access = owner(); access.corporateEligibility.kind = kind;
    assert.equal(canCreateLifeNote('owner-a', access), true, 'verified owner needs a permitted corporate qualification');
    const created = createPrivateLifeNote('note-a', 'owner-a', access);
    assert.equal(created.ownerId, 'owner-a');
    assert.equal(created.sharingEnabled, false);
    assert.equal(created.deleted, false);
    assert.equal(Object.isFrozen(created), true);
    assert.deepEqual(lifeOwnerPermissions(created, access), { read: true, edit: true, revoke: true, delete: true });
  }
});

test('explicit now grant allows only the named recipient field/scope and matching case reference', () => {
  assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant()], now), true);
  assert.equal(canReadLifeField(note(), field(), 'content', recipient(), [grant()], now), false);
  assert.equal(canLinkLifeFieldToCase(note(), field(), link(), caseContext(), recipient(), [grant()], now), true);
});

test('general B2C, pending/expired/unverified or other-person qualifications cannot create or edit', () => {
  const inputs = [owner({ corporateEligibility: null })];
  for (const [key, value] of [['status', 'expired'], ['status', 'pending'], ['verified', false], ['userId', 'other-owner'],
    ['corporationId', ''], ['kind', 'b2c']]) {
    const access = owner(); access.corporateEligibility[key] = value; inputs.push(access);
  }
  for (const access of inputs) {
    assert.equal(canCreateLifeNote('owner-a', access), false);
    assert.equal(createPrivateLifeNote('note-a', 'owner-a', access), null);
    assert.equal(lifeOwnerPermissions(note(), access).edit, false);
  }
  assert.equal(canCreateLifeNote('other-owner', owner()), false);
  assert.equal(createPrivateLifeNote('note-a', 'other-owner', owner()), null);
  assert.equal(createPrivateLifeNote('', 'owner-a', owner()), null);
});

test('expired owner keeps read, sharing revocation and deletion without gaining any proxy edit', () => {
  const access = owner(); access.corporateEligibility.status = 'expired';
  assert.deepEqual(lifeOwnerPermissions(note(), access), { read: true, edit: false, revoke: true, delete: true });
  assert.equal(canReadLifeField(note({ sharingEnabled: false }), field(), 'content', access, [], now), true);
  assert.deepEqual(lifeOwnerPermissions(note({ ownerId: 'other-owner' }), access), { read: false, edit: false, revoke: false, delete: false });
  assert.deepEqual(lifeOwnerPermissions(note(), recipient()), { read: false, edit: false, revoke: false, delete: false });
});

test('company, specialist and support actor kinds gain no note access from payment or approval roles', () => {
  for (const actorKind of ['company', 'expert', 'support']) {
    const owningActor = owner({ actorKind });
    assert.equal(canCreateLifeNote('owner-a', owningActor), false);
    assert.deepEqual(lifeOwnerPermissions(note(), owningActor), { read: false, edit: false, revoke: false, delete: false });
    assert.equal(canReadLifeField(note(), field(), 'location', recipient({ actorKind }), [grant()], now), false);
    assert.equal(canLinkLifeFieldToCase(note(), field(), link(), caseContext(), recipient({ actorKind }), [grant()], now), false);
  }
});

test('unauthenticated, inactive, wrong-account and deleted-note requests have no permissions', () => {
  for (const patch of [{ authenticated: false }, { accountActive: false }, { userId: null }, { userId: 'other-person' }]) {
    assert.equal(canCreateLifeNote('owner-a', owner(patch)), false);
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(patch), [grant()], now), false);
  }
  assert.deepEqual(lifeOwnerPermissions(note({ deleted: true }), owner()), { read: false, edit: false, revoke: false, delete: false });
  assert.equal(canReadLifeField(note({ deleted: true }), field(), 'location', recipient(), [grant()], now), false);
});

test('new metadata remains private even if supplied with an unrelated grant and has no billing state', () => {
  const metadata = createPrivateLifeNote('note-a', 'owner-a', owner());
  assert.equal(canReadLifeField(metadata, field(), 'location', recipient(), [grant()], now), false);
  assert.equal(canReadLifeField(note(), field(), 'location', recipient(), undefined, now), false);
  assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [], now), false);
  for (const key of ['entitlement', 'price', 'charge', 'caseId', 'values', 'encrypted']) assert.equal(key in metadata, false);
});

test('grant matches note, owner, recipient, field, version and exact scope independently', () => {
  for (const key of ['noteId', 'ownerId', 'recipientId', 'fieldId', 'version']) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant({ [key]: 'different' })], now), false);
  }
  assert.equal(canReadLifeField(note(), field({ id: 'field-b' }), 'location', recipient(), [grant()], now), false);
  assert.equal(canReadLifeField(note({ sharingVersion: 'unknown' }), field(), 'location', recipient(), [grant()], now), false);
  assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant({ scopes: ['content'] })], now), false);
  assert.equal(canReadLifeField(note(), field(), 'content', recipient(), [grant({ scopes: ['content'] })], now), true);
  for (const scopes of [[], ['all'], ['location', 'all']]) assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant({ scopes })], now), false);
  assert.equal(canReadLifeField(note(), field(), 'all', recipient(), [grant()], now), false);
});

test('removing sharing, consent, grant or active recipient relationship immediately denies shared read', () => {
  for (const patch of [{ sharingEnabled: false }, { sharingEnabled: undefined }]) {
    assert.equal(canReadLifeField(note(patch), field(), 'location', recipient(), [grant()], now), false);
  }
  for (const patch of [{ ownerConsented: false }, { revoked: true }, { revoked: undefined }]) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant(patch)], now), false);
  }
  assert.equal(canReadLifeField(note(), field(), 'location', recipient({ recipientMembership: null }), [grant()], now), false);
  for (const [key, value] of [['status', 'revoked'], ['status', 'pending'], ['noteId', 'other-note'], ['ownerId', 'other-owner'], ['userId', 'other-recipient']]) {
    const access = recipient(); access.recipientMembership[key] = value;
    assert.equal(canReadLifeField(note(), field(), 'location', access, [grant()], now), false);
  }
});

test('sharing time boundaries are inclusive start/exclusive expiry and invalid clocks fail closed', () => {
  for (const [at, expected] of [[499, false], [500, true], [1499, true], [1500, false]]) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant()], at), expected);
  }
  for (const at of [NaN, Infinity, -1, 1000.5, undefined]) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant()], at), false);
  }
  for (const patch of [{ grantedAtMs: NaN }, { expiresAtMs: 499 }, { expiresAtMs: 500 }, { expiresAtMs: NaN }, { expiresAtMs: undefined }]) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant(patch)], now), false);
  }
  assert.equal(canReadLifeField(note(), field(), 'location', recipient(), [grant({ expiresAtMs: null })], 9000), true);
});

test('duplicate or malformed grant IDs cannot resurrect a revoked grant', () => {
  for (const grants of [[grant(), grant({ revoked: true })], [grant({ id: '' })], [null]]) {
    assert.equal(canReadLifeField(note(), field(), 'location', recipient(), grants, now), false);
  }
});

test('emergency, after-death and private timing stays denied despite two death reports', () => {
  for (const timing of ['emergency', 'after-death', 'private']) {
    const access = { ...recipient(), deathReports: 2, emergencyVerified: true };
    const deceasedCase = { ...caseContext(), deathReports: 2, deathConfirmed: true };
    assert.equal(canReadLifeField(note(), field(), 'location', access, [grant({ timing })], now), false);
    assert.equal(canLinkLifeFieldToCase(note(), field(), link(), deceasedCase, access, [grant({ timing })], now), false);
  }
});

test('sensitive, credential and unreviewed fields stay disabled even if a grant or owner is present', () => {
  for (const policy of [field({ kind: 'credential' }), field({ kind: 'sensitive' }), field({ review: 'pending' }), field({ review: 'not-adopted' }), field({ kind: 'unknown' })]) {
    assert.equal(canReadLifeField(note(), policy, 'location', recipient(), [grant()], now), false);
    assert.equal(canReadLifeField(note(), policy, 'content', owner(), [], now), false);
    assert.equal(canLinkLifeFieldToCase(note(), policy, link(), caseContext(), recipient(), [grant()], now), false);
  }
});

test('post-death reference needs explicit IDs, active case membership and a still-effective grant', () => {
  for (const key of ['noteId', 'ownerId', 'caseId', 'fieldId']) {
    assert.equal(canLinkLifeFieldToCase(note(), field(), link({ [key]: 'other' }), caseContext(), recipient(), [grant()], now), false);
  }
  for (const patch of [{ deceasedOwnerId: null }, { deceasedOwnerId: 'other-owner' }, { activeRecipientIds: [] }, { activeRecipientIds: ['other-recipient'] }]) {
    assert.equal(canLinkLifeFieldToCase(note(), field(), link(), caseContext(patch), recipient(), [grant()], now), false);
  }
  assert.equal(canLinkLifeFieldToCase(note(), field(), link({ scope: 'content' }), caseContext(), recipient(), [grant()], now), false);
  assert.equal(canLinkLifeFieldToCase(note(), field(), link(), caseContext(), recipient(), [grant({ revoked: true })], now), false);
  assert.equal(canLinkLifeFieldToCase(note(), field(), link(), caseContext(), recipient(), [grant()], 1500), false);
});

test('matching names and dates never merge different owner IDs or create a share', () => {
  const namedNote = { ...note(), name: 'Synthetic Example', birthDate: '2000-01-01' };
  const matchingNameCase = { ...caseContext({ deceasedOwnerId: 'other-owner' }), name: 'Synthetic Example', birthDate: '2000-01-01' };
  assert.equal(canLinkLifeFieldToCase(namedNote, field(), link(), matchingNameCase, recipient(), [grant()], now), false);
  assert.equal(canLinkLifeFieldToCase(note({ sharingEnabled: false }), field(), link(), caseContext(), recipient(), [grant()], now), false);
});

test('one named active recipient is sufficient for an existing now share, but linking does not mutate or charge', () => {
  const inputs = [note(), field(), link(), caseContext(), recipient(), [grant()]];
  const before = structuredClone(inputs);
  assert.equal(canLinkLifeFieldToCase(...inputs, now), true);
  assert.equal(canLinkLifeFieldToCase(...inputs, now), true);
  assert.deepEqual(inputs, before);
  assert.equal(canReadLifeField(note(), field(), 'location', recipient({ corporateEligibility: null }), [grant()], now), true);
});

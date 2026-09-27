/** Pure access policy only. Inputs must come from verified server state, not UI toggles. */
export const lifeSharingVersion = 'life-sharing-2026-09-26-v1';
export type LifeNoteIdentity = Readonly<{
  id: string; ownerId: string; sharingEnabled: boolean; deleted: boolean; sharingVersion: string;
}>;
export type LifeAccess = Readonly<{
  userId: string | null; authenticated: boolean; accountActive: boolean;
  actorKind: 'person' | 'company' | 'expert' | 'support';
  corporateEligibility: Readonly<{
    userId: string; corporationId: string; kind: 'employee' | 'invited-family';
    verified: boolean; status: 'active' | 'expired' | 'pending';
  }> | null;
  recipientMembership: Readonly<{
    noteId: string; ownerId: string; userId: string; status: 'active' | 'revoked' | 'pending';
  }> | null;
}>;
export type LifeFieldPolicy = Readonly<{
  id: string; kind: 'general' | 'sensitive' | 'credential'; review: 'approved' | 'pending' | 'not-adopted';
}>;
export type LifeFieldScope = 'location' | 'content';
export type LifeGrant = Readonly<{
  id: string; noteId: string; ownerId: string; recipientId: string; fieldId: string;
  scopes: readonly LifeFieldScope[]; timing: 'now' | 'emergency' | 'after-death' | 'private';
  ownerConsented: boolean; revoked: boolean; version: string;
  grantedAtMs: number; expiresAtMs: number | null;
}>;
export type LifeCaseReference = Readonly<{
  noteId: string; ownerId: string; caseId: string; fieldId: string; scope: LifeFieldScope;
}>;
export type LifeCaseContext = Readonly<{
  id: string; deceasedOwnerId: string | null; activeRecipientIds: readonly string[];
}>;
export type LifeOwnerPermissions = Readonly<{ read: boolean; edit: boolean; revoke: boolean; delete: boolean }>;
const noOwnerPermissions: LifeOwnerPermissions = Object.freeze({ read: false, edit: false, revoke: false, delete: false });
const identifier = (value: string | null) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
const timestamp = (value: number) => Number.isSafeInteger(value) && value >= 0;
const scopeValid = (value: LifeFieldScope) => value === 'location' || value === 'content';
const person = (access: LifeAccess) => !!access && access.authenticated === true && access.accountActive === true
  && access.actorKind === 'person' && identifier(access.userId);
const liveNote = (note: LifeNoteIdentity) => !!note && identifier(note.id) && identifier(note.ownerId) && note.deleted === false;
// No credential/medical collection is activated by this domain implementation.
const availableField = (field: LifeFieldPolicy) => !!field && identifier(field.id) && field.kind === 'general' && field.review === 'approved';

export function canCreateLifeNote(ownerId: string, access: LifeAccess): boolean {
  if (!identifier(ownerId) || !person(access) || ownerId !== access.userId) return false;
  const eligibility = access.corporateEligibility;
  return !!eligibility && eligibility.userId === ownerId && identifier(eligibility.corporationId)
    && eligibility.verified === true && eligibility.status === 'active'
    && (eligibility.kind === 'employee' || eligibility.kind === 'invited-family');
}

/** Metadata candidate only; no personal values, persistence, sharing, or entitlement side effects. */
export function createPrivateLifeNote(id: string, ownerId: string, access: LifeAccess): LifeNoteIdentity | null {
  return identifier(id) && canCreateLifeNote(ownerId, access)
    ? Object.freeze({ id, ownerId, sharingEnabled: false, deleted: false, sharingVersion: lifeSharingVersion }) : null;
}

/** Loss of corporate eligibility stops edits, never owner read/revoke/delete. */
export function lifeOwnerPermissions(note: LifeNoteIdentity, access: LifeAccess): LifeOwnerPermissions {
  if (!liveNote(note) || !person(access) || access.userId !== note.ownerId) return noOwnerPermissions;
  return Object.freeze({ read: true, edit: canCreateLifeNote(note.ownerId, access), revoke: true, delete: true });
}

function sharedFieldAllowed(
  note: LifeNoteIdentity, field: LifeFieldPolicy, scope: LifeFieldScope,
  access: LifeAccess, grants: readonly LifeGrant[], nowMs: number,
): boolean {
  if (!liveNote(note) || note.sharingEnabled !== true || note.sharingVersion !== lifeSharingVersion
    || !availableField(field) || !scopeValid(scope) || !person(access) || !timestamp(nowMs) || !Array.isArray(grants)) return false;
  const membership = access.recipientMembership;
  if (!membership || membership.status !== 'active' || membership.noteId !== note.id || membership.ownerId !== note.ownerId
    || membership.userId !== access.userId) return false;
  // Ambiguous duplicate records must not make a revoked grant effective again.
  const ids = grants.map(grant => grant?.id);
  if (ids.some(id => !identifier(id)) || new Set(ids).size !== ids.length) return false;
  return grants.some(grant => grant.noteId === note.id && grant.ownerId === note.ownerId && grant.recipientId === access.userId
    && grant.fieldId === field.id && grant.version === lifeSharingVersion && grant.ownerConsented === true && grant.revoked === false
    && grant.timing === 'now' && Array.isArray(grant.scopes) && grant.scopes.length > 0 && grant.scopes.every(scopeValid)
    && grant.scopes.includes(scope) && timestamp(grant.grantedAtMs) && grant.grantedAtMs <= nowMs
    && (grant.expiresAtMs === null || (timestamp(grant.expiresAtMs) && grant.expiresAtMs > grant.grantedAtMs && nowMs < grant.expiresAtMs)));
}

export function canReadLifeField(
  note: LifeNoteIdentity, field: LifeFieldPolicy, scope: LifeFieldScope,
  access: LifeAccess, grants: readonly LifeGrant[] = [], nowMs: number,
): boolean {
  if (!availableField(field) || !scopeValid(scope) || !timestamp(nowMs)) return false;
  return lifeOwnerPermissions(note, access).read || sharedFieldAllowed(note, field, scope, access, grants, nowMs);
}

/** Reference only an already shared field. Death reports or names are not authorization inputs. */
export function canLinkLifeFieldToCase(
  note: LifeNoteIdentity, field: LifeFieldPolicy, reference: LifeCaseReference,
  caseContext: LifeCaseContext, access: LifeAccess, grants: readonly LifeGrant[] = [], nowMs: number,
): boolean {
  if (!reference || !caseContext || !liveNote(note) || !identifier(caseContext.id) || !identifier(caseContext.deceasedOwnerId)
    || caseContext.deceasedOwnerId !== note.ownerId || reference.noteId !== note.id || reference.ownerId !== note.ownerId
    || reference.caseId !== caseContext.id || !field || reference.fieldId !== field.id
    || !Array.isArray(caseContext.activeRecipientIds) || !person(access) || !caseContext.activeRecipientIds.includes(access.userId!)) return false;
  return sharedFieldAllowed(note, field, reference.scope, access, grants, nowMs);
}

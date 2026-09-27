export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;
type Membership = { userId: string; groupId: string; status: 'active' | 'pending' | 'left' };
type Entitlement = 'free' | 'expired' | 'beta' | 'b2c_solo' | 'b2c_family' | 'corporate';

/** Future server-auth adapter input, NOT values accepted from an HTTP body or AccessPreview.
 * All identities, current memberships/entitlement, rate limits and proofs must be
 * resolved by the server inside the same transaction. This type does not authenticate. */
export type VerifiedInvitationContext = {
  actor: { userId: string; authenticated: boolean; accountActive: boolean };
  membership: Membership | null;
  group: { id: string; revision: number; activeMemberCount: number; entitlement: Entitlement; payerUserId: string | null };
  nowMs: number;
  rateLimitPassed: boolean;
};
export type Invitation = {
  id: string; groupId: string; creatorId: string; createdAtMs: number; expiresAtMs: number; revision: number;
  status: 'issued' | 'pending_approval' | 'accepted' | 'revoked'; applicantId: string | null; requiresSoloUpgrade: boolean;
};
type ExpectedRevisions = { invitation: number; group: number };
type Applicant = { userId: string; accountActive: boolean; membership: Membership | null };
/** Verified stored payment/consent evidence, not a client checkbox. */
type ConfirmedUpgrade = {
  groupId: string; invitationId: string; payerUserId: string; quoteId: string;
  acceptedAtMs: number; entitlementActivatedAtMs: number;
};
type Reason = 'not_authorized' | 'invalid_context' | 'rate_limited' | 'revision_conflict' | 'invalid_invitation'
  | 'wrong_group' | 'expired' | 'revoked' | 'used' | 'pending_approval' | 'verification_required' | 'duplicate_member'
  | 'approval_not_requested' | 'invalid_applicant' | 'plan_change_required';
export type InvitationResult = { ok: false; reason: Reason } | {
  ok: true; invitation: Invitation; nextGroupRevision: number;
  membership: 'unchanged' | 'activate_applicant'; billing: 'unchanged'; noteSharing: 'unchanged';
};
const deny = (reason: Reason): InvitationResult => ({ ok: false, reason });
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const validMembership = (value: unknown): value is Membership => object(value) && id(value.userId) && id(value.groupId)
  && (value.status === 'active' || value.status === 'pending' || value.status === 'left');
const revision = (value: number) => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
const instant = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;

function contextError(ctx: VerifiedInvitationContext, memberRequired: boolean): Reason | null {
  if (!object(ctx) || !object(ctx.actor) || !object(ctx.group)) return 'invalid_context';
  if (ctx.actor.authenticated !== true || ctx.actor.accountActive !== true || !id(ctx.actor.userId)) return 'not_authorized';
  if (memberRequired && (!ctx.membership || ctx.membership.status !== 'active' ||
    ctx.membership.userId !== ctx.actor.userId || ctx.membership.groupId !== ctx.group.id)) return 'not_authorized';
  if (ctx.membership !== null && !validMembership(ctx.membership)) return 'invalid_context';
  if (!id(ctx.group.id) || !instant(ctx.nowMs) || !revision(ctx.group.revision) ||
    !Number.isSafeInteger(ctx.group.activeMemberCount) || ctx.group.activeMemberCount < 1 ||
    !['free', 'expired', 'beta', 'b2c_solo', 'b2c_family', 'corporate'].includes(ctx.group.entitlement) ||
    (ctx.group.entitlement === 'b2c_solo' && !id(ctx.group.payerUserId))) return 'invalid_context';
  return null;
}

function invitationError(record: Invitation, ctx: VerifiedInvitationContext, expected: ExpectedRevisions, checkExpiry = true): Reason | null {
  if (!object(record)) return 'invalid_invitation';
  if (record.groupId !== ctx.group.id) return 'wrong_group';
  if (!id(record.id) || !id(record.creatorId) || !revision(record.revision) ||
    !instant(record.createdAtMs) || !instant(record.expiresAtMs) || record.createdAtMs > ctx.nowMs ||
    record.expiresAtMs - record.createdAtMs !== INVITATION_LIFETIME_MS || typeof record.requiresSoloUpgrade !== 'boolean' ||
    !['issued', 'pending_approval', 'accepted', 'revoked'].includes(record.status) ||
    (record.status === 'issued' && record.applicantId !== null) ||
    (['pending_approval', 'accepted'].includes(record.status) && !id(record.applicantId))) return 'invalid_invitation';
  if (!object(expected) || !revision(expected.invitation) || !revision(expected.group) ||
    expected.invitation !== record.revision || expected.group !== ctx.group.revision) return 'revision_conflict';
  if (record.status === 'revoked') return 'revoked';
  if (record.status === 'accepted') return 'used';
  if (checkExpiry && ctx.nowMs >= record.expiresAtMs) return 'expired';
  return null;
}

function proposal(invitation: Invitation, ctx: VerifiedInvitationContext, membership: 'unchanged' | 'activate_applicant' = 'unchanged'): InvitationResult {
  return { ok: true, invitation, nextGroupRevision: ctx.group.revision + 1, membership, billing: 'unchanged', noteSharing: 'unchanged' };
}

/** A metadata proposal only. No URL, token, passphrase, database or network side effect. */
export function createInvitation(ctx: VerifiedInvitationContext, invitationId: string, expectedGroupRevision: number): InvitationResult {
  const error = contextError(ctx, true);
  if (error) return deny(error);
  if (ctx.rateLimitPassed !== true) return deny('rate_limited');
  if (!revision(expectedGroupRevision) || expectedGroupRevision !== ctx.group.revision) return deny('revision_conflict');
  if (!id(invitationId) || !instant(ctx.nowMs + INVITATION_LIFETIME_MS)) return deny('invalid_invitation');
  return proposal({
    id: invitationId, groupId: ctx.group.id, creatorId: ctx.actor.userId, createdAtMs: ctx.nowMs,
    expiresAtMs: ctx.nowMs + INVITATION_LIFETIME_MS, revision: 0, status: 'issued', applicantId: null,
    requiresSoloUpgrade: ctx.group.entitlement === 'b2c_solo',
  }, ctx);
}

export function requestParticipation(record: Invitation, ctx: VerifiedInvitationContext, expected: ExpectedRevisions,
  verifiedSecrets: { tokenValid: boolean; passphraseValid: boolean }): InvitationResult {
  const error = contextError(ctx, false);
  if (error) return deny(error);
  if (ctx.rateLimitPassed !== true) return deny('rate_limited');
  if (!object(verifiedSecrets) || verifiedSecrets.tokenValid !== true || verifiedSecrets.passphraseValid !== true) return deny('verification_required');
  const invalid = invitationError(record, ctx, expected);
  if (invalid) return deny(invalid);
  if (ctx.membership && (ctx.membership.groupId !== ctx.group.id || ctx.membership.userId !== ctx.actor.userId)) return deny('invalid_context');
  if (ctx.membership && ctx.membership.status !== 'left') return deny('duplicate_member');
  if (record.creatorId === ctx.actor.userId) return deny('not_authorized');
  if (record.status === 'pending_approval') return deny('pending_approval');
  return proposal({ ...record, status: 'pending_approval', applicantId: ctx.actor.userId, revision: record.revision + 1,
    requiresSoloUpgrade: record.requiresSoloUpgrade || ctx.group.entitlement === 'b2c_solo' }, ctx);
}

export function approveParticipation(record: Invitation, ctx: VerifiedInvitationContext, expected: ExpectedRevisions,
  applicant: Applicant, upgrade: ConfirmedUpgrade | null): InvitationResult {
  const error = contextError(ctx, true);
  if (error) return deny(error);
  const invalid = invitationError(record, ctx, expected);
  if (invalid) return deny(invalid);
  if (record.status !== 'pending_approval') return deny('approval_not_requested');
  if (record.applicantId === ctx.actor.userId) return deny('not_authorized');
  if (!object(applicant) || !id(applicant.userId) || applicant.userId !== record.applicantId || applicant.accountActive !== true ||
    (applicant.membership !== null && (!validMembership(applicant.membership)
      || applicant.membership.groupId !== ctx.group.id || applicant.membership.userId !== applicant.userId))) return deny('invalid_applicant');
  if (applicant.membership?.status === 'active') return deny('duplicate_member');
  if (record.requiresSoloUpgrade || ctx.group.entitlement === 'b2c_solo') {
    if (ctx.group.entitlement !== 'b2c_family' || !object(upgrade) || !id(ctx.group.payerUserId) ||
      upgrade.groupId !== ctx.group.id || upgrade.invitationId !== record.id || upgrade.payerUserId !== ctx.group.payerUserId ||
      !id(upgrade.quoteId) || !instant(upgrade.acceptedAtMs) || !instant(upgrade.entitlementActivatedAtMs) ||
      upgrade.acceptedAtMs < record.createdAtMs || upgrade.acceptedAtMs > ctx.nowMs ||
      upgrade.entitlementActivatedAtMs < upgrade.acceptedAtMs || upgrade.entitlementActivatedAtMs > ctx.nowMs) return deny('plan_change_required');
  }
  return proposal({ ...record, status: 'accepted', revision: record.revision + 1 }, ctx, 'activate_applicant');
}

/** Cancels an outstanding invite; cannot remove an already accepted member. */
export function revokeInvitation(record: Invitation, ctx: VerifiedInvitationContext, expected: ExpectedRevisions): InvitationResult {
  const error = contextError(ctx, true);
  if (error) return deny(error);
  const invalid = invitationError(record, ctx, expected, false);
  if (invalid) return deny(invalid);
  return proposal({ ...record, status: 'revoked', revision: record.revision + 1 }, ctx);
}

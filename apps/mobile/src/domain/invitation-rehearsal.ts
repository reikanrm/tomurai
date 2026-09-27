import type { AccessPreview } from './access';
import { createInvitation, requestParticipation, approveParticipation, revokeInvitation,
  INVITATION_LIFETIME_MS, type Invitation, type VerifiedInvitationContext } from './invitations.ts';

// Synthetic, non-secret fixtures. NEVER an authentication, HTTP or persistence adapter.
export const REHEARSAL_PASSPHRASE = 'tomurai-demo';
const HOST = 'local-host';
export type InvitationRehearsalState = {
  mode: 'local-only'; group: VerifiedInvitationContext['group']; invitation: Invitation | null;
  members: string[]; nextId: number; offsetMs: number; error: string | null;
};
export type RehearsalCommand = {
  type: 'create' | 'request' | 'approve' | 'revoke' | 'expire'; expectedRevision: number;
  signedIn?: boolean; passphrase?: string;
};
export function beginRehearsal(access: Pick<AccessPreview, 'membership' | 'entitlement' | 'activeMemberCount'>): InvitationRehearsalState | null {
  if (access.membership !== 'active') return null;
  return { mode: 'local-only', group: { id: 'local-family', revision: 0, activeMemberCount: access.activeMemberCount,
    entitlement: access.entitlement, payerUserId: HOST }, invitation: null, members: [], nextId: 1, offsetMs: 0, error: null };
}
export const rehearsalLink = (record: Invitation) => `https://example.invalid/tomurai/invite/${record.id}`;
export function rehearsalCommand(state: InvitationRehearsalState, command: RehearsalCommand, nowMs: number): InvitationRehearsalState {
  const fail = (error: string) => ({ ...state, error });
  if (command.expectedRevision !== state.group.revision) return fail('revision_conflict');
  const now = nowMs + state.offsetMs;
  const record = state.invitation;
  if (command.type === 'expire') {
    if (!record || record.status === 'accepted' || record.status === 'revoked') return fail('invalid_invitation');
    return { ...state, offsetMs: state.offsetMs + INVITATION_LIFETIME_MS, error: null };
  }
  const recipient = record ? `local-recipient-${record.id}` : '';
  const isRecipient = command.type === 'request';
  const actorId = isRecipient ? recipient : HOST;
  const ctx: VerifiedInvitationContext = {
    actor: { userId: actorId, authenticated: !isRecipient || command.signedIn === true, accountActive: true },
    membership: !isRecipient ? { userId: HOST, groupId: state.group.id, status: 'active' }
      : state.members.includes(recipient) ? { userId: recipient, groupId: state.group.id, status: 'active' } : null,
    group: state.group, nowMs: now, rateLimitPassed: true,
  };
  if (command.type === 'create' && record && ['issued', 'pending_approval'].includes(record.status) && now < record.expiresAtMs) return fail('outstanding_invitation');
  if (command.type !== 'create' && !record) return fail('invalid_invitation');
  const revisions = { invitation: record?.revision ?? 0, group: command.expectedRevision };
  const result = command.type === 'create' ? createInvitation(ctx, `local-${state.nextId}`, command.expectedRevision)
    : command.type === 'request' ? requestParticipation(record!, ctx, revisions, { tokenValid: true, passphraseValid: command.passphrase === REHEARSAL_PASSPHRASE })
    : command.type === 'approve' ? approveParticipation(record!, ctx, revisions,
      { userId: recipient, accountActive: true, membership: state.members.includes(recipient) ? { userId: recipient, groupId: state.group.id, status: 'active' } : null }, null)
    : revokeInvitation(record!, ctx, revisions);
  if (!result.ok) return fail(result.reason);
  const joined = result.membership === 'activate_applicant';
  return { ...state, invitation: result.invitation, error: null,
    group: { ...state.group, revision: result.nextGroupRevision, activeMemberCount: state.group.activeMemberCount + (joined ? 1 : 0) },
    members: joined ? [...state.members, recipient] : state.members,
    nextId: state.nextId + (command.type === 'create' ? 1 : 0) };
}

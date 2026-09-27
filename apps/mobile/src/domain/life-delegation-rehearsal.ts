/** Synthetic, in-memory rehearsal only. NOT authentication or a server authorization boundary. */
export const DELEGATION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const REHEARSAL_NOTE_ID = 'synthetic-parent-note';
export type LifeRehearsalRole = 'parent' | 'employee' | 'company' | 'other';
export type RehearsalFieldId = 'future-try' | 'future-family';
export type DraftSample = 'a' | 'b';
type Status = 'active' | 'revoked' | 'eligibility_lost' | 'expired';
type RehearsalField = Readonly<{
  id: RehearsalFieldId; confirmed: 'initial' | DraftSample; confirmedRevision: number; draftSequence: number;
  draft: Readonly<{ sample: DraftSample; revision: number; delegationId: string }> | null;
}>;
type Review = Readonly<{ fieldId: RehearsalFieldId; draftRevision: number; confirmedRevision: number; sample: DraftSample }>;
export type LifeRehearsalError = 'invalid_request' | 'not_authorized' | 'revision_conflict' | 'delegation_inactive'
  | 'stale_delegation' | 'active_delegation' | 'approval_unavailable' | 'review_required' | 'review_changed';
export type LifeRehearsalState = Readonly<{
  noteId: typeof REHEARSAL_NOTE_ID; revision: number; nowMs: number; sequence: number;
  parentEligible: boolean; employeeEligible: boolean; parentCanApprove: boolean; sharingEnabled: false;
  delegation: Readonly<{ id: string; ownerId: 'synthetic-parent'; operatorId: 'synthetic-employee';
    fields: readonly RehearsalFieldId[]; approvedAtMs: number; expiresAtMs: number; status: Status }> | null;
  fields: readonly RehearsalField[]; review: Review | null; error: LifeRehearsalError | null;
}>;
export type LifeRehearsalCommand = Readonly<{
  actor: LifeRehearsalRole; type: 'grant' | 'write' | 'review' | 'confirm' | 'discard' | 'revoke';
  noteId: string; expectedRevision: number; fields?: readonly RehearsalFieldId[];
  fieldId?: RehearsalFieldId; sample?: DraftSample; grantId?: string;
}>;
const fieldIds: readonly RehearsalFieldId[] = ['future-try', 'future-family'];
const safeTime = (n: number) => Number.isSafeInteger(n) && n >= 0;

export function beginLifeRehearsal(): LifeRehearsalState {
  return { noteId: REHEARSAL_NOTE_ID, revision: 0, sequence: 0, nowMs: Date.UTC(2026, 0, 1),
    parentEligible: true, employeeEligible: true, parentCanApprove: true, sharingEnabled: false,
    delegation: null, review: null, error: null,
    fields: fieldIds.map(id => ({ id, confirmed: 'initial', confirmedRevision: 0, draftSequence: 0, draft: null })) };
}

export function delegationStatus(state: LifeRehearsalState): Status | 'none' {
  const d = state.delegation;
  if (!d) return 'none';
  if (d.status !== 'active') return d.status;
  if (!state.parentEligible || !state.employeeEligible) return 'eligibility_lost';
  if (!safeTime(state.nowMs) || state.nowMs < d.approvedAtMs || state.nowMs >= d.expiresAtMs) return 'expired';
  return 'active';
}
const failure = (state: LifeRehearsalState, error: LifeRehearsalError): LifeRehearsalState => ({ ...state, error });
const updated = (state: LifeRehearsalState, patch: Partial<LifeRehearsalState>): LifeRehearsalState =>
  ({ ...state, ...patch, revision: state.revision + 1, error: null });

/** Fixture controls, separate from simulated person commands; no real eligibility or wall clock changes. */
export function configureLifeScenario(state: LifeRehearsalState, patch: Readonly<{
  advanceMs?: number; parentEligible?: boolean; employeeEligible?: boolean; parentCanApprove?: boolean;
}>): LifeRehearsalState {
  if (!patch || Object.keys(patch).some(key => !['advanceMs', 'parentEligible', 'employeeEligible', 'parentCanApprove'].includes(key)))
    return failure(state, 'invalid_request');
  for (const key of ['parentEligible', 'employeeEligible', 'parentCanApprove'] as const) {
    if (key in patch && typeof patch[key] !== 'boolean') return failure(state, 'invalid_request');
  }
  if ('advanceMs' in patch && (!safeTime(patch.advanceMs!) || !safeTime(state.nowMs + patch.advanceMs! + DELEGATION_DURATION_MS)))
    return failure(state, 'invalid_request');
  const next = updated(state, { nowMs: state.nowMs + (patch.advanceMs ?? 0),
    parentEligible: patch.parentEligible ?? state.parentEligible, employeeEligible: patch.employeeEligible ?? state.employeeEligible,
    parentCanApprove: patch.parentCanApprove ?? state.parentCanApprove });
  const status = delegationStatus(next);
  // Record invalidation, so restoring eligibility cannot revive the old delegation.
  return next.delegation && next.delegation.status === 'active' && status !== 'active' && status !== 'none'
    ? { ...next, delegation: { ...next.delegation, status } } : next;
}

/** Never project an unselected field, including its draft, to the employee's view. */
export function projectLifeRehearsal(state: LifeRehearsalState, actor: LifeRehearsalRole) {
  const allowed = actor === 'parent' ? state.fields : actor === 'employee' && delegationStatus(state) === 'active'
    ? state.fields.filter(field => state.delegation!.fields.includes(field.id)) : [];
  return { fields: allowed.map(field => ({ ...field, draft: field.draft ? { ...field.draft } : null })),
    review: actor === 'parent' && state.review ? { ...state.review } : null };
}

export function lifeRehearsalCommand(state: LifeRehearsalState, command: LifeRehearsalCommand): LifeRehearsalState {
  if (!command || !['grant', 'write', 'review', 'confirm', 'discard', 'revoke'].includes(command.type)) return failure(state, 'invalid_request');
  if (command.noteId !== state.noteId) return failure(state, 'not_authorized');
  if (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision !== state.revision) return failure(state, 'revision_conflict');
  const { type, actor } = command;
  if (actor !== (type === 'write' ? 'employee' : 'parent')) return failure(state, 'not_authorized');
  if (['grant', 'review', 'confirm'].includes(type)) {
    if (!state.parentEligible || (type === 'grant' && !state.employeeEligible)) return failure(state, 'not_authorized');
    if (!state.parentCanApprove) return failure(state, 'approval_unavailable');
  }
  if (type === 'grant') {
    if (delegationStatus(state) === 'active') return failure(state, 'active_delegation');
    const fields = command.fields;
    if (!Array.isArray(fields) || !fields.length || fields.some(id => !fieldIds.includes(id)) || new Set(fields).size !== fields.length)
      return failure(state, 'invalid_request');
    const sequence = state.sequence + 1;
    return updated(state, { sequence, delegation: { id: `synthetic-delegation-${sequence}`, ownerId: 'synthetic-parent',
      operatorId: 'synthetic-employee', fields: [...fields], approvedAtMs: state.nowMs, expiresAtMs: state.nowMs + DELEGATION_DURATION_MS, status: 'active' } });
  }
  if (type === 'revoke') {
    if (!state.delegation) return failure(state, 'invalid_request');
    return updated(state, { delegation: { ...state.delegation, status: 'revoked' } });
  }
  if (type === 'confirm') {
    const review = state.review;
    if (!review) return failure(state, 'review_required');
    const field = state.fields.find(item => item.id === review.fieldId);
    if (!field?.draft || field.draft.revision !== review.draftRevision || field.confirmedRevision !== review.confirmedRevision
      || field.draft.sample !== review.sample) return failure(state, 'review_changed');
    return updated(state, { review: null, fields: state.fields.map(item => item.id === field.id
      ? { ...item, confirmed: review.sample, confirmedRevision: item.confirmedRevision + 1, draft: null } : item) });
  }
  if (type === 'write') {
    if (delegationStatus(state) !== 'active') return failure(state, 'delegation_inactive');
    if (command.grantId !== state.delegation!.id) return failure(state, 'stale_delegation');
    if (!command.fieldId || !state.delegation!.fields.includes(command.fieldId)) return failure(state, 'not_authorized');
    if (command.sample !== 'a' && command.sample !== 'b') return failure(state, 'invalid_request');
    return updated(state, { fields: state.fields.map(field => field.id === command.fieldId
      ? { ...field, draftSequence: field.draftSequence + 1,
        draft: { sample: command.sample!, revision: field.draftSequence + 1, delegationId: state.delegation!.id } } : field) });
  }
  const field = state.fields.find(item => item.id === command.fieldId);
  if (!field?.draft) return failure(state, 'invalid_request');
  if (type === 'review') return updated(state, { review: { fieldId: field.id, draftRevision: field.draft.revision,
    confirmedRevision: field.confirmedRevision, sample: field.draft.sample } });
  return updated(state, { review: state.review?.fieldId === field.id ? null : state.review,
    fields: state.fields.map(item => item.id === field.id ? { ...item, draft: null } : item) });
}

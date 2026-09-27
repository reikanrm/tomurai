import { canCreateLifeNote, type LifeAccess } from './life-access.ts';
import { activeLifeFieldIds, cloneLifeValue, normalizeLifeValue, type LifeValue } from '../data/life-note-fields.ts';

export const DELEGATION_MS = 30 * 24 * 60 * 60 * 1000;
export const lifeTextFields = activeLifeFieldIds;
export type LifeTextField = typeof lifeTextFields[number];
export type LifeDraft = { text: LifeValue; revision: number; baseRevision: number; authorId: string; grantId: string };
export type LifeEntry = { id: LifeTextField; confirmed: LifeValue; confirmedRevision: number; draftSequence: number; draft: LifeDraft | null };
export type LifeDelegation = { id: string; operatorId: string; fieldIds: LifeTextField[]; approvedAt: number; expiresAt: number; ownerEligibilityEpoch: number; operatorEligibilityEpoch: number; status: 'active' | 'revoked' | 'expired' | 'ineligible' };
export type LifeNotebook = { id: string; ownerId: string; revision: number; sharingEnabled: false; fields: LifeEntry[]; delegation: LifeDelegation | null };
export type LifeCommand = { noteId: string; expectedRevision: number; operationId: string; type: 'save' | 'delegate' | 'draft' | 'confirm' | 'discard' | 'revoke'; fieldId?: LifeTextField; text?: LifeValue; operatorId?: string; fieldIds?: LifeTextField[]; grantId?: string; draftRevision?: number; confirmedRevision?: number };
export type LifeProjection = { noteId: string; revision: number; owner: boolean; canEdit: boolean; fields: LifeEntry[]; delegation: LifeDelegation | null; operators: {id: string; displayName: string}[] };
export type LifeTransaction = { note: LifeNotebook; people: (LifeAccess & {displayName: string})[]; eligibilityEpochs: Record<string, number>; approvedOperators: string[]; ownerCanApprove: boolean; receipts: { actorId: string; operationId: string; payload: string }[] };
/** The adapter must load current identities/eligibility and commit state + receipt atomically.
 * actorId is derived from server authentication, never accepted from a client body.
 * Eligibility events must atomically advance the person's epoch, including loss/restoration between reads. */
export type LifeRepository = { transaction<T>(work: (state: LifeTransaction) => T): Promise<T> };
export type LifeErrorCode = 'forbidden' | 'conflict' | 'invalid' | 'unavailable';
export class LifeServiceError extends Error { constructor(code: LifeErrorCode) { super(code); this.name = 'LifeServiceError'; } }
function fail(code: LifeErrorCode): never { throw new LifeServiceError(code); }
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
export const emptyNotebook = (id: string, ownerId: string): LifeNotebook => ({ id, ownerId, revision: 0, sharingEnabled: false, delegation: null,
  fields: lifeTextFields.map(id => ({ id, confirmed: '', confirmedRevision: 0, draftSequence: 0, draft: null })) });
const person = (state: LifeTransaction, id: string) => {
  const people = state.people.filter(p => p.userId === id);
  return people.length === 1 ? people[0] : undefined;
};
const eligible = (state: LifeTransaction, id: string) => { const p = person(state, id); return !!p && canCreateLifeNote(id, p); };
const staff = (state: LifeTransaction, id: string) => eligible(state, id) && person(state, id)?.corporateEligibility?.kind === 'employee';
const epoch = (state: LifeTransaction, id: string) => Number.isSafeInteger(state.eligibilityEpochs[id]) && state.eligibilityEpochs[id]! >= 0 ? state.eligibilityEpochs[id]! : -1;
function reconcile(state: LifeTransaction, now: number) {
  const grant = state.note.delegation;
  if (!grant || grant.status !== 'active') return;
  const status = now >= grant.expiresAt ? 'expired' : !eligible(state, state.note.ownerId) || !staff(state, grant.operatorId)
    || epoch(state, state.note.ownerId) !== grant.ownerEligibilityEpoch || epoch(state, grant.operatorId) !== grant.operatorEligibilityEpoch ? 'ineligible' : 'active';
  if (status !== 'active') { grant.status = status; state.note.revision++; }
}
function access(state: LifeTransaction, actorId: string, noteId: string, now: number) {
  const actor = person(state, actorId), note = state.note;
  if (note.id !== noteId || !actor?.authenticated || !actor.accountActive || actor.actorKind !== 'person') fail('forbidden');
  const owner = note.ownerId === actorId;
  const grant = note.delegation;
  const delegated = !!grant && grant.status === 'active' && grant.operatorId === actorId && now >= grant.approvedAt && now < grant.expiresAt
    && staff(state, actorId) && eligible(state, note.ownerId);
  if (!owner && !delegated) fail('forbidden');
  return { owner, editable: owner && eligible(state, actorId) && state.ownerCanApprove, delegated };
}
function projection(state: LifeTransaction, actorId: string, now: number): LifeProjection {
  const a = access(state, actorId, state.note.id, now), note = state.note;
  return { noteId: note.id, revision: note.revision, owner: a.owner, canEdit: a.owner ? a.editable : a.delegated,
    fields: note.fields.filter(f => lifeTextFields.includes(f.id) && (a.owner || note.delegation!.fieldIds.includes(f.id))).map(f => ({ ...f, confirmed:cloneLifeValue(f.confirmed), draft: f.draft ? { ...f.draft, text:cloneLifeValue(f.draft.text) } : null })),
    delegation: note.delegation ? { ...note.delegation, fieldIds: [...note.delegation.fieldIds] } : null,
    operators: a.owner ? state.approvedOperators.filter(id => id !== actorId && staff(state, id) && person(state,id)?.displayName.trim()).map(id=>({id,displayName:person(state,id)!.displayName})) : [] };
}
/** Shared application service: no UI state, synthetic values, network, logging or persistence policy. */
export function createLifeService(repository: LifeRepository, clock: () => number) {
  const transaction = async <T,>(run: (state: LifeTransaction, now: number) => T): Promise<T> => {
    // Denials return outside the transaction so expiry/eligibility invalidation is committed too.
    const result = await repository.transaction(state => {
      const now = clock();
      if (!Number.isSafeInteger(now) || now < 0) return { error: 'unavailable' as LifeErrorCode };
      reconcile(state, now);
      try { return { value: run(state, now) }; }
      catch (error) { if (error instanceof LifeServiceError) return { error: error.message as LifeErrorCode }; throw error; }
    });
    if ('error' in result) fail(result.error!);
    return result.value as T;
  };
  return {
    read(actorId: string, noteId: string) { return transaction((state, now) => { access(state, actorId, noteId, now); return projection(state, actorId, now); }); },
    execute(actorId: string, command: LifeCommand) { return transaction((state, now) => {
      const a = access(state, actorId, command.noteId, now), note = state.note;
      if (!validId(command.operationId) || !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0) fail('invalid');
      const allowed = ['noteId','expectedRevision','operationId','type','fieldId','text','operatorId','fieldIds','grantId','draftRevision','confirmedRevision'];
      if (Object.keys(command).some(k => !allowed.includes(k))) fail('invalid');
      if (!['save','delegate','draft','confirm','discard','revoke'].includes(command.type)) fail('invalid');
      if (command.type === 'draft' ? !a.delegated || !note.delegation || command.grantId !== note.delegation.id || !note.delegation.fieldIds.includes(command.fieldId!)
        : !a.owner || (['save','delegate','confirm'].includes(command.type) && !a.editable)) fail('forbidden');
      if(command.fieldId && !lifeTextFields.includes(command.fieldId))fail('invalid');
      const content = ['save','draft'].includes(command.type) ? normalizeLifeValue(command.fieldId!,command.text) : undefined;
      if(['save','draft'].includes(command.type)&&content===undefined)fail('invalid');
      const payload = JSON.stringify(Object.fromEntries(Object.entries({...command,...(content!==undefined?{text:content}:{})}).sort(([a], [b]) => a.localeCompare(b))));
      const receipt = state.receipts.find(r => r.actorId === actorId && r.operationId === command.operationId);
      if (receipt) { if (receipt.payload !== payload) fail('conflict'); return projection(state, actorId, now); }
      if (command.expectedRevision !== note.revision) fail('conflict');
      const field = note.fields.find(f => f.id === command.fieldId);
      if (['save','draft','confirm','discard'].includes(command.type) && !field) fail('invalid');
      switch (command.type) {
        case 'delegate': {
          if (note.delegation?.status === 'active') fail('conflict');
          const ids = command.fieldIds;
          if (!validId(command.operatorId) || command.operatorId === actorId || !state.approvedOperators.includes(command.operatorId) || !staff(state, command.operatorId)
            || !person(state,command.operatorId)?.displayName.trim() || epoch(state, actorId) < 0 || epoch(state, command.operatorId) < 0) fail('forbidden');
          if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !lifeTextFields.includes(id))) fail('invalid');
          note.delegation = { id: `${note.id}-${note.revision + 1}`, operatorId: command.operatorId, fieldIds: [...ids], approvedAt: now, expiresAt: now + DELEGATION_MS, ownerEligibilityEpoch:epoch(state,actorId), operatorEligibilityEpoch:epoch(state,command.operatorId), status: 'active' }; break;
        }
        case 'save':
          if (command.confirmedRevision !== field!.confirmedRevision) fail('conflict');
          field!.confirmed = content!; field!.confirmedRevision++; break;
        case 'draft':
          if (command.confirmedRevision !== field!.confirmedRevision || command.draftRevision !== (field!.draft?.revision ?? 0)) fail('conflict');
          field!.draftSequence++;
          field!.draft = { text: content!, revision: field!.draftSequence, baseRevision: field!.confirmedRevision, authorId: actorId, grantId: note.delegation!.id }; break;
        case 'confirm':
          if (!field!.draft || command.draftRevision !== field!.draft.revision || command.confirmedRevision !== field!.confirmedRevision || field!.draft.baseRevision !== field!.confirmedRevision) fail('conflict');
          field!.confirmed = field!.draft.text; field!.confirmedRevision++; field!.draft = null; break;
        case 'discard': if (!field!.draft || command.draftRevision !== field!.draft.revision) fail('conflict'); field!.draft = null; break;
        case 'revoke': if (!note.delegation || note.delegation.status !== 'active' || command.grantId !== note.delegation.id) fail('conflict'); note.delegation.status = 'revoked'; break;
      }
      note.revision++;
      state.receipts.push({ actorId, operationId: command.operationId, payload });
      return projection(state, actorId, now);
    }); },
  };
}

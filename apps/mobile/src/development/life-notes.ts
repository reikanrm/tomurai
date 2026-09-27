import { createLifeService, emptyNotebook, DELEGATION_MS, LifeServiceError, type LifeTransaction, type LifeRepository } from '../domain/life-notes-service.ts';
import type { LifeAccess } from '../domain/life-access.ts';
import type { LifeNotesPort } from '../domain/life-notes-port.ts';
export type CorporatePersona = 'corporate-employee' | 'corporate-family' | 'corporate-delegate';
export type CorporateScene = 'current' | 'empty' | 'review' | 'expired';
const identity = (userId: string, kind: 'employee' | 'invited-family'): LifeAccess & {displayName:string} => ({userId,displayName:kind==='employee'?'開発用社員':'開発用家族',authenticated:true,accountActive:true,actorKind:'person',
  corporateEligibility:{userId,corporationId:'dev-company',kind,verified:true,status:'active'},recipientMembership:null});
/** Development adapter only. Never inject into a real account/session. */
export function createDevelopmentLifeNotes() {
  const fresh = (id: string, owner: string): LifeTransaction => ({ note: emptyNotebook(id, owner), people:[identity('dev-employee','employee'),identity('dev-parent','invited-family')], eligibilityEpochs:{'dev-employee':0,'dev-parent':0}, approvedOperators: owner === 'dev-parent' ? ['dev-employee'] : [], ownerCanApprove:true, receipts:[] });
  let records = { employee:fresh('dev-own-note','dev-employee'), parent:fresh('dev-parent-note','dev-parent') };
  let queue: Promise<unknown> = Promise.resolve();
  let sceneEpoch = 0;
  const repository = (key: keyof typeof records): LifeRepository => ({ transaction<T>(work: (state: LifeTransaction) => T) {
    const requestedEpoch = sceneEpoch;
    const pending = queue.then(() => { if(requestedEpoch !== sceneEpoch) throw new LifeServiceError('conflict'); const next: LifeTransaction = JSON.parse(JSON.stringify(records[key])); const result = work(next); records[key] = next; return result; });
    queue = pending.catch(() => {}); return pending;
  } });
  const employee = createLifeService(repository('employee'), Date.now), parent = createLifeService(repository('parent'), Date.now);
  return {
    scene(scene: CorporateScene) {
      if (scene === 'current') return;
      sceneEpoch++;
      records = { employee:fresh('dev-own-note','dev-employee'), parent:fresh('dev-parent-note','dev-parent') };
      if (scene === 'review' || scene === 'expired') {
        const note = records.parent.note, now = Date.now();
        note.revision = 2; note.delegation = {id:'dev-grant',operatorId:'dev-employee',fieldIds:['future-try','future-family'],approvedAt:scene==='expired'?now-DELEGATION_MS:now,expiresAt:scene==='expired'?now:now+DELEGATION_MS,ownerEligibilityEpoch:0,operatorEligibilityEpoch:0,status:scene==='expired'?'expired':'active'};
        note.fields[0]!.draftSequence = 1;
        note.fields[0]!.draft = {text:'（開発用）季節の景色を見に行きたい。',revision:1,baseRevision:0,authorId:'dev-employee',grantId:'dev-grant'};
      }
    },
    port(persona: CorporatePersona): LifeNotesPort {
      const own = persona === 'corporate-employee', service = own ? employee : parent, actorId = persona === 'corporate-family' ? 'dev-parent' : 'dev-employee';
      const noteId = own ? 'dev-own-note' : 'dev-parent-note';
      return {mode:'development',read:()=>service.read(actorId,noteId),execute:command=>service.execute(actorId,{...command,noteId})};
    },
  };
}

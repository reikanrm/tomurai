import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifeService, emptyNotebook, DELEGATION_MS } from '../apps/mobile/src/domain/life-notes-service.ts';
import { createDevelopmentLifeNotes } from '../apps/mobile/src/development/life-notes.ts';

const identity = (id, kind='employee') => ({userId:id, displayName:`Synthetic ${id}`, authenticated:true, accountActive:true, actorKind:'person', corporateEligibility:{userId:id,corporationId:'synthetic-company',kind,verified:true,status:'active'},recipientMembership:null});
function fixture() {
  let clock=100000, db={note:emptyNotebook('note','parent'),people:[identity('parent','invited-family'),identity('employee')], eligibilityEpochs:{parent:0,employee:0}, approvedOperators:['employee'], ownerCanApprove:true, receipts:[]};
  const service=createLifeService({transaction:async fn=>{const copy=structuredClone(db);const result=fn(copy);db=copy;return result;}},()=>clock);
  let seq=0;
  const read=actor=>service.read(actor,'note');
  const command=async(actor,type,extra={})=>{const field=db.note.fields.find(f=>f.id===extra.fieldId);return service.execute(actor,{noteId:'note',expectedRevision:db.note.revision,operationId:`op-${++seq}`,type,confirmedRevision:field?.confirmedRevision,draftRevision:field?.draft?.revision??0,...(type==='revoke'?{grantId:db.note.delegation?.id}:{}),...extra});};
  return {read,command,service,db:()=>db, setTime:ms=>{clock=ms;}, time:()=>clock,person:(id,patch)=>{const p=db.people.find(p=>p.userId===id);Object.assign(p,patch);},grant:()=>command('parent','delegate',{operatorId:'employee',fieldIds:['future-try']})};
}
test('malformed authentication and account flags never return private values or accept writes',async()=>{
  for (const key of ['authenticated','accountActive']) {
    for (const value of [false,undefined,null,'false','true',0,1,{},[]]) {
      const f=fixture();
      await f.command('parent','save',{fieldId:'future-try',text:'合成の非公開本文'});
      f.person('parent',{[key]:value});
      const before=structuredClone(f.db());
      await assert.rejects(f.read('parent'),/forbidden/,`${key}=${String(value)} read`);
      await assert.rejects(f.command('parent','save',{fieldId:'future-try',text:'上書き不可'}),/forbidden/);
      assert.deepEqual(f.db(),before);
    }
  }
});

test('only boolean true permits owner save, delegation and draft confirmation; reading remains allowed',async()=>{
  for (const value of [false,undefined,null,'false','true',0,1,{},[]]) {
    for (const type of ['save','delegate','confirm']) {
      const f=fixture();
      if(type==='confirm') {
        await f.grant();
        await f.command('employee','draft',{fieldId:'future-try',text:'合成の提案',grantId:f.db().note.delegation.id});
      }
      f.db().ownerCanApprove=value;
      const before=structuredClone(f.db());
      const view=await f.read('parent');
      assert.equal(view.canEdit,false);
      await assert.rejects(f.command('parent',type,type==='delegate'
        ? {operatorId:'employee',fieldIds:['future-try']}
        : {fieldId:'future-try',text:'合成の編集'}),/forbidden/,`${type}: ${String(value)}`);
      assert.deepEqual(f.db(),before);
    }
  }
});

test('owner text, scoped delegation, employee draft and reviewed confirmation use actual values',async()=>{
  const f=fixture(); await f.command('parent','save',{fieldId:'future-try',text:'合成の希望'});await f.grant();
  await f.command('employee','draft',{fieldId:'future-try',text:'合成の下書き',grantId:f.db().note.delegation.id});
  const employee=await f.read('employee');assert.equal(employee.fields.length,1);assert.equal(employee.fields[0].confirmed,'合成の希望');
  const field=(await f.read('parent')).fields[0];await f.command('parent','confirm',{fieldId:field.id,draftRevision:field.draft.revision,confirmedRevision:field.confirmedRevision});
  assert.equal((await f.read('parent')).fields[0].confirmed,'合成の下書き');assert.equal(f.db().note.sharingEnabled,false);
});
test('self approval, strangers, companies, unknown or unselected fields and oversize/blank text fail closed',async()=>{
  const f=fixture();await assert.rejects(f.read('stranger'),/forbidden/);await assert.rejects(f.command('employee','delegate',{operatorId:'employee',fieldIds:['future-try']}),/forbidden/);
  await f.grant();
  for(const change of [{fieldId:'future-family',text:'x'},{fieldId:'password',text:'x'},{fieldId:'future-try',text:' '},{fieldId:'future-try',text:'x'.repeat(2001)}]) await assert.rejects(f.command('employee','draft',{grantId:f.db().note.delegation.id,...change}));
  await assert.rejects(f.command('employee','save',{fieldId:'future-try',text:'x'}),/forbidden/);
  f.person('employee',{actorKind:'company'});await assert.rejects(f.read('employee'),/forbidden/);
});
test('revocation/expiry stop delegated reads and writes but preserve parent records',async()=>{
  for(const stop of ['revoke','expiry']) {const f=fixture();await f.grant();await f.command('employee','draft',{fieldId:'future-try',text:'保持する合成文',grantId:f.db().note.delegation.id});
    if(stop==='revoke')await f.command('parent','revoke');else f.setTime(f.time()+DELEGATION_MS);
    await assert.rejects(f.read('employee'),/forbidden/);assert.equal((await f.read('parent')).fields[0].draft.text,'保持する合成文');
  }
});
test('eligibility loss recorded by a read cannot revive after restoring eligibility',async()=>{
  const f=fixture();await f.grant();f.person('employee',{corporateEligibility:null});await assert.rejects(f.read('employee'));
  f.person('employee',{corporateEligibility:identity('employee').corporateEligibility});await assert.rejects(f.read('employee'));
  await f.grant();assert.equal((await f.read('employee')).fields.length,1);
});
test('confirmation binds both draft and confirmed revision; stale operations do not overwrite',async()=>{
  const f=fixture();await f.grant();const grantId=f.db().note.delegation.id;
  await f.command('employee','draft',{fieldId:'future-try',text:'v1',grantId});const old=(await f.read('parent')).fields[0];
  await f.command('employee','draft',{fieldId:'future-try',text:'v2',grantId});await assert.rejects(f.command('parent','confirm',{fieldId:old.id,draftRevision:old.draft.revision,confirmedRevision:old.confirmedRevision}),/conflict/);
});
test('operation retry is idempotent, changed payload rejected and revoked operator cannot replay',async()=>{
  const f=fixture();await f.grant();const cmd={noteId:'note',expectedRevision:f.db().note.revision,operationId:'retry',type:'draft',fieldId:'future-try',text:'合成',confirmedRevision:0,draftRevision:0,grantId:f.db().note.delegation.id};
  await f.service.execute('employee',cmd);const rev=f.db().note.revision;await f.service.execute('employee',cmd);assert.equal(f.db().note.revision,rev);
  await assert.rejects(f.service.execute('employee',{...cmd,text:'変更'}),/conflict/);await f.command('parent','revoke');await assert.rejects(f.service.execute('employee',cmd),/forbidden/);
});
test('development personas share the service state but never receive other unapproved contents',async()=>{
  const dev=createDevelopmentLifeNotes();const parent=dev.port('corporate-family');const employee=dev.port('corporate-delegate');
  let view=await parent.read();await parent.execute({type:'delegate',fieldIds:['future-try'],operatorId:'dev-employee',expectedRevision:view.revision,operationId:'dev-1'});
  view=await employee.read();assert.equal(view.fields.length,1);assert.equal(view.owner,false);
  dev.scene('expired');await assert.rejects(employee.read(),/forbidden/);assert.ok(await parent.read());
});

test('eligibility epoch invalidates a grant even when loss and restoration happen between reads',async()=>{
  const f=fixture();await f.grant();f.db().eligibilityEpochs.employee+=2;
  await assert.rejects(f.read('employee'),/forbidden/);assert.equal(f.db().note.delegation.status,'ineligible');
  await f.grant();assert.equal((await f.read('employee')).fields.length,1);
});

test('stale save and discard cannot overwrite or remove a newer version',async()=>{
  const f=fixture();await f.command('parent','save',{fieldId:'future-try',text:'new'});
  await assert.rejects(f.command('parent','save',{fieldId:'future-try',text:'old',confirmedRevision:0}),/conflict/);
  await f.grant();const grantId=f.db().note.delegation.id;
  await f.command('employee','draft',{fieldId:'future-try',text:'v1',grantId});
  await f.command('employee','draft',{fieldId:'future-try',text:'v2',grantId});
  await assert.rejects(f.command('parent','discard',{fieldId:'future-try',draftRevision:1}),/conflict/);
  assert.equal(f.db().note.fields[0].draft.text,'v2');
});

test('resetting a development scene cannot commit an old queued command into the new scene',async()=>{
  const dev=createDevelopmentLifeNotes(),port=dev.port('corporate-employee');
  const pending=port.execute({type:'save',fieldId:'future-try',text:'old scene',confirmedRevision:0,expectedRevision:0,operationId:'old'});
  dev.scene('empty');await assert.rejects(pending,/conflict/);assert.equal((await port.read()).fields[0].confirmed,'');
});

test('old editor and cancellation cannot act using a replacement delegation',async()=>{
  const f=fixture();await f.grant();const oldId=f.db().note.delegation.id;
  await f.command('parent','revoke');await f.grant();
  await assert.rejects(f.command('employee','draft',{fieldId:'future-try',text:'old editor',grantId:oldId}),/forbidden/);
  await assert.rejects(f.command('parent','revoke',{grantId:oldId}),/conflict/);
  assert.equal(f.db().note.delegation.status,'active');
});

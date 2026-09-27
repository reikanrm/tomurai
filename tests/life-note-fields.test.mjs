import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevelopmentLifeNotes } from '../apps/mobile/src/development/life-notes.ts';
import { lifeFields, normalizeLifeValue } from '../apps/mobile/src/data/life-note-fields.ts';
const submit = async (port, fieldId, text, type='save', extra={}) => {
  const view=await port.read(), field=view.fields.find(f=>f.id===fieldId);
  return port.execute({type,fieldId,text,expectedRevision:view.revision,operationId:`case-${++sequence}`,confirmedRevision:field?.confirmedRevision,draftRevision:field?.draft?.revision??0,...extra});
};
let sequence=0;
test('seventeen audited fields are added and fourteen restricted fields remain unavailable',async()=>{
  const port=createDevelopmentLifeNotes().port('corporate-employee'), view=await port.read();
  assert.equal(view.fields.length,22);
  const blocked=lifeFields.filter(f=>f.kind==='blocked'); assert.equal(blocked.length,14);
  for(const {id} of blocked) {
    assert.ok(!view.fields.some(f=>f.id===id)); await assert.rejects(submit(port,id,'synthetic'),/invalid/);
  }
});

test('input size boundaries and malformed delegation lists are validated explicitly',async()=>{
  assert.equal(normalizeLifeValue('message-thanks','a'.repeat(2000)).length,2000);
  assert.equal(normalizeLifeValue('future-value',{note:'a'.repeat(2000)}).note.length,2000);
  assert.equal(normalizeLifeValue('future-value',{note:'a'.repeat(2001)}),undefined);
  assert.equal(normalizeLifeValue('me-pets',{name:'a'.repeat(200)}).name.length,200);
  assert.equal(normalizeLifeValue('me-family',Array.from({length:50},()=>({name:'合成'}))).length,50);
  const port=createDevelopmentLifeNotes().port('corporate-family');
  for(const fieldIds of ['abc',42,{length:1,0:'me-family'},[],['me-family','me-family'],...lifeFields.filter(f=>f.kind==='blocked').map(f=>[f.id])]) {
    const before=await port.read();
    await assert.rejects(port.execute({type:'delegate',operatorId:'dev-employee',fieldIds,expectedRevision:before.revision,operationId:`case-${++sequence}`}),/invalid/);
    assert.deepEqual(await port.read(),before);
  }
});
test('text, fixed fields, choices and ordered contact lists retain structured values',async()=>{
  const port=createDevelopmentLifeNotes().port('corporate-employee');
  for(const [id,value] of [['message-thanks','合成メッセージ'],['legal-documents','合成の保管場所'],['legal-guardian',{choice:'considering'}],['me-pets',{name:'合成ペット',kind:'猫',vet:'合成動物病院',carer:''}],['me-family',[{relation:'child',name:'合成家族',contact:'example@example.invalid'}]],['future-value',{choice:'nature',note:'合成の補足'}]]) {
    const result=await submit(port,id,value); assert.deepEqual(result.fields.find(f=>f.id===id).confirmed,value);
  }
});
test('unknown keys/options, wrong shape, empty and oversized values cannot mutate notes',async()=>{
  const port=createDevelopmentLifeNotes().port('corporate-employee');
  for(const [id,value] of [['me-family',[{name:'x',password:'secret'}]],['me-family',[{relation:'unknown',name:'x',contact:''}]],['me-family',[]],['me-family',Array.from({length:51},()=>({name:'x'}))],['me-pets',{name:'x'.repeat(201)}],['legal-guardian',{choice:'wrong'}],['legal-guardian','契約済み'],['message-thanks',{text:'x'}],['message-thanks',' '.repeat(3)],['message-thanks','x'.repeat(2001)],['me-pets',{name:42}],['future-value',{choice:'work',secret:'x'}]]) {
    const before=await port.read(); await assert.rejects(submit(port,id,value),/invalid/); assert.deepEqual(await port.read(),before);
  }
});
test('structured values have scoped delegation, version-bound review and detached projections',async()=>{
  const dev=createDevelopmentLifeNotes(), parent=dev.port('corporate-family'), employee=dev.port('corporate-delegate');
  let view=await parent.read(); await parent.execute({type:'delegate',operatorId:'dev-employee',fieldIds:['me-family'],expectedRevision:view.revision,operationId:`case-${++sequence}`});
  view=await employee.read();assert.deepEqual(view.fields.map(f=>f.id),['me-family']);
  const value=[{relation:'child',name:'合成家族',contact:''}];
  await submit(employee,'me-family',value,'draft',{grantId:view.delegation.id});
  view=await parent.read();const field=view.fields.find(f=>f.id==='me-family');
  await parent.execute({type:'confirm',fieldId:field.id,expectedRevision:view.revision,operationId:`case-${++sequence}`,draftRevision:field.draft.revision,confirmedRevision:field.confirmedRevision});
  const projected=await parent.read();projected.fields.find(f=>f.id==='me-family').confirmed[0].name='outside';
  assert.equal((await parent.read()).fields.find(f=>f.id==='me-family').confirmed[0].name,'合成家族');
  await assert.rejects(submit(employee,'message-thanks','not selected','draft',{grantId:view.delegation.id}),/forbidden/);
  assert.equal((await parent.read()).fields.find(f=>f.id==='me-family').draft,null);
});

test('every enabled field supports owner entry, scoped draft, stale rejection and owner confirmation',async()=>{
  for(const def of lifeFields.filter(f=>f.kind!=='blocked')) {
    const dev=createDevelopmentLifeNotes(), owner=dev.port('corporate-family'), delegate=dev.port('corporate-delegate');
    const makeValue=label=>def.kind==='text'||def.kind==='short'?label:((row)=>def.kind==='rows'?[row]:row)(Object.fromEntries(def.columns.map(col=>[col.id,col.options?.[0].id??label])));
    await submit(owner,def.id,makeValue('合成の本人メモ'));
    let view=await owner.read();
    await owner.execute({type:'delegate',operatorId:'dev-employee',fieldIds:[def.id],expectedRevision:view.revision,operationId:`case-${++sequence}`});
    view=await delegate.read();assert.deepEqual(view.fields.map(f=>f.id),[def.id]);
    await submit(delegate,def.id,makeValue('合成の下書き1'),'draft',{grantId:view.delegation.id});
    const old=(await owner.read()).fields.find(f=>f.id===def.id).draft.revision;
    await submit(delegate,def.id,makeValue('合成の下書き2'),'draft',{grantId:view.delegation.id});
    view=await owner.read();const entry=view.fields.find(f=>f.id===def.id);
    const command={type:'confirm',fieldId:def.id,expectedRevision:view.revision,confirmedRevision:entry.confirmedRevision};
    await assert.rejects(owner.execute({...command,draftRevision:old,operationId:`case-${++sequence}`}),/conflict/);
    const result=await owner.execute({...command,draftRevision:entry.draft.revision,operationId:`case-${++sequence}`});
    assert.deepEqual(result.fields.find(f=>f.id===def.id).confirmed,normalizeLifeValue(def.id,makeValue('合成の下書き2')));
    assert.equal(result.fields.find(f=>f.id===def.id).draft,null);
  }
});

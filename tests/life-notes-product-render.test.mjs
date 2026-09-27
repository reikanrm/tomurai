import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import * as domain from '../apps/mobile/src/domain/life-notes-service.ts';
import { unavailableLifeNotes } from '../apps/mobile/src/domain/life-notes-port.ts';
import { createDevelopmentLifeNotes } from '../apps/mobile/src/development/life-notes.ts';
import * as catalog from '../apps/mobile/src/data/life-notes.ts';
import * as theme from '../apps/mobile/src/theme.ts';
const source=readFileSync('apps/mobile/src/components/LifeNotesWorkspace.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x&&typeof x==='object'?(x.type==='Modal'&&!x.props.visible?[]:[x,...nodes(x.children??[])]):[];
const text=x=>Array.isArray(x)?x.map(text).join(''):x&&typeof x==='object'?text(x.children??[]):typeof x==='string'||typeof x==='number'?String(x):'';
function harness(port,locale='ja') {
  let i=0, hooks=[], effects=[], resume;
  const react={Fragment:'Fragment',createElement:(type,props,...children)=>({type,props:props??{},children}),
    useState(initial){const n=i++;if(!(n in hooks))hooks[n]=typeof initial==='function'?initial():initial;return[hooks[n],next=>{hooks[n]=typeof next==='function'?next(hooks[n]):next;}];},
    useRef(initial){const n=i++;return hooks[n]??(hooks[n]={current:initial});},
    useEffect(fn,deps){const n=i++;if(!hooks[n]||deps.some((v,k)=>v!==hooks[n].deps[k])){effects.push(()=>{hooks[n]?.cleanup?.();hooks[n]={deps,cleanup:fn()};});}}};
  const native=Object.fromEntries(['View','Text','TextInput','Pressable','ScrollView','Modal'].map(x=>[x,x]));native.StyleSheet={create:x=>x};native.AppState={addEventListener:(_,fn)=>{resume=fn;return{remove(){resume=null;}};}};
  const ctx={exports:{},React:react,setTimeout:()=>1,clearTimeout(){},require(id){if(id==='react')return react;if(id==='react-native')return native;if(id==='../theme')return theme;if(id==='../data/life-notes')return catalog;if(id==='../domain/life-notes-service')return domain;throw Error(id);}};
  vm.runInNewContext(compiled,ctx);
  const render=()=>{i=0;const tree=ctx.exports.LifeNotesWorkspace({locale,port,onOpenNotes(){},onBack(){}});const work=effects;effects=[];work.forEach(fn=>fn());return tree;};
  const node=id=>nodes(render()).find(n=>n.props.testID===id);
  return {render,node,resume(){resume?.('active');},setPort(next){port=next;render();},async flush(){for(let n=0;n<15;n++){await Promise.resolve();render();}},press(id){const n=node(id);assert.ok(n,id);assert.notEqual(n.props.disabled,true,id);n.props.onPress();},fill(value){node('notes-input').props.onChangeText(value);}};
}
test('product screen edits arbitrary text in both languages without rehearsal controls',async()=>{
  for(const locale of ['ja','en']){const h=harness(createDevelopmentLifeNotes().port('corporate-employee'),locale);h.render();await h.flush();
    h.press('notes-edit-future-try');h.fill('Synthetic note / 合成の入力文');h.press('notes-save');await h.flush();
    assert.match(text(h.node('notes-field-future-try')),/Synthetic note/);assert.equal(h.node('notes-input'),undefined);
    assert.doesNotMatch(text(h.render()),/例文A|練習|Parent view|社員の視点/);
  }
});
test('same product screen handles owner approval, delegated free text and reviewed confirmation',async()=>{
  const dev=createDevelopmentLifeNotes(),h=harness(dev.port('corporate-family'));h.render();await h.flush();h.press('notes-delegate-open');h.press('notes-select-future-try');h.press('notes-delegate');await h.flush();
  h.setPort(dev.port('corporate-delegate'));await h.flush();assert.equal(h.node('notes-field-future-family'),undefined);
  h.press('notes-edit-future-try');h.fill('合成の代理入力');h.press('notes-save');await h.flush();
  assert.equal(h.node('notes-review-future-try'),undefined);
  h.setPort(dev.port('corporate-family'));await h.flush();h.press('notes-review-future-try');h.press('notes-confirm');await h.flush();assert.match(text(h.node('notes-field-future-try')),/合成の代理入力/);
  h.press('notes-revoke-open');h.press('notes-revoke');await h.flush();h.setPort(dev.port('corporate-delegate'));await h.flush();assert.equal(h.node('notes-field-future-try'),undefined);
});
test('not connected, failure and pending mutation do not report successful storage',async()=>{
  const h=harness(unavailableLifeNotes);h.render();await h.flush();assert.match(text(h.render()),/保存完了を確認できません/);assert.equal(h.node('notes-input'),undefined);
  const base=createDevelopmentLifeNotes().port('corporate-employee');let reject;const failure={...base,execute:()=>new Promise((_,r)=>{reject=r;})};
  h.setPort(failure);await h.flush();h.press('notes-edit-future-try');h.fill('合成');h.press('notes-save');assert.equal(h.node('notes-save').props.disabled,true);assert.doesNotMatch(text(h.render()),/反映しました|保存しました/);
  reject(Error('offline'));await h.flush();assert.match(text(h.render()),/保存完了を確認できません/);assert.equal(h.node('notes-input').props.value,'合成');
});
test('unsaved edits require discard confirmation and persona change discards old responses',async()=>{
  const dev=createDevelopmentLifeNotes();let resolve;const delayed={mode:'development',read:()=>new Promise(r=>{resolve=r;}),execute:()=>Promise.reject(Error())};
  const h=harness(delayed);h.render();const old=await dev.port('corporate-family').read();h.setPort(unavailableLifeNotes);resolve(old);await h.flush();assert.equal(h.node('notes-field-future-try'),undefined);
  h.setPort(dev.port('corporate-employee'));await h.flush();h.press('notes-edit-future-try');h.fill('合成');h.press('notes-close');assert.ok(h.node('notes-discard-confirm'));h.press('notes-continue');assert.ok(h.node('notes-input'));h.press('notes-close');h.press('notes-discard-confirm');assert.equal(h.node('notes-input'),undefined);
});
test('corporate menu is explicit, ordinary URL and release do not grant an account',()=>{
  const app=readFileSync('apps/mobile/src/App.tsx','utf8'),menu=readFileSync('apps/mobile/src/components/DevelopmentMenu.tsx','utf8');
  for(const label of ['法人・社員本人','法人・招待家族','法人・代理入力担当','親の下書き確認待ち','委任期限切れ']) assert.ok(menu.includes(label));
  assert.match(app,/lifePreviewEligible && lifeDevelopment \? lifeDevelopment.port/);assert.match(app,/: unavailableLifeNotes/);
  assert.doesNotMatch(source,/life-delegation-rehearsal|createDevelopmentLifeNotes|setPreviewAccess|localStorage|AsyncStorage|fetch\(/);
});

test('same-port foreground reauthorization clears a no-longer-delegated editor',async()=>{
  const dev=createDevelopmentLifeNotes();dev.scene('review');const h=harness(dev.port('corporate-delegate'));h.render();await h.flush();
  h.press('notes-edit-future-try');h.fill('old scope');
  const parent=dev.port('corporate-family');let v=await parent.read();
  await parent.execute({type:'revoke',grantId:v.delegation.id,expectedRevision:v.revision,operationId:'revoke'});v=await parent.read();
  await parent.execute({type:'delegate',operatorId:'dev-employee',fieldIds:['future-family'],expectedRevision:v.revision,operationId:'narrow'});
  h.resume();await h.flush();assert.equal(h.node('notes-input'),undefined);assert.equal(h.node('notes-field-future-try'),undefined);assert.doesNotMatch(text(h.render()),/old scope/);
});

test('transient read failure hides unsaved text, restores it only after successful reauthorization',async()=>{
  const base=createDevelopmentLifeNotes().port('corporate-employee');let offline=false;
  const h=harness({...base,read:()=>offline?Promise.reject(Error('offline')):base.read()});h.render();await h.flush();
  h.press('notes-edit-future-try');h.fill('unsaved synthetic text');offline=true;h.resume();await h.flush();
  assert.equal(h.node('notes-input'),undefined);assert.doesNotMatch(text(h.render()),/unsaved synthetic text/);
  offline=false;h.press('notes-reload');await h.flush();assert.equal(h.node('notes-input').props.value,'unsaved synthetic text');
});

test('an older read response cannot replace a more recent one',async()=>{
  const base=createDevelopmentLifeNotes().port('corporate-employee');let delayed=false;const replies=[];
  const h=harness({...base,read:()=>delayed?new Promise(resolve=>replies.push(resolve)):base.read()});h.render();await h.flush();
  const old=await base.read(),latest=structuredClone(old);latest.fields[0].confirmed='latest synthetic';latest.revision++;
  delayed=true;h.resume();h.resume();replies[1](latest);await h.flush();replies[0](old);await h.flush();
  assert.match(text(h.node('notes-field-future-try')),/latest synthetic/);
});

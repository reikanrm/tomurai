import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as domain from '../apps/mobile/src/domain/municipal-guidance.ts';
import * as theme from '../apps/mobile/src/theme.ts';

const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...nodes(value.children??[])]:[];
const text=value=>Array.isArray(value)?value.map(text).join(''):value&&typeof value==='object'?text(value.children??[]):typeof value==='string'?value:'';
function harness(value=domain.emptyMunicipalJurisdiction,locale='ja',openURL=async()=>{}) {
  let index=0,applied=null;
  const hooks=[],cleanups=[];
  const react={createElement:(type,props,...children)=>({type,props:props??{},children}),
    useState(initial){const i=index++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},
    useRef(initial){const i=index++;return hooks[i]??={current:initial};},
    useEffect(fn){const i=index++;if(!(i in hooks)){hooks[i]=true;cleanups.push(fn());}},
  };
  const native={View:'View',Text:'Text',Pressable:'Pressable',Linking:{openURL},StyleSheet:{create:s=>s}};
  const source=readFileSync('apps/mobile/src/components/MunicipalGuidancePanel.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},React:react,require(id){if(id==='react')return react;if(id==='react-native')return native;if(id==='../theme')return theme;if(id==='../domain/municipal-guidance')return domain;throw Error(id);}};
  vm.runInNewContext(code,context);
  const render=()=>{index=0;return context.exports.MunicipalGuidancePanel({locale,taskId:'confirm-death-registration',today:'2026-09-27',value,onApply:v=>{applied=v;}});};
  const find=label=>nodes(render()).find(n=>n.type==='Pressable'&&text(n).includes(label));
  return {render,find,applied:()=>applied,click(label){const n=find(label);assert.ok(n,label);assert.notEqual(n.props.disabled,true,label);n.props.onPress();},unmount(){cleanups.forEach(fn=>fn?.());}};
}

test('ward selection is explicit, scoped draft and restored only after applying',()=>{
  const h=harness();h.click('横浜市');h.click('青葉区');
  assert.equal(h.find('管轄区も').props.disabled,true);
  h.click('管轄自治体を確認');h.click('管轄区も');
  assert.equal(h.applied(),null);
  h.click('この手続きに適用');const applied=h.applied();
  assert.equal(applied.districtId,'aoba');assert.equal(applied.districtJurisdictionConfirmed,true);
  h.click('中区');assert.equal(h.find('管轄自治体を確認').props.accessibilityState.checked,false);
  h.unmount();const restored=harness(applied);
  assert.equal(restored.find('青葉区').props.accessibilityState.checked,true);
  assert.equal(restored.find('管轄区も').props.accessibilityState.checked,true);
  const other=harness();assert.equal(other.find('横浜市').props.accessibilityState.checked,false);
  assert.equal(other.find('青葉区'),undefined);
});

test('municipality change removes district and both approvals, unknown remains applicable',()=>{
  const h=harness({municipalityId:'yokohama',districtId:'aoba',jurisdictionConfirmed:true,districtJurisdictionConfirmed:true});
  h.click('渋谷区');assert.equal(h.find('青葉区'),undefined);
  assert.equal(h.find('管轄自治体を確認').props.accessibilityState.checked,false);
  h.click('未確認・その他');h.click('この手続きに適用');
  assert.deepEqual(h.applied(),domain.emptyMunicipalJurisdiction);
  assert.equal(h.find('公式案内を開く'),undefined);
});

test('English labels and failure/retry use only catalog URLs, late errors do not cross selections',async()=>{
  const calls=[];let reject;
  const h=harness(domain.emptyMunicipalJurisdiction,'en',url=>{calls.push(url);return new Promise((_,fail)=>{reject=fail;});});
  h.click('Yokohama');h.click('Hodogaya Ward');
  assert.equal(nodes(h.render()).filter(n=>n.props.accessibilityRole==='radio').length,22);
  h.click('Open official guidance');reject(Error('synthetic'));await new Promise(setImmediate);
  assert.match(text(h.render()),/Could not open/);
  h.click('Open official guidance');h.click('Shibuya');reject(Error('old'));await new Promise(setImmediate);
  assert.doesNotMatch(text(h.render()),/Could not open/);
  assert.ok(calls.every(url=>url==='https://www.city.yokohama.lg.jp/life/gohukou.html'));
  assert.match(text(h.render()),/not yet synced/);
});

test('App stores selection by accessible task ID and clears on answers and development identity changes',()=>{
  const app=readFileSync('apps/mobile/src/App.tsx','utf8');
  assert.match(app,/value=\{jurisdictions\[selected.id\] \?\? emptyMunicipalJurisdiction\}/);
  assert.match(app,/onApply=\{value=>setJurisdictions\(current=>\(\{\.\.\.current,\[selected.id\]:normalizeMunicipalJurisdiction\(value\)\}\)\)\}/);
  assert.match(app,/const selected = visibleTasks.find/);
  assert.match(app,/setAnswers\(next\);\s*setJurisdictions\(\{\}\);/);
  assert.match(app.slice(app.indexOf('const changePreview'),app.indexOf('const renderTask')),/setJurisdictions\(\{\}\)/);
});

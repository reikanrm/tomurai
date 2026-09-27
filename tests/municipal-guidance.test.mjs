import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMunicipalGuidance, municipalDirectories } from '../apps/mobile/src/domain/municipal-guidance.ts';
import * as jurisdiction from '../apps/mobile/src/domain/municipal-guidance.ts';
const input = { municipalityId:'shibuya', taskId:'confirm-household-head', locale:'ja', jurisdictionConfirmed:true, today:'2026-09-26' };
const record = { municipalityId:'shibuya', taskId:input.taskId, locale:'ja', version:'fixture-v1', body:'合成の試験案内',
  officialUrl:municipalDirectories[0].url, checkedOn:'2026-09-25', approvedBy:'synthetic-reviewer', validFrom:'2026-09-25', validUntil:'2026-10-25' };
test('only an exact reviewed valid jurisdiction version is returned', () => {
  assert.equal(selectMunicipalGuidance(input,[record])?.body, record.body);
  for (const change of [{municipalityId:'yokohama'},{taskId:'other'},{locale:'en'},{jurisdictionConfirmed:false},{today:'2026-10-26'}])
    assert.equal(selectMunicipalGuidance({...input,...change},[record]),null);
});
test('unreviewed, unsafe URLs, invalid dates and duplicate active versions fail closed', () => {
  for (const change of [{approvedBy:''},{checkedOn:''},{officialUrl:'javascript:alert(1)'},{officialUrl:'https://city.shibuya.tokyo.jp.evil.example/x'},
    {officialUrl:'https://user:secret@www.city.shibuya.tokyo.jp/x'},{checkedOn:'2026-09-27'},{validUntil:'bad'}])
    assert.equal(selectMunicipalGuidance(input,[{...record,...change}]),null);
  assert.equal(selectMunicipalGuidance(input,[record,{...record,version:'v2'}]),null);
  assert.equal(selectMunicipalGuidance(input,[]),null);
});

test('missing or malformed records are excluded instead of throwing', () => {
  for (const key of Object.keys(record)) {
    for (const value of [undefined, null, 42, {}, []]) {
      assert.equal(selectMunicipalGuidance(input,[{...record,[key]:value}]),null, `${key}: ${String(value)}`);
    }
  }
  for (const value of [null, undefined, false, 'not a record', [], {}]) {
    assert.equal(selectMunicipalGuidance(input,[value]),null);
  }
  assert.equal(selectMunicipalGuidance(input,[null,record])?.version,record.version);
});

test('Yokohama requires a known and separately confirmed matching district', () => {
  const cityInput = {...input,municipalityId:'yokohama'};
  const cityRecord = {...record,municipalityId:'yokohama',officialUrl:municipalDirectories[1].url};
  assert.equal(selectMunicipalGuidance(cityInput,[cityRecord]),null);
  const districtRecord = {...cityRecord,districtId:'aoba'};
  assert.equal(selectMunicipalGuidance(cityInput,[districtRecord]),null);
  const districtInput = {...cityInput,districtId:'aoba',districtJurisdictionConfirmed:true};
  assert.equal(selectMunicipalGuidance(districtInput,[districtRecord])?.version,record.version);
  for (const change of [{districtId:null},{districtId:''},{districtId:'synthetic-ward-b'},{districtJurisdictionConfirmed:false}]) {
    assert.equal(selectMunicipalGuidance({...districtInput,...change},[districtRecord]),null);
  }
  assert.equal(selectMunicipalGuidance(districtInput,[cityRecord]),null);
  assert.equal(selectMunicipalGuidance({...input,districtId:'synthetic-ward-a',districtJurisdictionConfirmed:true},[record]),null);
  assert.equal(selectMunicipalGuidance({...districtInput,districtId:'unknown'},[{...districtRecord,districtId:'unknown'}]),null);
});

test('municipality and district changes clear prior confirmations; unknown cannot become reviewed', () => {
  const {emptyMunicipalJurisdiction:empty, changeMunicipalJurisdiction:change}=jurisdiction;
  assert.equal(typeof change,'function');
  let value=change(empty,{type:'municipality',value:'yokohama'});
  value=change(value,{type:'district',value:'aoba'});
  value=change(value,{type:'confirm-municipality',value:true});
  value=change(value,{type:'confirm-district',value:true});
  assert.equal(value.districtJurisdictionConfirmed,true);
  const previous=structuredClone(value);
  assert.deepEqual(change(value,{type:'district',value:'aoba'}),previous);
  const next=change(value,{type:'district',value:'naka'});
  assert.equal(next.jurisdictionConfirmed,false);assert.equal(next.districtJurisdictionConfirmed,false);
  assert.deepEqual(value,previous);
  const city=change(value,{type:'municipality',value:'shibuya'});
  assert.equal(city.districtId,null);assert.equal(city.jurisdictionConfirmed,false);
  assert.deepEqual(change(value,{type:'municipality',value:''}),empty);
  assert.equal(change(empty,{type:'confirm-municipality',value:true}).jurisdictionConfirmed,false);
});

test('known 18 wards and strict booleans bound selections without enabling unreviewed content', () => {
  const {municipalDistricts:wards,normalizeMunicipalJurisdiction:normalize}=jurisdiction;
  assert.equal(typeof normalize,'function');
  assert.equal(wards.length,18);assert.equal(new Set(wards.map(w=>w.id)).size,18);
  for(const ward of wards) {
    const selected=normalize({municipalityId:'yokohama',districtId:ward.id,jurisdictionConfirmed:true,districtJurisdictionConfirmed:true});
    assert.equal(selected.districtId,ward.id);
    assert.equal(selectMunicipalGuidance({...input,...selected},[]),null);
  }
  for(const value of ['true','false',1,{},[],null,undefined]) {
    const selected=normalize({municipalityId:'yokohama',districtId:'aoba',jurisdictionConfirmed:value,districtJurisdictionConfirmed:value});
    assert.equal(selected.jurisdictionConfirmed,false);assert.equal(selected.districtJurisdictionConfirmed,false);
  }
  for(const districtId of ['foreign',{},1]) {
    const selected=normalize({municipalityId:'yokohama',districtId,jurisdictionConfirmed:true,districtJurisdictionConfirmed:true});
    assert.equal(selected.districtId,null);assert.equal(selected.jurisdictionConfirmed,false);
  }
});

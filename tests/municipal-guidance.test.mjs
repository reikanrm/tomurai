import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMunicipalGuidance, municipalDirectories } from '../apps/mobile/src/domain/municipal-guidance.ts';
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

test('Yokohama requires separately confirmed matching district; current city-only UI cannot reveal details', () => {
  const cityInput = {...input,municipalityId:'yokohama'};
  const cityRecord = {...record,municipalityId:'yokohama',officialUrl:municipalDirectories[1].url};
  assert.equal(selectMunicipalGuidance(cityInput,[cityRecord]),null);
  const districtRecord = {...cityRecord,districtId:'synthetic-ward-a'};
  assert.equal(selectMunicipalGuidance(cityInput,[districtRecord]),null);
  const districtInput = {...cityInput,districtId:'synthetic-ward-a',districtJurisdictionConfirmed:true};
  assert.equal(selectMunicipalGuidance(districtInput,[districtRecord])?.version,record.version);
  for (const change of [{districtId:null},{districtId:''},{districtId:'synthetic-ward-b'},{districtJurisdictionConfirmed:false}]) {
    assert.equal(selectMunicipalGuidance({...districtInput,...change},[districtRecord]),null);
  }
  assert.equal(selectMunicipalGuidance(districtInput,[cityRecord]),null);
  assert.equal(selectMunicipalGuidance({...input,districtId:'synthetic-ward-a',districtJurisdictionConfirmed:true},[record]),null);
});

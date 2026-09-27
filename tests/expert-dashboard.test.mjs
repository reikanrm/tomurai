import test from 'node:test';
import assert from 'node:assert/strict';
import { projectExpertCase, transitionExpertCase } from '../apps/mobile/src/domain/expert-dashboard.ts';
const context={userId:'staff',tenantId:'office',role:'staff',authenticated:true,memberActive:true,intakeActive:true,now:'2026-09-26T00:00:00Z'};
const entry={id:'case',tenantId:'office',assigneeId:'staff',revision:1,state:'received',createdAt:'2026-09-25T00:00:00Z',expiresAt:'2026-10-01T00:00:00Z',consentActive:true,payload:{message:'合成の相談',replyEmail:'synthetic@example.test'},familyRecords:{secret:'must not escape'}};
test('assigned active staff receive only the authorized consultation snapshot',()=>{
  const result=projectExpertCase(context,entry);
  assert.deepEqual(result,{id:'case',revision:1,state:'received',createdAt:entry.createdAt,payload:entry.payload});
  assert.ok(!JSON.stringify(result).includes('must not escape'));
});
test('cross tenant, former staff, employer and expired consent/storage fail closed',()=>{
  for(const change of [{tenantId:'other'},{userId:'unassigned'},{role:'employer'},{authenticated:false},{memberActive:false},{intakeActive:false}]) assert.equal(projectExpertCase({...context,...change},entry),null);
  for(const change of [{consentActive:false},{expiresAt:null},{expiresAt:'2026-09-26T00:00:00Z'}]) assert.equal(projectExpertCase(context,{...entry,...change}),null);
});
test('admin sees metadata, not arbitrary case body; state changes require assignment and revision',()=>{
  const admin={...context,userId:'admin',role:'admin'};
  assert.equal(projectExpertCase(admin,entry).payload,undefined);
  assert.equal(transitionExpertCase(admin,entry,1,'in_progress'),null);
  assert.equal(transitionExpertCase(context,entry,0,'in_progress'),null);
  assert.equal(transitionExpertCase(context,entry,1,'resolved'),null);
  const next=transitionExpertCase(context,entry,1,'in_progress');
  assert.equal(next.revision,2);
  assert.equal(transitionExpertCase(context,next,2,'resolved').state,'resolved');
});

test('malformed payloads are rejected without throwing during projection or transition', () => {
  for (const payload of [null, undefined, 'invalid', [], {}, { message: 3, replyEmail: 'synthetic@example.test' },
    { message: 'synthetic', replyEmail: null }]) {
    const malformed = { ...entry, payload };
    assert.equal(projectExpertCase(context, malformed), null);
    assert.equal(transitionExpertCase(context, malformed, 1, 'in_progress'), null);
  }
});

test('invalid creation date, chronology and state never become visible metadata or transition candidates', () => {
  const admin = { ...context, userId: 'admin', role: 'admin' };
  for (const patch of [{ createdAt: undefined }, { createdAt: 'not-a-date' }, { createdAt: '2026-02-30T00:00:00Z' },
    { createdAt: '2026-09-27T00:00:00Z' }, { createdAt: entry.expiresAt }, { state: undefined }, { state: 'invented' }]) {
    const malformed = { ...entry, ...patch };
    assert.equal(projectExpertCase(context, malformed), null);
    assert.equal(projectExpertCase(admin, malformed), null);
    assert.equal(transitionExpertCase(context, malformed, 1, 'in_progress'), null);
  }
});

test('malformed outer values and nonboolean authorization flags fail closed', () => {
  for (const invalid of [null, undefined, [], {}]) {
    assert.equal(projectExpertCase(invalid, entry), null);
    assert.equal(projectExpertCase(context, invalid), null);
    assert.equal(transitionExpertCase(invalid, entry, 1, 'in_progress'), null);
    assert.equal(transitionExpertCase(context, invalid, 1, 'in_progress'), null);
  }
  for (const key of ['authenticated', 'memberActive', 'intakeActive']) {
    for (const value of ['false', 1, {}]) {
      assert.equal(projectExpertCase({ ...context, [key]: value }, entry), null);
      assert.equal(transitionExpertCase({ ...context, [key]: value }, entry, 1, 'in_progress'), null);
    }
  }
  assert.equal(projectExpertCase(context, { ...entry, consentActive: 'false' }), null);
});

test('revision exhaustion cannot emit an unsafe increment or bypass expected revision', () => {
  for (const revision of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(projectExpertCase(context, { ...entry, revision }), null);
    assert.equal(transitionExpertCase(context, { ...entry, revision }, revision, 'in_progress'), null);
  }
  assert.equal(transitionExpertCase(context, { ...entry, revision: Number.MAX_SAFE_INTEGER }, Number.MAX_SAFE_INTEGER, 'in_progress'), null);
});

test('only valid UTC instants admit the created-inclusive/expires-exclusive window', () => {
  for (const now of ['2026-09-26', '2026-09-26T00:00:00', '2026-09-26T24:00:00Z', '2026-02-30T00:00:00Z', '2026-09-24T23:59:59.999Z']) {
    assert.equal(projectExpertCase({ ...context, now }, entry), null);
  }
  assert.ok(projectExpertCase({ ...context, now: entry.createdAt }, entry));
  assert.ok(projectExpertCase({ ...context, now: '2026-09-30T23:59:59.999Z' }, entry));
  assert.equal(projectExpertCase({ ...context, now: entry.expiresAt }, entry), null);
  for (const expiresAt of ['2026-09-30', '2026-09-30T00:00:00', '2026-11-31T00:00:00Z']) {
    assert.equal(projectExpertCase(context, { ...entry, expiresAt }), null);
  }
});

test('blank or malformed identities never confer assigned or admin metadata access', () => {
  for (const badId of ['', '   ', 'staff\n', 1, null]) {
    assert.equal(projectExpertCase({ ...context, userId: badId }, { ...entry, assigneeId: badId }), null);
    assert.equal(projectExpertCase(context, { ...entry, id: badId }), null);
  }
  assert.equal(projectExpertCase({ ...context, userId: 'admin', role: 'admin' }, { ...entry, assigneeId: undefined }), null);
  assert.ok(projectExpertCase({ ...context, userId: 'admin', role: 'admin' }, { ...entry, assigneeId: null }));
});

test('projection and state changes copy only snapshot fields, not hidden data or input references', () => {
  const source = structuredClone(entry);
  source.payload.internalSecret = 'must not escape either';
  const before = structuredClone(source);
  const projected = projectExpertCase(context, source);
  const transitioned = transitionExpertCase(context, source, 1, 'in_progress');
  assert.deepEqual(source, before);
  for (const output of [projected, transitioned]) {
    assert.doesNotMatch(JSON.stringify(output), /must not escape/);
    output.payload.message = 'changed output only';
    assert.equal(source.payload.message, before.payload.message);
  }
  assert.equal(transitionExpertCase(context, entry, 1, 'invented'), null);
  assert.equal(transitionExpertCase(context, { ...entry, state: 'resolved' }, 1, 'received'), null);
});

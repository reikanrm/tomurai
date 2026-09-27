import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configuredCorporateRateTable, corporateCaseTermsVersion, emptyCorporateState,
  quoteCorporateAnnualBase, startCorporateCase, corporateCoverage,
} from '../apps/mobile/src/domain/corporate-billing.ts';

// Deliberately synthetic units/bands: not approved commercial pricing.
const table = {
  version: 'synthetic-pricing-v1', approved: true, effectiveFrom: '2026-01-01', effectiveUntil: null,
  taxTreatment: 'excluded',
  bands: [{ min: 1, max: 9, monthlyYen: 123 }, { min: 10, max: null, monthlyYen: 87 }],
};
const base = () => ({
  version: table.version, employeeCount: 10, monthlyUnitYen: 87, annualYen: 10440,
  startsOn: '2026-01-01', endsBefore: '2027-01-01', currency: 'JPY', taxTreatment: 'excluded', billing: 'annual-prepaid',
});
const request = (overrides = {}) => ({
  operationId: 'operation-a', caseId: 'case-a', groupId: 'group-a', corporationId: 'corporation-a',
  contractId: 'contract-a', userId: 'user-a', consentId: 'consent-a', startsOn: '2026-09-26',
  termsVersion: corporateCaseTermsVersion, expectedRevision: 0, ...overrides,
});
const context = () => ({
  today: '2026-09-26', authenticatedUserId: 'user-a', groupId: 'group-a', memberActive: true,
  contract: {
    id: 'contract-a', corporationId: 'corporation-a', annualBase: base(), consentedPriceVersion: table.version,
    annualBasePaid: true, newCasesAllowed: true,
  },
  approval: {
    groupId: 'group-a', corporationId: 'corporation-a', contractId: 'contract-a', beneficiaryUserId: 'user-a',
    termsVersion: corporateCaseTermsVersion, eligibleNow: true, approved: true,
  },
  consent: {
    id: 'consent-a', userId: 'user-a', groupId: 'group-a', corporationId: 'corporation-a', contractId: 'contract-a',
    termsVersion: corporateCaseTermsVersion, startsOn: '2026-09-26', revoked: false,
  },
  b2cPeriods: [],
});

test('annual quote uses whole-company band and twelve monthly units, with no default production pricing', () => {
  assert.equal(configuredCorporateRateTable, null);
  for (const [count, unit] of [[1, 123], [9, 123], [10, 87], [500, 87]]) {
    const quote = quoteCorporateAnnualBase(table, count, '2026-09-26', table.version);
    assert.ok(quote, 'an explicitly approved synthetic table must produce its annual quote');
    assert.equal(quote.monthlyUnitYen, unit);
    assert.equal(quote.annualYen, count * unit * 12);
    assert.equal(quote.employeeCount, count);
    assert.equal(quote.taxTreatment, 'excluded');
    assert.equal(quote.endsBefore, '2027-09-26');
    assert.equal(quote.billing, 'annual-prepaid');
    assert.equal('familyCount' in quote, false);
  }
});

test('invalid annual contract dates cannot create a case or charge through a null yearEnd match', () => {
  for (const startsOn of [null,undefined,'','2026-01-99','2026-02-30','2026-1-1',0,{},[], '9999-01-01']) {
    for(const endsBefore of [null,undefined,'','bad','2027-01-01']) {
      const ctx=context();
      ctx.contract.annualBase={...base(),startsOn,endsBefore};
      const result=startCorporateCase(emptyCorporateState,request(),ctx);
      assert.equal(result.status,'denied',`${String(startsOn)} / ${String(endsBefore)}`);
      assert.equal(result.charge,null);
      assert.equal(result.state,emptyCorporateState);
    }
  }
  for(const endsBefore of [null,undefined,'','2027-02-30','2026-12-31',0,{},[]]) {
    const ctx=context();ctx.contract.annualBase.endsBefore=endsBefore;
    const result=startCorporateCase(emptyCorporateState,request(),ctx);
    assert.equal(result.status,'denied');assert.equal(result.charge,null);assert.equal(result.state,emptyCorporateState);
  }
});

test('first final consent creates one corporate case and only a corporation-charge proposal', () => {
  const result = startCorporateCase(emptyCorporateState, request(), context());
  assert.equal(result.status, 'started', 'eligible final consent should produce a start candidate');
  assert.equal(result.state.revision, 1);
  assert.equal(result.state.cases.length, 1);
  assert.equal(result.case.startsOn, '2026-09-26');
  assert.equal(result.case.endsBefore, '2027-09-26');
  assert.equal(result.case.familyAmountYen, 0);
  assert.deepEqual(result.charge, { caseId: 'case-a', corporationId: 'corporation-a', amountYen: 10000, currency: 'JPY', taxTreatment: 'excluded' });
  assert.equal(emptyCorporateState.cases.length, 0);
});

test('unconfigured, unapproved, unconsented or tax-unspecified prices fail closed', () => {
  for (const invalid of [null, { ...table, approved: false }, { ...table, version: '' }, { ...table, taxTreatment: undefined }, { ...table, taxTreatment: 'unknown' }]) {
    assert.equal(quoteCorporateAnnualBase(invalid, 10, '2026-09-26', table.version), null);
  }
  for (const version of [null, undefined, '', 'synthetic-pricing-v2']) {
    assert.equal(quoteCorporateAnnualBase(table, 10, '2026-09-26', version), null);
  }
});

test('invalid employees, rates, bands and overflowing annual sums never become a quote', () => {
  for (const count of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, '10', undefined, null]) {
    assert.equal(quoteCorporateAnnualBase(table, count, '2026-09-26', table.version), null);
  }
  for (const bands of [[], [{ min: 1, max: null, monthlyYen: null }],
    ...[0, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER].map(monthlyYen => [{ min: 1, max: null, monthlyYen }]),
    [{ min: 0, max: null, monthlyYen: 1 }], [{ min: 2, max: null, monthlyYen: 1 }],
    [{ min: 1, max: 9, monthlyYen: 1 }, { min: 9, max: null, monthlyYen: 1 }],
    [{ min: 1, max: 9, monthlyYen: 1 }, { min: 11, max: null, monthlyYen: 1 }],
    [{ min: 1, max: null, monthlyYen: 1 }, { min: 10, max: null, monthlyYen: 1 }],
    [{ min: 1, max: 0, monthlyYen: 1 }],
  ]) assert.equal(quoteCorporateAnnualBase({ ...table, bands }, 10, '2026-09-26', table.version), null);
});

test('pricing validity is start-inclusive/end-exclusive, including invalid and leap dates', () => {
  const bounded = { ...table, effectiveFrom: '2026-09-26', effectiveUntil: '2027-01-01' };
  for (const date of ['2026-09-25', '2027-01-01', '2026-02-30', 'not-a-date', '9999-09-26']) {
    assert.equal(quoteCorporateAnnualBase(bounded, 10, date, table.version), null);
  }
  assert.ok(quoteCorporateAnnualBase(bounded, 10, '2026-09-26', table.version));
  assert.ok(quoteCorporateAnnualBase(bounded, 10, '2026-12-31', table.version));
  assert.equal(quoteCorporateAnnualBase({ ...table, effectiveFrom: '2024-01-01' }, 10, '2024-02-29', table.version).endsBefore, '2025-02-28');
  assert.equal(quoteCorporateAnnualBase({ ...table, effectiveUntil: '2025-01-01' }, 10, '2026-09-26', table.version), null);
});

test('annual snapshots retain employee count, agreed version and unit even when future data changes', () => {
  const editable = structuredClone(table);
  const old = quoteCorporateAnnualBase(editable, 9, '2026-09-26', table.version);
  editable.bands[0].monthlyYen = 999;
  editable.version = 'synthetic-pricing-v2';
  assert.equal(old.annualYen, 9 * 123 * 12);
  assert.equal(old.employeeCount, 9);
  assert.equal(old.version, table.version);
  assert.equal(Object.isFrozen(old), true);
  assert.throws(() => { old.employeeCount = 10; }, TypeError);
  assert.equal(quoteCorporateAnnualBase(editable, 9, '2027-09-26', table.version), null);
  assert.equal(quoteCorporateAnnualBase(editable, 9, '2027-09-26', editable.version).annualYen, 9 * 999 * 12);
});

function denied(req, ctx, state = emptyCorporateState) {
  const result = startCorporateCase(state, req, ctx);
  assert.equal(result.status, 'denied');
  assert.equal(result.charge, null);
  assert.equal(result.state, state);
  return result;
}

test('only the authenticated approved group member may start in the matching corporation contract', () => {
  for (const [key, value] of [['authenticatedUserId', 'other-user'], ['groupId', 'other-group'], ['memberActive', false]]) {
    denied(request(), { ...context(), [key]: value });
  }
  for (const key of ['userId', 'groupId', 'corporationId', 'contractId']) denied(request({ [key]: 'other-id' }), context());
  denied(request(), { ...context(), contract: null });
});

test('invitation or company approval without current eligibility and personal final consent never starts', () => {
  denied(request(), { ...context(), approval: null });
  for (const [key, value] of [['approved', false], ['eligibleNow', false], ['beneficiaryUserId', 'other-user'],
    ['groupId', 'other-group'], ['corporationId', 'other-corp'], ['contractId', 'other-contract'], ['termsVersion', 'unknown']]) {
    const ctx = context(); ctx.approval[key] = value;
    denied(request(), ctx);
  }
  denied(request(), { ...context(), consent: null });
  for (const [key, value] of [['revoked', true], ['id', 'other-consent'], ['userId', 'other-user'], ['groupId', 'other-group'],
    ['corporationId', 'other-corp'], ['contractId', 'other-contract'], ['termsVersion', 'unknown'], ['startsOn', '2026-09-27']]) {
    const ctx = context(); ctx.consent[key] = value;
    denied(request(), ctx);
  }
});

test('unpaid, terminated, unpriced and unconsented contracts cannot start a new case', () => {
  for (const [key, value] of [['annualBasePaid', false], ['newCasesAllowed', false], ['consentedPriceVersion', 'unknown'], ['annualBase', null]]) {
    const ctx = context(); ctx.contract[key] = value;
    denied(request(), ctx);
  }
  for (const patch of [{ annualYen: 0 }, { annualYen: 10441 }, { employeeCount: 0 }, { taxTreatment: undefined },
    { startsOn: '2025-01-01', endsBefore: '2026-01-01' }, { startsOn: '2027-01-01', endsBefore: '2028-01-01' }]) {
    const ctx = context(); Object.assign(ctx.contract.annualBase, patch);
    denied(request(), ctx);
  }
});

test('same operation and intent replays the existing result without another charge even after new starts stop', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  const ctx = context(); ctx.contract.newCasesAllowed = false; ctx.approval.eligibleNow = false; ctx.consent.revoked = true;
  const replay = startCorporateCase(first.state, request({ expectedRevision: 1 }), ctx);
  assert.equal(replay.status, 'replayed');
  assert.equal(replay.charge, null);
  assert.equal(replay.state, first.state);
  assert.equal(replay.case, first.case);
  assert.equal(replay.state.cases.length, 1);
  denied(request(), { ...ctx, authenticatedUserId: 'other-user' }, first.state);
});

test('operation ID cannot be reused for another payload and records cannot be mutated after start', () => {
  const req = request(); const first = startCorporateCase(emptyCorporateState, req, context());
  for (const key of ['caseId', 'consentId', 'startsOn', 'termsVersion']) {
    const value = key === 'startsOn' ? '2026-09-27' : 'different';
    assert.equal(denied(request({ [key]: value }), context(), first.state).reason, 'operation-payload-conflict');
  }
  req.caseId = 'tampered';
  assert.equal(first.case.request.caseId, 'case-a');
  for (const object of [first, first.state, first.state.cases, first.case, first.case.request, first.charge]) assert.equal(Object.isFrozen(object), true);
});

test('replay compares canonical intent rather than JSON storage property order', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  const restored = {
    revision: 1,
    cases: [{ ...first.case, request: Object.fromEntries(Object.entries(first.case.request).reverse()) }],
  };
  const replay = startCorporateCase(restored, request(), context());
  assert.equal(replay.status, 'replayed');
  assert.equal(replay.charge, null);
  assert.equal(replay.state, restored);
});

test('same group has at most one case across corporations, repeat operations and expired support', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  const second = request({ operationId: 'operation-b', caseId: 'case-b', expectedRevision: 1 });
  assert.equal(denied(second, context(), first.state).reason, 'group-already-supported');
  const ctx = context(); ctx.contract.corporationId = 'corporation-b'; ctx.contract.id = 'contract-b';
  assert.equal(denied({ ...second, corporationId: 'corporation-b', contractId: 'contract-b' }, ctx, first.state).reason, 'group-already-supported');
  ctx.today = '2028-01-01';
  assert.equal(denied({ ...second, corporationId: 'corporation-b', contractId: 'contract-b', startsOn: ctx.today }, ctx, first.state).reason, 'group-already-supported');
});

test('revision collision and duplicate case ID fail before another proposal is emitted', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  const ctx = context(); ctx.groupId = 'group-b'; ctx.approval.groupId = 'group-b'; ctx.consent.groupId = 'group-b';
  const second = request({ operationId: 'operation-b', caseId: 'case-b', groupId: 'group-b' });
  assert.equal(denied(second, ctx, first.state).reason, 'revision-conflict');
  assert.equal(denied({ ...second, caseId: 'case-a', expectedRevision: 1 }, ctx, first.state).reason, 'case-id-conflict');
  assert.equal(startCorporateCase(first.state, { ...second, expectedRevision: 1 }, ctx).status, 'started');
  assert.equal(first.state.cases.length, 1);
});

test('B2C periods must be verified, valid and nonoverlapping; adjacent boundaries are safe', () => {
  for (const periods of [null, [{ startsOn: '2026-09-01', endsBefore: '2026-09-27' }],
    [{ startsOn: '2027-01-01', endsBefore: '2028-01-01' }],
    [{ startsOn: 'bad', endsBefore: '2026-09-27' }], [{ startsOn: '2026-10-01', endsBefore: '2026-09-01' }]]) {
    denied(request(), { ...context(), b2cPeriods: periods });
  }
  for (const periods of [[{ startsOn: '2026-09-01', endsBefore: '2026-09-26' }],
    [{ startsOn: '2027-09-26', endsBefore: '2028-01-01' }]]) {
    assert.equal(startCorporateCase(emptyCorporateState, request(), { ...context(), b2cPeriods: periods }).status, 'started');
  }
});

test('scheduled, past and unknown-version starts create no case or charge', () => {
  for (const startsOn of ['2026-09-25', '2026-09-27', '2026-02-30']) denied(request({ startsOn }), context());
  denied(request({ termsVersion: 'unknown' }), context());
  for (const operationId of ['', ' padded ', undefined]) denied(request({ operationId }), context());
});

test('twelve calendar months preserve leap/end-of-year dates and existing coverage after corporate termination', () => {
  for (const [startsOn, endsBefore, lastCovered] of [['2024-02-29', '2025-02-28', '2025-02-27'], ['2026-12-31', '2027-12-31', '2027-12-30']]) {
    const ctx = context(); ctx.today = startsOn; ctx.consent.startsOn = startsOn;
    ctx.contract.annualBase = { ...base(), startsOn: startsOn.slice(0, 4) + '-01-01', endsBefore: String(Number(startsOn.slice(0, 4)) + 1) + '-01-01' };
    const first = startCorporateCase(emptyCorporateState, request({ startsOn }), ctx);
    assert.equal(first.status, 'started');
    assert.equal(first.case.endsBefore, endsBefore);
    ctx.contract.newCasesAllowed = false; ctx.approval.eligibleNow = false;
    assert.equal(corporateCoverage(first.case, lastCovered), 'corporate');
    assert.equal(corporateCoverage(first.case, endsBefore), 'free');
    assert.equal(first.case.familyAmountYen, 0);
    assert.equal(first.state.cases.length, 1);
  }
  assert.equal(corporateCoverage(null, '2026-09-26'), 'free');
  const first = startCorporateCase(emptyCorporateState, request(), context());
  assert.equal(corporateCoverage(first.case, '2026-09-25'), 'free');
  assert.equal(corporateCoverage(first.case, 'bad'), 'free');
});

test('malformed persisted case rows fail closed instead of throwing or being replayed', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  for (const malformed of [null, undefined, 'invalid', [], {}, { ...first.case, request: null },
    { ...first.case, request: {} }, { ...first.case, startsOn: 'bad' }, { ...first.case, endsBefore: '2028-09-26' },
    { ...first.case, familyAmountYen: 100 }, { ...first.case, contractPriceVersion: '' },
    { ...first.case, request: { ...first.case.request, startsOn: '2026-09-27' } }]) {
    const state = { revision: 1, cases: [malformed] };
    assert.equal(denied(request(), context(), state).reason, 'invalid-input');
  }
});

test('ambiguous duplicate operation, case or group history cannot produce a successful replay', () => {
  const first = startCorporateCase(emptyCorporateState, request(), context());
  for (const second of [first.case,
    { ...first.case, request: { ...first.case.request, caseId: 'other', groupId: 'other' } },
    { ...first.case, request: { ...first.case.request, operationId: 'other', groupId: 'other' } },
    { ...first.case, request: { ...first.case.request, operationId: 'other', caseId: 'other' } }]) {
    const state = { revision: 2, cases: [first.case, second] };
    assert.equal(denied(request(), context(), state).reason, 'invalid-input');
  }
});

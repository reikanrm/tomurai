import { addMonths, validDate } from './calendar.ts';

type TaxTreatment = 'included' | 'excluded';
export type CorporateRateTable = Readonly<{
  version: string; approved: boolean; effectiveFrom: string; effectiveUntil: string | null;
  taxTreatment: TaxTreatment;
  bands: readonly Readonly<{ min: number; max: number | null; monthlyYen: number | null }>[];
}>;
/** PO has not supplied approved bands or N. Never populate with a test fixture. */
export const configuredCorporateRateTable: CorporateRateTable | null = null;

export type AnnualBaseQuote = Readonly<{
  version: string; employeeCount: number; monthlyUnitYen: number; annualYen: number;
  startsOn: string; endsBefore: string; currency: 'JPY'; taxTreatment: TaxTreatment; billing: 'annual-prepaid';
}>;
const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const identifier = (value: string) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 200;
const date = (value: string) => typeof value === 'string' && validDate(value);
const tax = (value: TaxTreatment) => value === 'included' || value === 'excluded';
const yearEnd = (startsOn: string): string | null => {
  if (!date(startsOn)) return null;
  const end = addMonths(startsOn, 12);
  return end && date(end) && end > startsOn ? end : null;
};

/** Whole-company unit rate, not marginal/progressive bands; no family-count input. */
export function quoteCorporateAnnualBase(
  table: CorporateRateTable | null,
  employeeCount: number,
  startsOn: string,
  consentedVersion: string | null,
): AnnualBaseQuote | null {
  const endsBefore = yearEnd(startsOn);
  if (!table || table.approved !== true || !identifier(table.version) || table.version !== consentedVersion
    || !positiveInteger(employeeCount) || !endsBefore || !tax(table.taxTreatment)
    || !date(table.effectiveFrom) || startsOn < table.effectiveFrom
    || (table.effectiveUntil !== null && (!date(table.effectiveUntil) || table.effectiveUntil <= table.effectiveFrom || startsOn >= table.effectiveUntil))
    || !Array.isArray(table.bands) || table.bands.length === 0) return null;
  let nextMin = 1;
  let monthlyUnitYen: number | null = null;
  for (let index = 0; index < table.bands.length; index++) {
    const band = table.bands[index];
    if (!band || !positiveInteger(band.min) || band.min !== nextMin || band.monthlyYen === null || !positiveInteger(band.monthlyYen)
      || (band.max !== null && (!positiveInteger(band.max) || band.max < band.min))
      || (band.max === null && index !== table.bands.length - 1)) return null;
    if (employeeCount >= band.min && (band.max === null || employeeCount <= band.max)) monthlyUnitYen = band.monthlyYen;
    nextMin = band.max === null ? Infinity : band.max + 1;
  }
  if (monthlyUnitYen === null) return null;
  const annualYen = employeeCount * monthlyUnitYen * 12;
  if (!positiveInteger(annualYen)) return null;
  return Object.freeze({ version: table.version, employeeCount, monthlyUnitYen, annualYen,
    startsOn, endsBefore, currency: 'JPY', taxTreatment: table.taxTreatment, billing: 'annual-prepaid' });
}

export const corporateCaseTermsVersion = 'corporate-case-2026-09-26-v1';
type CaseIntent = Readonly<{
  operationId: string; caseId: string; groupId: string; corporationId: string; contractId: string;
  userId: string; consentId: string; startsOn: string; termsVersion: string;
}>;
export type CaseStartRequest = CaseIntent & Readonly<{ expectedRevision: number }>;
export type CorporateCase = Readonly<{
  request: CaseIntent; startsOn: string; endsBefore: string; familyAmountYen: 0;
  contractPriceVersion: string;
}>;
export type CorporateState = Readonly<{ revision: number; cases: readonly CorporateCase[] }>;
export const emptyCorporateState: CorporateState = Object.freeze({ revision: 0, cases: Object.freeze([]) });

/** Server-verified read model required; accepting these values from an app is unsafe. */
export type CaseStartContext = Readonly<{
  today: string; authenticatedUserId: string; groupId: string; memberActive: boolean;
  contract: Readonly<{
    id: string; corporationId: string; annualBase: AnnualBaseQuote; consentedPriceVersion: string;
    annualBasePaid: boolean; newCasesAllowed: boolean;
  }> | null;
  approval: Readonly<{
    groupId: string; corporationId: string; contractId: string; beneficiaryUserId: string;
    termsVersion: string; eligibleNow: boolean; approved: boolean;
  }> | null;
  consent: Readonly<{
    id: string; userId: string; groupId: string; corporationId: string; contractId: string;
    termsVersion: string; startsOn: string; revoked: boolean;
  }> | null;
  /** null means unverified, [] means verified no paid B2C periods. Half-open JST dates. */
  b2cPeriods: readonly Readonly<{ startsOn: string; endsBefore: string }>[] | null;
}>;
type CorporateChargeProposal = Readonly<{
  caseId: string; corporationId: string; amountYen: 10000; currency: 'JPY'; taxTreatment: 'excluded';
}>;
export type CaseStartResult =
  | Readonly<{ status: 'denied'; reason: string; state: CorporateState; charge: null }>
  | Readonly<{ status: 'replayed'; state: CorporateState; case: CorporateCase; charge: null }>
  | Readonly<{ status: 'started'; state: CorporateState; case: CorporateCase; charge: CorporateChargeProposal }>;

const intent = (request: CaseIntent): CaseIntent => Object.freeze({
  operationId: request.operationId, caseId: request.caseId, groupId: request.groupId,
  corporationId: request.corporationId, contractId: request.contractId, userId: request.userId,
  consentId: request.consentId, startsOn: request.startsOn, termsVersion: request.termsVersion,
});
function validAnnualBase(quote: AnnualBaseQuote): boolean {
  if (!quote || !date(quote.startsOn) || !date(quote.endsBefore)) return false;
  const expectedEnd = yearEnd(quote.startsOn);
  return !!quote && identifier(quote.version) && positiveInteger(quote.employeeCount) && positiveInteger(quote.monthlyUnitYen)
    && positiveInteger(quote.annualYen) && quote.annualYen === quote.employeeCount * quote.monthlyUnitYen * 12
    && expectedEnd !== null && quote.endsBefore === expectedEnd && quote.currency === 'JPY' && tax(quote.taxTreatment)
    && quote.billing === 'annual-prepaid';
}

function validCase(record: CorporateCase): boolean {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !record.request
    || typeof record.request !== 'object' || Array.isArray(record.request)) return false;
  const request = record.request;
  return [request.operationId, request.caseId, request.groupId, request.corporationId, request.contractId,
    request.userId, request.consentId, record.contractPriceVersion].every(identifier)
    && request.termsVersion === corporateCaseTermsVersion && date(record.startsOn) && request.startsOn === record.startsOn
    && record.endsBefore === yearEnd(record.startsOn) && record.familyAmountYen === 0;
}

/** Corrupt or ambiguous persisted rows cannot authorize a replay or a second case. */
function validCaseHistory(cases: readonly CorporateCase[]): boolean {
  const operations = new Set<string>(), caseIds = new Set<string>(), groups = new Set<string>();
  for (const record of cases) {
    if (!validCase(record)) return false;
    const { operationId, caseId, groupId } = record.request;
    if (operations.has(operationId) || caseIds.has(caseId) || groups.has(groupId)) return false;
    operations.add(operationId); caseIds.add(caseId); groups.add(groupId);
  }
  return true;
}

/** Produces a candidate transaction, never an invoice, API write, or granted entitlement. */
export function startCorporateCase(state: CorporateState, request: CaseStartRequest, context: CaseStartContext): CaseStartResult {
  const deny = (reason: string): CaseStartResult => Object.freeze({ status: 'denied', reason, state, charge: null });
  if (!state || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.cases) || !validCaseHistory(state.cases)
    || !request || !context || !date(context.today) || !date(request.startsOn)
    || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0
    || ![request.operationId, request.caseId, request.groupId, request.corporationId, request.contractId,
      request.userId, request.consentId, request.termsVersion].every(identifier)) return deny('invalid-input');
  const contract = context.contract;
  if (context.authenticatedUserId !== request.userId || context.groupId !== request.groupId || context.memberActive !== true
    || !contract || contract.id !== request.contractId || contract.corporationId !== request.corporationId) return deny('not-authorized');
  const incoming = intent(request);
  const prior = state.cases.find(record => record.request.operationId === request.operationId);
  // A currently authorized retry reads its prior result, even if new starts are now blocked.
  if (prior) return JSON.stringify(intent(prior.request)) === JSON.stringify(incoming)
    ? Object.freeze({ status: 'replayed', state, case: prior, charge: null }) : deny('operation-payload-conflict');
  if (request.expectedRevision !== state.revision || state.revision === Number.MAX_SAFE_INTEGER) return deny('revision-conflict');
  if (state.cases.some(record => record.request.groupId === request.groupId)) return deny('group-already-supported');
  if (state.cases.some(record => record.request.caseId === request.caseId)) return deny('case-id-conflict');
  if (request.termsVersion !== corporateCaseTermsVersion) return deny('unknown-case-terms');
  const endsBefore = yearEnd(request.startsOn);
  if (!endsBefore || request.startsOn !== context.today) return deny('not-start-day');
  if (!validAnnualBase(contract.annualBase) || contract.consentedPriceVersion !== contract.annualBase.version
    || contract.annualBasePaid !== true || contract.newCasesAllowed !== true
    || request.startsOn < contract.annualBase.startsOn || request.startsOn >= contract.annualBase.endsBefore) return deny('contract-not-ready');
  const approval = context.approval;
  if (!approval || approval.approved !== true || approval.eligibleNow !== true
    || approval.beneficiaryUserId !== request.userId || approval.groupId !== request.groupId
    || approval.corporationId !== request.corporationId || approval.contractId !== request.contractId
    || approval.termsVersion !== request.termsVersion) return deny('not-eligible');
  const consent = context.consent;
  if (!consent || consent.revoked !== false || consent.id !== request.consentId || consent.userId !== request.userId
    || consent.groupId !== request.groupId || consent.corporationId !== request.corporationId
    || consent.contractId !== request.contractId || consent.termsVersion !== request.termsVersion
    || consent.startsOn !== request.startsOn) return deny('consent-mismatch');
  if (!Array.isArray(context.b2cPeriods)) return deny('b2c-unverified');
  for (const period of context.b2cPeriods) {
    if (!period || !date(period.startsOn) || !date(period.endsBefore) || period.endsBefore <= period.startsOn) return deny('b2c-unverified');
    if (period.startsOn < endsBefore && request.startsOn < period.endsBefore) return deny('b2c-overlap');
  }
  const record: CorporateCase = Object.freeze({ request: incoming, startsOn: request.startsOn, endsBefore,
    familyAmountYen: 0, contractPriceVersion: contract.annualBase.version });
  const next = Object.freeze({ revision: state.revision + 1, cases: Object.freeze([...state.cases, record]) });
  const charge: CorporateChargeProposal = Object.freeze({ caseId: request.caseId, corporationId: request.corporationId,
    amountYen: 10000, currency: 'JPY', taxTreatment: 'excluded' });
  return Object.freeze({ status: 'started', state: next, case: record, charge });
}

/** Existing case coverage is independent of later employment/contract termination. */
export function corporateCoverage(record: CorporateCase | null, today: string): 'corporate' | 'free' {
  return record && validCase(record) && date(today)
    && today >= record.startsOn && today < record.endsBefore ? 'corporate' : 'free';
}

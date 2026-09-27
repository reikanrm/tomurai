import { selectPartners, type Partner } from './partners.ts';

export type ConsultationContext = { partner: Partner; today: string; registered: boolean; entitled: boolean };
export type ConsultationRoute = 'unavailable' | 'registration' | 'external' | 'request';

export function consultationRoute(context: ConsultationContext): ConsultationRoute {
  const { partner, today } = context;
  const field = partner?.fields?.[0];
  if (!field || !selectPartners([partner], { field, region: partner.regions?.[0], today, locale: 'ja' }).length) return 'unavailable';
  if (context.registered !== true) return 'registration';
  return context.entitled === true ? 'external' : 'request';
}

export function externalConsultationUrl(context: ConsultationContext): string | null {
  return consultationRoute(context) === 'external' ? context.partner.contactUrl : null;
}

export type ConsultationRequest = { requestId: string; recipientPartnerId: string };
export type ConsultationReceipt = ConsultationRequest & { receiptId: string; acceptedAt: string };
export type ConsultationState = {
  status: 'draft' | 'unavailable' | 'pending' | 'uncertain' | 'accepted';
  request: ConsultationRequest | null;
  sendConsent: boolean;
};
export const initialConsultationState = (): ConsultationState => ({ status: 'draft', request: null, sendConsent: false });

type BeginOptions = { sendConsent: boolean; operationId: string; transportAvailable: boolean };
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);

/** Pure metadata contract only. The local UI always passes transportAvailable=false. */
export function beginConsultation(state: ConsultationState, context: ConsultationContext, options: BeginOptions): ConsultationState {
  if (state.status === 'pending' || state.status === 'uncertain' || state.status === 'accepted') return state;
  if (consultationRoute(context) !== 'request' || options.sendConsent !== true || !validId(options.operationId)) {
    return { status: 'unavailable', request: null, sendConsent: false };
  }
  if (options.transportAvailable !== true) return { status: 'unavailable', request: null, sendConsent: true };
  return { status: 'pending', request: { requestId: options.operationId, recipientPartnerId: context.partner.id }, sendConsent: true };
}

export function markConsultationUncertain(state: ConsultationState): ConsultationState {
  return state.status === 'pending' ? { ...state, status: 'uncertain' } : state;
}

/** Withdrawal prevents sending again; it does not pretend a request was unsent. */
export function withdrawConsultationConsent(state: ConsultationState): ConsultationState {
  const status = state.status === 'pending' ? 'uncertain' : state.status === 'unavailable' ? 'draft' : state.status;
  return { ...state, status, sendConsent: false };
}

/** verify must be supplied by a trusted receipt-verification boundary. A flag in
 * an arbitrary response cannot supply that trust; no verifier exists in the UI. */
export function recordConsultationReceipt(state: ConsultationState, receipt: ConsultationReceipt,
  verify?: (receipt: ConsultationReceipt) => boolean): ConsultationState {
  if ((state.status !== 'pending' && state.status !== 'uncertain') || !state.request || !receipt) return state;
  if (receipt.requestId !== state.request.requestId || receipt.recipientPartnerId !== state.request.recipientPartnerId || !validId(receipt.receiptId)) return state;
  if (typeof receipt.acceptedAt !== 'string') return state;
  const acceptedAt = new Date(receipt.acceptedAt);
  if (!Number.isFinite(acceptedAt.getTime()) || acceptedAt.toISOString() !== receipt.acceptedAt) return state;
  try {
    return verify?.(receipt) === true ? { ...state, status: 'accepted' } : state;
  } catch {
    return state;
  }
}

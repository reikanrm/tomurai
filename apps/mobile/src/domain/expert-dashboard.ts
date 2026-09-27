export type ExpertContext = { userId:string; tenantId:string; role:'admin'|'staff'|'operator'|'employer'; authenticated:boolean; memberActive:boolean; intakeActive:boolean; now:string };
export type ExpertCase = {
  id:string; tenantId:string; assigneeId:string|null; revision:number; state:'received'|'in_progress'|'resolved';
  createdAt:string; expiresAt:string|null; consentActive:boolean; payload:{message:string;replyEmail:string};
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const validPayload = (value: unknown): value is ExpertCase['payload'] => record(value)
  && typeof value.message === 'string' && typeof value.replyEmail === 'string';

/** Server timestamps are explicit UTC instants, with optional millisecond precision.
 * Reject local/date-only strings and Date.parse's rollover of impossible dates. */
function utcInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const canonical = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === canonical ? parsed : null;
}

function authorized(context:ExpertContext, entry:ExpertCase):boolean {
  if (!record(context) || !record(entry) || !identifier(context.userId) || !identifier(context.tenantId)
    || context.authenticated !== true || context.memberActive !== true || context.intakeActive !== true
    || !['admin','staff'].includes(context.role) || entry.tenantId !== context.tenantId || entry.consentActive !== true
    || !identifier(entry.id) || (entry.assigneeId !== null && !identifier(entry.assigneeId))
    || !Number.isSafeInteger(entry.revision) || entry.revision < 1
    || !['received','in_progress','resolved'].includes(entry.state) || !validPayload(entry.payload)) return false;
  const now = utcInstant(context.now), created = utcInstant(entry.createdAt), expiry = utcInstant(entry.expiresAt);
  return now !== null && created !== null && expiry !== null && created <= now && now < expiry;
}
/** Contract only. The server must construct context from fresh verified identity and membership. */
export function projectExpertCase(context:ExpertContext, entry:ExpertCase) {
  if (!authorized(context,entry)) return null;
  const metadata={id:entry.id,revision:entry.revision,state:entry.state,createdAt:entry.createdAt};
  if (entry.assigneeId!==context.userId) return context.role==='admin'?metadata:null;
  return {...metadata,payload:{message:entry.payload.message,replyEmail:entry.payload.replyEmail}};
}
/** Produces a candidate; never a persisted acknowledgement. CAS/audit run in the future repository transaction. */
export function transitionExpertCase(context:ExpertContext, entry:ExpertCase, expectedRevision:number, next:ExpertCase['state']):ExpertCase|null {
  if (!authorized(context,entry) || entry.assigneeId!==context.userId || !Number.isSafeInteger(expectedRevision)
    || expectedRevision!==entry.revision || entry.revision===Number.MAX_SAFE_INTEGER) return null;
  if (!(entry.state==='received' && next==='in_progress') && !(entry.state==='in_progress' && next==='resolved')) return null;
  return {id:entry.id,tenantId:entry.tenantId,assigneeId:entry.assigneeId,revision:entry.revision+1,state:next,
    createdAt:entry.createdAt,expiresAt:entry.expiresAt,consentActive:entry.consentActive,
    payload:{message:entry.payload.message,replyEmail:entry.payload.replyEmail}};
}

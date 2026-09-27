import { validDate } from './calendar.ts';
import type { Locale, TextPair } from '../data/questions.ts';

export type PartnerField = 'law' | 'tax' | 'care' | 'belongings';

/** Operator-confirmed listing data, not a qualification/ranking endorsement.
 * JP means explicitly nationwide; JP-01..JP-47 are prefecture service areas. */
export type Partner = {
  id: string;
  name: TextPair;
  fields: readonly PartnerField[];
  regions: readonly string[];
  permission: 'approved' | 'pending' | 'withdrawn';
  permissionConfirmedOn: string;
  validFrom: string;
  validUntil: string;
  contactUrl: string;
  contactVerifiedOn: string;
};

// Real publication needs the permission evidence and G03/G04 review. Never
// fill this registry with synthetic offices simply to make a screen look full.
export const registeredPartners: readonly Partner[] = Object.freeze([]);

const fields: readonly string[] = ['law', 'tax', 'care', 'belongings'];
const isRegion = (value: unknown): value is string => typeof value === 'string'
  && (value === 'JP' || /^JP-(0[1-9]|[1-3]\d|4[0-7])$/.test(value));
const isDate = (value: unknown): value is string => typeof value === 'string' && validDate(value);
const hasText = (value: unknown): value is string => typeof value === 'string'
  && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);

/** Only a verified public HTTPS destination; never interpolate family data.
 * This is URL validation, not a claim about redirects or the site's safety. */
export function isSafePartnerUrl(value: unknown): value is string {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    // A public DNS-shaped name: no IP literals, single-label/local hosts or
    // parser-normalized numeric IPs. The destination is confirmed separately.
    if (!/\.[a-z][a-z0-9-]*$/.test(host)) return false;
    if (/(^|\.)(localhost|local|internal|lan|home)$/.test(host)) return false;
    return host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  } catch {
    return false;
  }
}

type PartnerSelection = { field: PartnerField; region?: string; today: string; locale: Locale };

function eligible(partner: Partner, options: PartnerSelection): boolean {
  if (!partner || typeof partner !== 'object' || !hasText(partner.id)) return false;
  if (!partner.name || !hasText(partner.name.ja) || !hasText(partner.name.en)) return false;
  if (partner.permission !== 'approved') return false;
  if (!isDate(partner.permissionConfirmedOn) || partner.permissionConfirmedOn > options.today) return false;
  if (!isDate(partner.contactVerifiedOn) || partner.contactVerifiedOn > options.today) return false;
  if (!isDate(partner.validFrom) || !isDate(partner.validUntil) || partner.validFrom > partner.validUntil) return false;
  if (options.today < partner.validFrom || options.today > partner.validUntil) return false;
  if (!isSafePartnerUrl(partner.contactUrl)) return false;
  if (!Array.isArray(partner.fields) || !partner.fields.length || !partner.fields.every(field => fields.includes(field))) return false;
  if (!partner.fields.includes(options.field)) return false;
  if (!Array.isArray(partner.regions) || !partner.regions.length || !partner.regions.every(isRegion)) return false;
  return partner.regions.includes('JP') || !!options.region && partner.regions.includes(options.region);
}

/** Fail closed for missing/invalid scope and ambiguous duplicate IDs.
 * No GPS, distance score, paid placement rank or inferred user region. */
export function selectPartners(partners: readonly Partner[], options: PartnerSelection): Partner[] {
  if (!Array.isArray(partners) || !isDate(options.today) || !fields.includes(options.field)) return [];
  if (options.region && !isRegion(options.region)) return [];
  if (options.locale !== 'ja' && options.locale !== 'en') return [];
  const counts = new Map<string, number>();
  for (const partner of partners) {
    if (partner && typeof partner.id === 'string') counts.set(partner.id, (counts.get(partner.id) ?? 0) + 1);
  }
  const collator = new Intl.Collator(options.locale, { numeric: true, sensitivity: 'base' });
  return partners.filter(partner => eligible(partner, options) && counts.get(partner.id) === 1)
    .sort((left, right) => collator.compare(left.name[options.locale], right.name[options.locale])
      || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

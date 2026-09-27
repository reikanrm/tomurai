/** Local, tax-inclusive price guidance. These versions are not Stripe Price IDs. */
export type B2cPlan = 'solo' | 'family';
export type BillingInterval = 'month' | 'year';
export type B2cPriceVersion = 'b2c-2026-09-26-v1' | 'b2c-2026-09-26-v2';

export const newSignupPriceVersion: B2cPriceVersion = 'b2c-2026-09-26-v2';

// Retain old terms for an explicitly pinned contract. New guidance must never
// migrate a contract or treat an unknown/missing version as the latest one.
export const b2cPriceCatalog = Object.freeze({
  'b2c-2026-09-26-v1': Object.freeze({
    annualDiscountPercent: 20,
    solo: Object.freeze({ month: 980, year: 9408 }),
    family: Object.freeze({ month: 1480, year: 14208 }),
  }),
  'b2c-2026-09-26-v2': Object.freeze({
    annualDiscountPercent: 15,
    solo: Object.freeze({ month: 980, year: 9996 }),
    family: Object.freeze({ month: 1480, year: 15096 }),
  }),
});

export type B2cPrice = Readonly<{
  version: B2cPriceVersion;
  plan: B2cPlan;
  interval: BillingInterval;
  amount: number;
  currency: 'JPY';
  taxIncluded: true;
  annualDiscountPercent: number;
}>;

/** Resolve only the requested version; unknown terms fail closed, not forward. */
export function getB2cPrice(
  version: string | null | undefined,
  plan: B2cPlan,
  interval: BillingInterval,
): B2cPrice | null {
  if (version !== 'b2c-2026-09-26-v1' && version !== 'b2c-2026-09-26-v2') return null;
  if (plan !== 'solo' && plan !== 'family') return null;
  if (interval !== 'month' && interval !== 'year') return null;
  const prices = b2cPriceCatalog[version];
  return Object.freeze({
    version, plan, interval, amount: prices[plan][interval],
    currency: 'JPY', taxIncluded: true, annualDiscountPercent: prices.annualDiscountPercent,
  });
}

/** New-signup display only. Member counts do not grant access or create charges. */
export function getNewSignupPrice(activeMemberCount: number, interval: BillingInterval): B2cPrice | null {
  if (!Number.isSafeInteger(activeMemberCount) || activeMemberCount < 1) return null;
  return getB2cPrice(newSignupPriceVersion, activeMemberCount === 1 ? 'solo' : 'family', interval);
}

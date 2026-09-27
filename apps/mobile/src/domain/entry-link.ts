/** Startup presentation only: recognizing a link never redeems an invitation. */
export function isInvitationEntry(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'tomurai:') return url.hostname === 'invite' && /^\/[^/]+\/?$/.test(url.pathname);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    return /^(?:\/preview)?\/invite\/[^/]+\/?$/.test(url.pathname);
  } catch { return false; }
}

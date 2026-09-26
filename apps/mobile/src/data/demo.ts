import type { TextPair } from './questions';
export const members = [
  { id: 'self', name: { ja: '自分', en: 'Me' }, initial: { ja: '自', en: 'Me' } },
  { id: 'family-a', name: { ja: '家族 A', en: 'Family A' }, initial: { ja: 'A', en: 'A' } },
  { id: 'family-b', name: { ja: '家族 B', en: 'Family B' }, initial: { ja: 'B', en: 'B' } },
];
export const assigneeInitial = (id: string | null, locale: keyof TextPair) =>
  members.find(member => member.id === id)?.initial[locale] ?? '—';

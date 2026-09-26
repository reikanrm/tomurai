import type { TextPair } from './questions';
export type DemoTask = { id: string; title: TextPair; category: TextPair; done: boolean; assignee: string | null };
export const members = [
  { id: 'self', name: { ja: '自分', en: 'Me' }, initial: { ja: '自', en: 'Me' } },
  { id: 'family-a', name: { ja: '家族 A', en: 'Family A' }, initial: { ja: 'A', en: 'A' } },
  { id: 'family-b', name: { ja: '家族 B', en: 'Family B' }, initial: { ja: 'B', en: 'B' } },
];
export const assigneeInitial = (id: string | null, locale: keyof TextPair) =>
  members.find(member => member.id === id)?.initial[locale] ?? '—';
export const demoTasks: DemoTask[] = [
  { id: 'sample-1', title: { ja: '死亡診断書の受け取り', en: 'Receive the medical certificate' }, category: { ja: '行政手続き', en: 'Public procedures' }, done: true, assignee: 'self' },
  { id: 'sample-2', title: { ja: '死亡届の提出について確認する', en: 'Check how to register the death' }, category: { ja: '行政手続き', en: 'Public procedures' }, done: false, assignee: 'self' },
  { id: 'sample-3', title: { ja: '銀行の相続手続きを確認する', en: 'Check the bank’s inheritance process' }, category: { ja: '各種契約・金融', en: 'Contracts & finances' }, done: false, assignee: 'family-a' },
  { id: 'sample-4', title: { ja: '契約中のサービスを確認する', en: 'Review ongoing service contracts' }, category: { ja: '各種契約・金融', en: 'Contracts & finances' }, done: false, assignee: null },
  { id: 'sample-5', title: { ja: '初七日の実施状況を確認する', en: 'Check plans for the seventh-day service' }, category: { ja: '法要・お別れ', en: 'Rituals & remembrance' }, done: true, assignee: 'family-b' },
  { id: 'sample-6', title: { ja: '納骨の日程・場所を相談する', en: 'Discuss plans for interment' }, category: { ja: '法要・お別れ', en: 'Rituals & remembrance' }, done: false, assignee: null },
];

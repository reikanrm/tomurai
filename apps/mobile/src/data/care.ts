// TOM-28: identifiers do not change with the displayed language. Selection is
// optional and stays in the mounted care screen only; there is no mood history.
export const careMoods = [
  { id: 'calm', icon: '😌', label: { ja: '穏やか', en: 'Calm' } },
  { id: 'tearful', icon: '😢', label: { ja: '涙が出る', en: 'Tearful' } },
  { id: 'unsettled', icon: '😠', label: { ja: 'やり場のなさ', en: 'Nowhere to turn' } },
  { id: 'nothing', icon: '😶', label: { ja: '何も感じない', en: 'Feeling nothing' } },
  { id: 'remember', icon: '🤍', label: { ja: '思い出したい', en: 'Want to remember' } },
] as const;

export type CareMoodId = (typeof careMoods)[number]['id'];

export function toggleCareMood(current: CareMoodId | null, next: CareMoodId): CareMoodId | null {
  return current === next ? null : next;
}

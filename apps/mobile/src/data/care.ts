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

// Available to everyone, regardless of mood selection. No completion or history.
export const selfCareActions = [
  { id: 'water', title: { ja: '水分をひと口', en: 'A sip of water' }, body: {
    ja: '飲めそうであれば、手元の飲み物をひと口。今は合わないと感じたら、選ばなくても大丈夫です。',
    en: 'If drinking feels comfortable, you might take a sip of a drink nearby. You can leave this aside if it does not suit you now.',
  } },
  { id: 'rest', title: { ja: '楽な姿勢で休む', en: 'Rest in a comfortable position' }, body: {
    ja: '座る、背中を預けるなど、今のご自身が楽に感じる姿勢で少し休んでも。時間を決める必要はありません。',
    en: 'You could sit or lean back in a position that feels comfortable to you. There is no need to set a time limit.',
  } },
  { id: 'connection', title: { ja: '話せる相手を思い浮かべる', en: 'Think of someone you could talk to' }, body: {
    ja: '気持ちをうまく言葉にしなくても、そばにいてほしい相手を思い浮かべてみても。今すぐ連絡する必要はありません。相談先を探したいときは、下の案内も使えます。',
    en: 'You do not have to put your feelings into words. You might think of someone whose company you would welcome, without contacting them now. The support search below is also available if you want it.',
  } },
] as const;
export type SelfCareActionId = (typeof selfCareActions)[number]['id'];
export function toggleSelfCareAction(current: SelfCareActionId | null, next: SelfCareActionId): SelfCareActionId | null {
  return current === next ? null : next;
}

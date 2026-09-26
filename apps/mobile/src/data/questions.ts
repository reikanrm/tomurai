export type Locale = 'ja' | 'en';
export type TextPair = { ja: string; en: string };
export type Question = { id: string; title: TextPair; options?: { id: string; label: TextPair }[] };
const yesNo = [
  { id: 'yes', label: { ja: 'はい', en: 'Yes' } },
  { id: 'no', label: { ja: 'いいえ', en: 'No' } },
  { id: 'unknown', label: { ja: 'わからない・あとで確認する', en: 'Not sure · check later' } },
];
export const questions: Question[] = [
  { id: 'deathDate', title: { ja: 'いつ、お亡くなりに\nなりましたか。', en: 'When did the person\npass away?' } },
  { id: 'setainushi', title: { ja: '亡くなった方は、\n世帯主でしたか。', en: 'Were they the head\nof the household?' }, options: yesNo },
  { id: 'nenkin', title: { ja: '年金を受給して\nいましたか。', en: 'Were they receiving\na pension?' }, options: yesNo },
  { id: 'kenpo', title: { ja: '加入していた健康保険を\n教えてください。', en: 'Which health insurance\ndid they have?' }, options: [
    { id: 'kokuho', label: { ja: '国民健康保険', en: 'National Health Insurance' } },
    { id: 'koki', label: { ja: '後期高齢者医療制度', en: 'Medical care for older people' } },
    { id: 'shakaihoken', label: { ja: '会社の健康保険', en: 'Employer health insurance' } },
    yesNo[2]!,
  ] },
  { id: 'fudousan', title: { ja: '土地や建物を\n所有していましたか。', en: 'Did they own\nland or buildings?' }, options: yesNo },
  { id: 'jidousha', title: { ja: '自動車を\n所有していましたか。', en: 'Did they own\na vehicle?' }, options: yesNo },
  { id: 'jigyounushi', title: { ja: '個人事業主・\n自営業でしたか。', en: 'Were they\nself-employed?' }, options: yesNo },
  { id: 'seimeihoken', title: { ja: '生命保険に\n加入していましたか。', en: 'Did they have\nlife insurance?' }, options: yesNo },
  { id: 'souzokunin', title: { ja: '相続人は\n複数いますか。', en: 'Is there more\nthan one heir?' }, options: [
    { id: 'multiple', label: { ja: '複数いる', en: 'More than one' } },
    { id: 'single', label: { ja: '1人だけ', en: 'One' } }, yesNo[2]!,
  ] },
  { id: 'shukyou', title: { ja: '葬儀は仏式で\n行いますか。', en: 'Will the funeral follow\nBuddhist traditions?' }, options: [
    { id: 'yes', label: { ja: '仏式で行う', en: 'Buddhist traditions' } },
    { id: 'other', label: { ja: 'それ以外', en: 'Other traditions' } }, yesNo[2]!,
  ] },
];

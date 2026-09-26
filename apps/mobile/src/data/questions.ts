export type Locale = 'ja' | 'en';
export type TextPair = { ja: string; en: string };
export type Question = { id: string; title: TextPair; help?: TextPair; kind?: 'date'; options?: { id: string; label: TextPair }[] };
const yesNo = [
  { id: 'yes', label: { ja: 'はい', en: 'Yes' } },
  { id: 'no', label: { ja: 'いいえ', en: 'No' } },
  { id: 'unknown', label: { ja: 'わからない・あとで確認する', en: 'Not sure · check later' } },
];
export const questions: Question[] = [
  { id: 'deathDate', kind: 'date', title: { ja: 'いつ、お亡くなりに\nなりましたか。', en: 'When did the person\npass away?' } },
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

const serviceChoices = [
  { id: 'yes', label: { ja: '実施済み', en: 'Already held' } },
  { id: 'no', label: { ja: 'まだ行っていない', en: 'Not yet held' } },
  yesNo[2]!,
  { id: 'notNeeded', label: { ja: '行わない', en: 'Not holding it' } },
];

/** Candidate questions; the questionnaire domain selects only the applicable branches. */
export const guidanceQuestions: Question[] = [
  { id: 'funeralDone', title: { ja: '通夜・葬儀は\n終わりましたか。', en: 'Have the funeral\nservices finished?' }, options: yesNo },
  { id: 'rituals', title: { ja: '初七日・四十九日の\n案内を表示しますか。', en: 'Would you like guidance on\nseventh-day and 49th-day services?' }, options: [
    { id: 'yes', label: { ja: '表示する', en: 'Show guidance' } },
    { id: 'no', label: { ja: '表示しない', en: 'Hide guidance' } }, yesNo[2]!,
  ], help: { ja: '宗派・地域・ご家庭によって異なります。葬儀の形式にかかわらず選べます。', en: 'Practices vary by tradition, region and family. You can choose regardless of the funeral tradition.' } },
  { id: 'firstWeekDone', title: { ja: '初七日法要は\n実施済みですか。', en: 'Has the seventh-day service\nalready been held?' }, options: serviceChoices,
    help: { ja: '葬儀当日に前倒しして行う場合も含みます。火葬・収骨後や、告別式後・火葬前の式中（繰り込み）初七日など、名称や形式は寺院等に確認してください。', en: 'This includes a service brought forward to the funeral day. It may follow cremation or take place after the funeral ceremony but before cremation. Ask the relevant temple about names and practices.' } },
  { id: 'firstWeekMeal', title: { ja: '初七日後の会食を\n予定していますか。', en: 'Do you plan a meal after\nthe seventh-day service?' }, options: yesNo },
  { id: 'fortyNineDone', title: { ja: '四十九日法要は\n実施済みですか。', en: 'Has the 49th-day service\nalready been held?' }, options: serviceChoices },
  { id: 'fortyNineDate', kind: 'date', title: { ja: '四十九日法要の予定日を\n教えてください。', en: 'When is the 49th-day\nservice planned?' },
    help: { ja: '49日目より前に行う場合もあります。目安の日付とは別に扱います。未定のままでも進めます。', en: 'The service may be held before the forty-ninth day. Its planned date is separate from that guide. You can continue with the date undecided.' } },
  { id: 'tablet', title: { ja: '本位牌等を\n使用しますか。', en: 'Will your family use\na memorial tablet?' }, options: yesNo,
    help: { ja: '浄土真宗など、原則として本位牌を使わない宗派もあります。不明な場合は菩提寺・寺院へ確認してください。', en: 'Some traditions, including Jodo Shinshu, generally do not use these tablets. Ask your temple if unsure.' } },
  { id: 'fortyNineMeal', title: { ja: '四十九日の会食を\n行いますか・行いましたか。', en: 'Is a meal planned, or was one held,\nfor the 49th-day service?' }, options: yesNo },
  { id: 'gifts', title: { ja: '四十九日の返礼品を\n用意しますか・用意しましたか。', en: 'Are gifts planned, or were they prepared,\nfor the 49th-day service?' }, options: yesNo },
  { id: 'eyeOpening', title: { ja: '開眼供養等を\n行いますか・行いましたか。', en: 'Is a consecration or similar rite\nplanned, or was one held?' }, options: yesNo,
    help: { ja: '名称や必要性は宗派・ご家庭によって異なります。', en: 'The name and need depend on your tradition and family.' } },
  { id: 'altar', title: { ja: '後飾り祭壇を\n設けていますか。', en: 'Does your family have\na temporary memorial altar?' }, options: yesNo },
  { id: 'burial', title: { ja: '四十九日前後に\n納骨を予定していますか。', en: 'Do you plan interment\naround the 49th day?' }, options: [
    { id: 'around49', label: { ja: '予定している', en: 'Yes, around that time' } },
    { id: 'later', label: { ja: '別の時期に予定している', en: 'At another time' } },
    { id: 'unknown', label: { ja: '未定・あとで確認する', en: 'Undecided · check later' } },
    { id: 'done', label: { ja: '納骨済み', en: 'Already completed' } },
    { id: 'none', label: { ja: '案内不要', en: 'No guidance needed' } },
  ], help: { ja: '四十九日に納骨することは必須ではありません。', en: 'Interment does not have to take place on the 49th day.' } },
  { id: 'engraving', title: { ja: '石材店への追加彫刻等が\n必要ですか。', en: 'Is additional engraving\nor stonework needed?' }, options: yesNo },
  { id: 'returnsDone', title: { ja: '香典返しは\nすでに済んでいますか。', en: 'Have condolence gifts\nand thanks been completed?' }, options: [
    { id: 'yes', label: { ja: '済んでいる', en: 'Completed' } },
    { id: 'no', label: { ja: '未対応がある', en: 'Some remain' } }, yesNo[2]!,
    { id: 'notNeeded', label: { ja: '不要', en: 'Not needed' } },
  ] },
  { id: 'inheritance', title: { ja: '相続放棄・限定承認を\n検討していますか。', en: 'Are you considering renunciation\nor limited acceptance of inheritance?' }, options: yesNo,
    help: { ja: '判断がつかない場合は「あとで確認」を選べます。この回答から個人の期限や法的な結論を決めることはありません。', en: 'You can choose “Check later” if unsure. This answer does not establish an individual deadline or legal conclusion.' } },
];

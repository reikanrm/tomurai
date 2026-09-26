import type { TextPair } from '../data/questions';
import type { Choice } from './guidance-model';
import { addDays, inWindow } from './calendar.ts';

export type InheritanceContext = 'overview' | 'belongings';
export type InheritanceReminder = 'general' | 'first-week' | 'seven-weeks';
type InheritanceInput = {
  deathDate: string;
  today: string;
  consideration: Choice;
  context?: InheritanceContext;
};

export const inheritanceWarning: TextPair = {
  ja: '故人の財産の売却・処分等は、相続を承認したとみなされる場合があります。相続放棄・限定承認を検討中、またはまだ判断していない場合は、行う前に弁護士などへ確認してください。',
  en: 'Selling or disposing of the deceased’s property may be treated as accepting the inheritance. If you are considering renunciation or limited acceptance, or have not decided yet, consult a lawyer or another qualified professional before doing so.',
};

export const inheritanceDetails: ReadonlyArray<{ id: string; title: TextPair; body: TextPair }> = [
  {
    id: 'period',
    title: { ja: '手続きの時期を確認する', en: 'Check when to act' },
    body: {
      ja: '相続放棄・限定承認は、原則として、自己のために相続の開始があったことを知った時から3か月以内に家庭裁判所への申述が必要です。死亡日だけでは個人の期限を確定できません。Tomuraiでは個人の法的期限を計算しません。',
      en: 'In Japan, renunciation or limited acceptance generally requires a declaration to the family court within three months of learning that an inheritance has commenced for you. The date of death alone does not establish your deadline. Tomurai does not calculate individual legal deadlines.',
    },
  },
  {
    id: 'property',
    title: { ja: '行為ごとの確認が必要です', en: 'The circumstances matter' },
    body: {
      ja: '単に遺品に触れたり片付けたりするだけで、一律に相続放棄ができなくなるという意味ではありません。保存行為などの例外もあり、行為や状況によって扱いが異なります。迷う場合は、作業を進める前に専門家へ確認してください。',
      en: 'Simply touching or tidying belongings does not automatically prevent renunciation. Exceptions include acts of preservation, and the treatment depends on the action and circumstances. If you are unsure, check with a qualified professional before proceeding.',
    },
  },
  {
    id: 'joint',
    title: { ja: '限定承認は共同相続人全員で', en: 'Limited acceptance involves all co-heirs' },
    body: {
      ja: '相続人が複数いる場合、限定承認は共同相続人全員で行う必要があります。一人だけで選択・完了できる手続きではありません。',
      en: 'Where there are multiple heirs, limited acceptance must be made jointly by all co-heirs. One heir cannot complete this procedure alone.',
    },
  },
  {
    id: 'extension',
    title: { ja: '判断が間に合わない場合', en: 'If you need more time to decide' },
    body: {
      ja: '期間内に判断することが難しい場合、家庭裁判所へ熟慮期間の伸長を申し立てる方法があります。期間内に早めに相談してください。申立てただけで伸長が認められたことにはならず、裁判所の判断が必要です。',
      en: 'If you cannot decide within the period, you may apply to the family court for an extension of the consideration period. Seek advice promptly, before the period ends. Filing an application is not approval of an extension; the court must decide.',
    },
  },
];

export const inheritanceSources = [
  { id: 'renunciation', label: { ja: '裁判所：相続の放棄の申述', en: 'Courts of Japan: Renunciation of inheritance (Japanese)' }, url: 'https://www.courts.go.jp/saiban/syurui/syurui_kazi/kazi_06_13/index.html' },
  { id: 'limited', label: { ja: '裁判所：相続の限定承認の申述', en: 'Courts of Japan: Limited acceptance (Japanese)' }, url: 'https://www.courts.go.jp/saiban/syurui/syurui_kazi/kazi_06_14/index.html' },
  { id: 'extension', label: { ja: '裁判所：相続の承認又は放棄の期間の伸長', en: 'Courts of Japan: Extension of the consideration period (Japanese)' }, url: 'https://www.courts.go.jp/saiban/syurui/syurui_kazi/kazi_06_25/index.html' },
] as const;

/** These windows are prompts to revisit general guidance, never legal deadlines.
 * No religious preference, ritual progress, or consideration answer hides safety copy. */
export function getInheritanceNotice({ deathDate, today, consideration, context = 'overview' }: InheritanceInput) {
  let reminder: InheritanceReminder = 'general';
  if (inWindow(today, addDays(deathDate, 6))) reminder = 'first-week';
  else if (inWindow(today, addDays(deathDate, 48))) reminder = 'seven-weeks';

  const title: TextPair = context === 'belongings'
    ? { ja: '遺品を整理する前に', en: 'Before sorting belongings' }
    : reminder === 'general'
      ? { ja: '財産を売却・処分する前に', en: 'Before selling or disposing of property' }
      : { ja: '相続について、もう一度確認を', en: 'A moment to revisit inheritance matters' };
  const reminderText: TextPair | null = reminder === 'first-week'
    ? { ja: '一週間ごろの確認です。相続の判断に必要な財産・負債や、手続きの時期を確認しましょう。', en: 'A check-in around the first week. Check the assets, debts and timing relevant to your inheritance decisions.' }
    : reminder === 'seven-weeks'
      ? { ja: '七週間ごろの確認です。まだ判断していない場合は、早めに財産・負債と手続きを確認し、必要に応じて専門家へ相談しましょう。', en: 'A check-in around seven weeks. If you have not decided yet, check the assets, debts and procedures promptly, and seek professional advice if needed.' }
      : null;

  return { reminder, title, reminderText, warning: inheritanceWarning, consideration };
}

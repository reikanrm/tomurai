import type { TextPair } from '../data/questions';
import type { GuidanceTask } from './guidance-model';

type Confirmation = { questionId: string; id: string; title: TextPair; unknownTitle: TextPair; description: TextPair };
const confirmations: Confirmation[] = [
  { questionId: 'setainushi', id: 'confirm-household-head',
    title: { ja: '世帯主に関する手続きを確認する', en: 'Check procedures concerning the head of household' },
    unknownTitle: { ja: '世帯主だったか確認する', en: 'Check whether they were the head of household' },
    description: { ja: '世帯主だったかと、ご家族の状況に応じた確認事項を市区町村の窓口に確認します。', en: 'Ask the municipal office whether they were the head of household and what needs checking for your family’s circumstances.' } },
  { questionId: 'nenkin', id: 'confirm-pension',
    title: { ja: '年金に関する手続きを確認する', en: 'Check pension-related procedures' },
    unknownTitle: { ja: '年金の受給状況を確認する', en: 'Check whether they received a pension' },
    description: { ja: '年金の受給状況と、必要な届出等の有無を年金事務所や加入していた制度の窓口に確認します。', en: 'Ask a pension office or the relevant scheme’s contact about pension payments and whether any notifications are needed.' } },
  { questionId: 'kenpo', id: 'confirm-health-insurance',
    title: { ja: '健康保険の窓口と手続きを確認する', en: 'Check the health-insurance contact and procedures' },
    unknownTitle: { ja: '加入していた健康保険を確認する', en: 'Check which health-insurance scheme they had' },
    description: { ja: '加入先が不明な場合は、市区町村や勤務先などに、加入していた制度と確認先を問い合わせます。', en: 'If the scheme is unknown, ask the municipal office or employer which scheme applied and whom to contact.' } },
  { questionId: 'fudousan', id: 'confirm-property',
    title: { ja: '土地・建物に関する手続きを確認する', en: 'Check procedures for land and buildings' },
    unknownTitle: { ja: '土地・建物の所有状況を確認する', en: 'Check ownership of land and buildings' },
    description: { ja: '土地・建物の所有状況と必要な確認事項を整理し、法務局や専門家に確認します。処分を進める前に相続の注意を確認してください。', en: 'Establish whether land or buildings were owned and ask the Legal Affairs Bureau or a professional what needs checking. Review inheritance cautions before disposing of property.' } },
  { questionId: 'jidousha', id: 'confirm-vehicle',
    title: { ja: '自動車に関する手続きを確認する', en: 'Check vehicle-related procedures' },
    unknownTitle: { ja: '自動車の所有状況を確認する', en: 'Check vehicle ownership' },
    description: { ja: '自動車の所有状況と種類を確認し、運輸支局や軽自動車検査協会など、該当する窓口へ確認します。売却・処分の前に相続の注意を確認してください。', en: 'Check whether a vehicle was owned and its type, then ask the relevant transport office or light-motor-vehicle inspection association. Review inheritance cautions before sale or disposal.' } },
  { questionId: 'jigyounushi', id: 'confirm-business',
    title: { ja: '個人事業に関する手続きを確認する', en: 'Check procedures concerning a sole proprietorship' },
    unknownTitle: { ja: '個人事業の状況を確認する', en: 'Check whether they operated a sole proprietorship' },
    description: { ja: '個人事業の有無と継続等の意向を確認し、税務署や税理士等に必要な確認事項を相談します。', en: 'Check whether there was a sole proprietorship and any plans for it, then ask the tax office or a tax professional what needs checking.' } },
  { questionId: 'seimeihoken', id: 'confirm-life-insurance',
    title: { ja: '生命保険の契約と手続きを確認する', en: 'Check life-insurance contracts and procedures' },
    unknownTitle: { ja: '生命保険の加入状況を確認する', en: 'Check whether they had life insurance' },
    description: { ja: '生命保険の契約の有無を確認し、契約先の保険会社に必要な手続きや確認事項を問い合わせます。保険証券番号等は入力しません。', en: 'Check whether there was life insurance and ask the insurer what procedures or checks are needed. Do not enter policy numbers here.' } },
  { questionId: 'souzokunin', id: 'confirm-heirs',
    title: { ja: '相続人と手続きの進め方を確認する', en: 'Check heirs and how to approach the procedures' },
    unknownTitle: { ja: '相続人の範囲を確認する', en: 'Check who the heirs are' },
    description: { ja: '相続人が不明な場合は、必要な確認方法を市区町村の戸籍窓口や専門家に相談します。この回答だけで相続人を確定しません。', en: 'If the heirs are unclear, ask a municipal family-register office or a professional how to check. This answer alone does not establish who the heirs are.' } },
];

const insurance: Record<string, TextPair> = {
  kokuho: { ja: '国民健康保険について、市区町村の窓口に必要な手続きや確認事項を問い合わせます。', en: 'For National Health Insurance, ask the municipal office what procedures or checks are needed.' },
  koki: { ja: '後期高齢者医療制度について、市区町村や広域連合の窓口に必要な手続きや確認事項を問い合わせます。', en: 'For the medical-care scheme for older people, ask the municipal office or regional union what procedures or checks are needed.' },
  shakaihoken: { ja: '会社の健康保険について、勤務先や加入先の保険者に必要な手続きや確認事項を問い合わせます。', en: 'For employer health insurance, ask the employer or insurer what procedures or checks are needed.' },
};
const heirs: Record<string, TextPair> = {
  multiple: { ja: '複数の相続人がいるとの回答をもとに、相続人の範囲や手続きの進め方を専門家等に確認します。ご家族の人数だけで法的な結論を決めません。', en: 'Based on your answer that there is more than one heir, ask a professional about the heirs and how to proceed. Family size alone does not establish a legal conclusion.' },
  single: { ja: '相続人が1人との回答について、相続人の範囲や必要な確認事項を専門家等に確認します。この回答だけで単独相続を確定しません。', en: 'Based on your answer that there is one heir, ask a professional to check the heirs and relevant matters. This answer alone does not establish sole inheritance.' },
};

/** These are unverified procedure-check candidates, never legal obligations or deadlines.
 * Only answer-derived candidates are returned; the existing four baseline tasks remain with the caller.
 */
export function deriveGeneralConfirmationTasks(answers: Readonly<Record<string, string>>): GuidanceTask[] {
  return confirmations.flatMap(definition => {
    const value = answers[definition.questionId];
    const known = definition.questionId === 'kenpo' ? Object.hasOwn(insurance, value ?? '')
      : definition.questionId === 'souzokunin' ? Object.hasOwn(heirs, value ?? '') : value === 'yes';
    if (value !== 'unknown' && !known) return [];
    return [{
      id: definition.id, title: value === 'unknown' ? definition.unknownTitle : definition.title,
      description: definition.questionId === 'kenpo' ? insurance[value!] ?? definition.description
        : definition.questionId === 'souzokunin' ? heirs[value!] ?? definition.description : definition.description,
      category: { ja: '手続きの確認', en: 'Procedure checks' }, group: 'general' as const,
      done: false, notNeeded: false, assignee: null, optional: false, needsConfirmation: true, guidanceDate: null, scheduledDate: null,
    }];
  });
}

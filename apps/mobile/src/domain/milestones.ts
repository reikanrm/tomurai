import type { TextPair } from '../data/questions';
import type { GuidancePlan } from './guidance-model';
import { addDays, addMonths, inWindow, validDate } from './calendar.ts';

export type Milestone = { id: string; title: TextPair; body: TextPair };
export type MilestoneContext = {
  today: string;
  plan: GuidancePlan;
  eventDates: Partial<Record<'funeral' | 'burial' | 'thanks' | 'all-tasks', string>>;
  allTasksDone: boolean;
  dismissed: string[];
};

// Japanese bodies are the exact SSOT §5 strings. English is a corresponding
// draft for review under G03, not independently approved clinical guidance.
export const milestoneMessages = {
  funeral: {
    id: 'funeral', title: { ja: '通夜・葬儀を終えて', en: 'After the funeral' },
    body: { ja: '通夜・葬儀を終え、ひとつの節目を迎えました。慌ただしい時間が続いていたかもしれません。今日は少し、身体を休める時間も大切にしてください。',
      en: 'With the wake and funeral behind you, you have reached a milestone. The days may have been busy. You might make a little space to rest your body today.' },
  },
  'first-week': {
    id: 'first-week', title: { ja: '一週間ほどの節目に', en: 'Around one week' },
    body: { ja: '一週間ほどが経ちました。まだ気持ちが追いつかなかったり、いつも通りに感じたり。過ごし方に決まった形はありません。',
      en: 'About a week has passed. Your feelings may not have caught up, or things may feel much as usual. There is no set way to spend this time.' },
  },
  burial: {
    id: 'burial', title: { ja: '納骨を終えて', en: 'After interment' },
    body: { ja: 'ひとつの節目を迎えました。今日感じることに、決まった形はありません。少しゆっくり過ごす時間を持ってもいいかもしれません。',
      en: 'You have reached a milestone. There is no set way to feel today. You might allow yourself some time to take things slowly.' },
  },
  thanks: {
    id: 'thanks', title: { ja: 'ご挨拶やお礼の区切りに', en: 'After your acknowledgements' },
    body: { ja: 'ご挨拶やお礼に関する手続きが、ひと区切りしました。次のことを急がず、必要なことから進めていきましょう。',
      en: 'The arrangements for your acknowledgements and thanks have reached a stopping point. There is no need to rush into the next thing; you can begin with what is needed.' },
  },
  'forty-nine': {
    id: 'forty-nine', title: { ja: '四十九日の節目に', en: 'The forty-ninth-day milestone' },
    body: { ja: '四十九日という、ひとつの節目を迎えました。ひと区切りとされる日ですが、気持ちに区切りをつける日ではありません。これからも、ご自身のペースで。',
      en: 'You have reached the forty-ninth-day milestone. It may mark a point in the rituals, but it is not a deadline for your feelings. You can continue at your own pace.' },
  },
  'three-months': {
    id: 'three-months', title: { ja: '三か月ほどの節目に', en: 'Around three months' },
    body: { ja: '3ヶ月ほどが経ちました。日々の感じ方や過ごし方に、決まった形はありません。今日も、ご自身のペースで。',
      en: 'About three months have passed. There is no set way to feel or spend each day. Today, too, you can go at your own pace.' },
  },
  'six-months': {
    id: 'six-months', title: { ja: '半年ほどの節目に', en: 'Around six months' },
    body: { ja: '半年ほどが経ちました。時間が経っても、ふと思い出すことがあるかもしれません。そんなときは、その時間をそのまま大切に。',
      en: 'About six months have passed. Even as time goes by, memories may come to you unexpectedly. When they do, you can let that time be what it is.' },
  },
  'before-year': {
    id: 'before-year', title: { ja: '一年の節目を前に', en: 'As one year approaches' },
    body: { ja: 'もうすぐ、一年という節目を迎えます。この時期だからこそ思い出すことや、感じることがあるかもしれません。少しだけ、心に余白を持てる時間がありますように。',
      en: 'The one-year milestone is approaching. This time may bring particular memories or feelings. May there be a little space for yourself in the days ahead.' },
  },
  'all-tasks': {
    id: 'all-tasks', title: { ja: '手続きのひと区切りに', en: 'A stopping point in the tasks' },
    body: { ja: '必要な手続きが、ひと区切りしました。これからは、少しずつ日常の時間が増えていくかもしれません。法要や大切な節目、ふと立ち止まりたくなるときには、いつでもここに戻ってきてください。',
      en: 'The necessary tasks have reached a stopping point. There may gradually be more space for everyday life. For memorial services, important milestones, or a moment to pause, you can return here at any time.' },
  },
} satisfies Record<string, Milestone>;

export const allTasksMilestoneNote: TextPair = {
  ja: '登録した対象タスクの区切りであり、すべての法的手続きの完了を保証しない',
  en: 'This refers to the tasks registered here; it does not guarantee that all legal procedures are complete.',
};

/** A single optional card, never a push notification or a legal deadline.
 * Parent owns the nonempty/fully-confirmed predicate and confirmation dates.
 * Fixed IDs make dismissal survive plan edits for the current app session. */
export function selectMilestone(context: MilestoneContext): Milestone | null {
  const { today, plan, eventDates, allTasksDone, dismissed } = context;
  if (!plan.showMessages || !validDate(today)) return null;
  const deathDate = validDate(plan.deathDate) && plan.deathDate <= today ? plan.deathDate : '';
  const available = (id: keyof typeof milestoneMessages, eligible: boolean): Milestone | null =>
    eligible && !dismissed.includes(id) ? milestoneMessages[id] : null;
  const ritualDay = validDate(plan.fortyNineDate)
    && (!deathDate || plan.fortyNineDate >= deathDate) ? plan.fortyNineDate : addDays(deathDate, 48);
  const anniversary = addMonths(deathDate, 12);

  // Date windows have priority. Within a group, the SSOT order is deterministic.
  return available('first-week', plan.rituals === 'yes' && plan.firstWeekDone !== 'notNeeded' && inWindow(today, addDays(deathDate, 6)))
    ?? available('forty-nine', plan.rituals === 'yes' && plan.fortyNineDone !== 'notNeeded' && inWindow(today, ritualDay))
    ?? available('three-months', inWindow(today, addMonths(deathDate, 3)))
    ?? available('six-months', inWindow(today, addMonths(deathDate, 6)))
    ?? available('before-year', !!anniversary && inWindow(today, addDays(anniversary, -30), 30))
    ?? available('funeral', plan.funeralDone === 'yes' && inWindow(today, eventDates.funeral ?? null))
    ?? available('burial', plan.burial === 'done' && inWindow(today, eventDates.burial ?? null))
    ?? available('thanks', plan.returnsDone === 'yes' && inWindow(today, eventDates.thanks ?? null))
    ?? available('all-tasks', allTasksDone && inWindow(today, eventDates['all-tasks'] ?? null));
}

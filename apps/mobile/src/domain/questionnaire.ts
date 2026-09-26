import { guidanceQuestions, questions, type Question } from '../data/questions.ts';
import type { GuidancePlan } from './guidance-model';
import { validDate } from './calendar.ts';
import { isValidPastDate } from './progress.ts';

export type QuestionnaireAnswers = Record<string, string>;
export type QuestionnaireResult = { answers: QuestionnaireAnswers; plan: GuidancePlan };
export type QuestionnaireIssue = { questionId: string; reason: 'unanswered' | 'invalid-choice' | 'invalid-date' | 'date-before-death' };
export type QuestionnairePosition = 'intro' | 'review' | string;

const additionalIds = new Set(guidanceQuestions.map(question => question.id));
const pending = (value: string | undefined) => value === 'no' || value === 'unknown';

export function getActiveQuestions(answers: Readonly<QuestionnaireAnswers>): Question[] {
  return [...questions, ...guidanceQuestions.filter(question => {
    switch (question.id) {
      case 'firstWeekDone': case 'fortyNineDone': return answers.rituals === 'yes';
      case 'firstWeekMeal': return answers.rituals === 'yes' && pending(answers.firstWeekDone);
      case 'fortyNineDate': return answers.rituals === 'yes' && pending(answers.fortyNineDone);
      case 'tablet': case 'fortyNineMeal': case 'gifts': case 'eyeOpening': case 'altar':
        return answers.rituals === 'yes' && ['yes', 'no', 'unknown'].includes(answers.fortyNineDone ?? '');
      case 'engraving': return answers.burial === 'around49';
      default: return true;
    }
  })];
}

/** Re-edits start from the current plan, including task-completion changes, not stale answers. */
export function initializeQuestionnaire(initialAnswers: Readonly<QuestionnaireAnswers>, plan: GuidancePlan): QuestionnaireAnswers {
  if (!Object.keys(initialAnswers).length) return {};
  const answers = { ...initialAnswers, deathDate: plan.deathDate || 'unknown',
    shukyou: plan.tradition === 'buddhist' ? 'yes' : plan.tradition === 'other' ? 'other' : 'unknown' };
  for (const key of additionalIds) {
    const value = plan[key as keyof GuidancePlan];
    if (typeof value === 'string') (answers as QuestionnaireAnswers)[key] = value || 'unknown';
  }
  return answers;
}

export function validateQuestion(question: Question, answers: Readonly<QuestionnaireAnswers>, today: string): QuestionnaireIssue | null {
  const value = answers[question.id];
  if (!value) return { questionId: question.id, reason: 'unanswered' };
  if (question.kind !== 'date') return question.options?.some(option => option.id === value)
    ? null : { questionId: question.id, reason: 'invalid-choice' };
  if (value === 'unknown') return null;
  if (!validDate(value) || (question.id === 'deathDate' && !isValidPastDate(value, today))) {
    return { questionId: question.id, reason: 'invalid-date' };
  }
  if (question.id === 'fortyNineDate' && validDate(answers.deathDate ?? '') && value < answers.deathDate!) {
    return { questionId: question.id, reason: 'date-before-death' };
  }
  return null;
}

export function validateQuestionnaire(answers: Readonly<QuestionnaireAnswers>, today: string): QuestionnaireIssue[] {
  return getActiveQuestions(answers).flatMap(question => {
    const issue = validateQuestion(question, answers, today);
    return issue ? [issue] : [];
  });
}

export function getNextQuestionId(answers: Readonly<QuestionnaireAnswers>, currentId: string): string {
  const active = getActiveQuestions(answers);
  if (currentId === 'intro') return active[0]?.id ?? 'review';
  const index = active.findIndex(question => question.id === currentId);
  return index < 0 ? 'review' : active[index + 1]?.id ?? 'review';
}

export function getPreviousQuestionId(answers: Readonly<QuestionnaireAnswers>, currentId: string): string {
  const active = getActiveQuestions(answers);
  if (currentId === 'review') return active.at(-1)?.id ?? 'intro';
  const index = active.findIndex(question => question.id === currentId);
  return index <= 0 ? 'intro' : active[index - 1]!.id;
}

/** Only the caller's final confirmation applies this snapshot; hidden branch drafts are retained. */
export function finalizeQuestionnaire(answers: Readonly<QuestionnaireAnswers>, initialPlan: GuidancePlan, today: string): QuestionnaireResult | null {
  if (validateQuestionnaire(answers, today).length) return null;
  const plan: GuidancePlan = { ...initialPlan, deathDate: answers.deathDate === 'unknown' ? '' : answers.deathDate!,
    tradition: answers.shukyou === 'yes' ? 'buddhist' : answers.shukyou === 'other' ? 'other' : 'unknown' };
  for (const question of guidanceQuestions) {
    const value = answers[question.id];
    if (!value) continue;
    if (question.id === 'fortyNineDate') {
      plan.fortyNineDate = value === 'unknown' ? '' : value;
    } else if (question.options?.some(option => option.id === value)) {
      // IDs and choices are constrained by this catalogue; unknown/hidden values are never inferred as no.
      Object.assign(plan, { [question.id]: value });
    }
  }
  // A hidden draft is retained for review, but must not leak an invalid schedule into tasks.
  if (plan.fortyNineDate && (!validDate(plan.fortyNineDate)
    || (validDate(plan.deathDate) && plan.fortyNineDate < plan.deathDate))) plan.fortyNineDate = '';
  return { answers: { ...answers }, plan };
}

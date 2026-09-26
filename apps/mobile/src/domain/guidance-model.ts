import type { TextPair } from '../data/questions';

export type Choice = 'yes' | 'no' | 'unknown';
export type GuidancePlan = {
  deathDate: string;
  tradition: 'buddhist' | 'other' | 'unknown';
  rituals: Choice;
  funeralDone: Choice;
  firstWeekDone: Choice | 'notNeeded';
  fortyNineDone: Choice | 'notNeeded';
  fortyNineDate: string;
  firstWeekMeal: Choice;
  fortyNineMeal: Choice;
  tablet: Choice;
  gifts: Choice;
  burial: 'around49' | 'later' | 'unknown' | 'done' | 'none';
  engraving: Choice;
  eyeOpening: Choice;
  altar: Choice;
  returnsDone: Choice | 'notNeeded';
  inheritance: Choice;
  showMessages: boolean;
};
export const defaultPlan: GuidancePlan = {
  deathDate: '', tradition: 'unknown', rituals: 'unknown', funeralDone: 'unknown', firstWeekDone: 'unknown',
  fortyNineDone: 'unknown', fortyNineDate: '', firstWeekMeal: 'unknown', fortyNineMeal: 'unknown',
  tablet: 'unknown', gifts: 'unknown', burial: 'unknown', engraving: 'unknown', eyeOpening: 'unknown',
  altar: 'unknown', returnsDone: 'unknown', inheritance: 'unknown', showMessages: true,
};
export type CompletionKey = 'firstWeekDone' | 'fortyNineDone' | 'burial' | 'returnsDone';
/** Whether preparation candidates have been issued, not when a rite took place. */
export type RitualWorkHistory = { firstWeek: boolean; fortyNine: boolean };
export const defaultRitualWorkHistory: RitualWorkHistory = { firstWeek: false, fortyNine: false };
export type GuidanceTask = {
  id: string;
  title: TextPair;
  description: TextPair;
  category: TextPair;
  group: 'general' | 'first-week' | 'forty-nine' | 'burial' | 'thanks' | 'belongings';
  done: boolean;
  notNeeded: boolean;
  assignee: string | null;
  optional: boolean;
  needsConfirmation: boolean;
  guidanceDate: string | null;
  scheduledDate: string | null;
  completionKey?: CompletionKey;
};
export type TaskProgress = Record<string, { done?: boolean; notNeeded?: boolean; assignee?: string | null }>;

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source wiring checks only; these do not execute React or replace device interaction tests.
const source = readFileSync('apps/mobile/src/components/Onboarding.tsx', 'utf8');

test('onboarding uses current plan, dynamic IDs, whole-answer confirmation and visible review rows', () => {
  assert.match(source, /initializeQuestionnaire\(initialAnswers, initialPlan\)/);
  assert.match(source, /getActiveQuestions\(answers\)/);
  assert.match(source, /activeQuestions\.map\(q/);
  assert.match(source, /finalizeQuestionnaire\(answers, initialPlan, todayInJapan\(\)\)/);
  assert.match(source, /if \(result\) \{ onConfirm\(result\); return; \}/);
  assert.match(source, /getPreviousQuestionId\(answers, position\)/);
  assert.match(source, /validateQuestionnaire\(answers, todayInJapan\(\)\)\[0\]/);
  assert.doesNotMatch(source, /全10問|10 questions|setStep\(/);
});

test('both dates start collapsed with independent bounds and no hidden branch deletion', () => {
  assert.match(source, /<CalendarDateField key=\{question\.id\}/);
  assert.doesNotMatch(source, /\binitialOpen=/);
  assert.match(source, /maxDate=\{question\.id === 'deathDate' \? today : undefined\}/);
  assert.match(source, /minDate=\{question\.id === 'fortyNineDate'/);
  assert.match(source, /aria-expanded=\{showInactive\}/);
  assert.doesNotMatch(source, /delete answers|delete initialAnswers/);
});

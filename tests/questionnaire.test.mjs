import test from 'node:test';
import assert from 'node:assert/strict';
import { questions, guidanceQuestions } from '../apps/mobile/src/data/questions.ts';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import { finalizeQuestionnaire, getActiveQuestions, getNextQuestionId, getPreviousQuestionId,
  initializeQuestionnaire, validateQuestionnaire } from '../apps/mobile/src/domain/questionnaire.ts';

const today = '2026-09-26';
const ids = answers => getActiveQuestions(answers).map(question => question.id);
function fill(overrides = {}) {
  const answers = { ...overrides };
  for (let pass = 0; pass < 4; pass++) for (const question of getActiveQuestions(answers)) {
    answers[question.id] ??= 'unknown';
  }
  return answers;
}

test('existing ten IDs remain and every question has unique bilingual content and a later choice', () => {
  assert.deepEqual(questions.map(question => question.id), ['deathDate', 'setainushi', 'nenkin', 'kenpo', 'fudousan', 'jidousha', 'jigyounushi', 'seimeihoken', 'souzokunin', 'shukyou']);
  const catalogue = [...questions, ...guidanceQuestions];
  assert.equal(new Set(catalogue.map(question => question.id)).size, catalogue.length);
  for (const question of catalogue) {
    assert.ok(question.title.ja && question.title.en, question.id);
    if (question.help) assert.ok(question.help.ja && question.help.en);
    if (question.kind !== 'date') {
      assert.ok(question.options.some(option => option.id === 'unknown'), question.id);
      for (const option of question.options) assert.ok(option.label.ja && option.label.en);
    }
  }
});

test('a new questionnaire never preselects the default unknown plan', () => {
  assert.deepEqual(initializeQuestionnaire({}, defaultPlan), {});
  assert.ok(validateQuestionnaire({}, today).every(issue => issue.reason === 'unanswered'));
  assert.equal(finalizeQuestionnaire({}, defaultPlan, today), null);
  assert.deepEqual(validateQuestionnaire(fill(), today), []);
});

test('ritual preference is independent of funeral tradition; hidden branches preserve draft without being required', () => {
  for (const shukyou of ['yes', 'other', 'unknown']) {
    const answers = fill({ shukyou, rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no', fortyNineDate: '2026-10-10' });
    assert.ok(ids(answers).includes('firstWeekDone'));
    assert.ok(ids(answers).includes('firstWeekMeal'));
    const hidden = { ...answers, rituals: 'no' };
    const result = finalizeQuestionnaire(hidden, defaultPlan, today);
    assert.ok(result);
    assert.equal(result.answers.fortyNineDate, '2026-10-10');
    assert.equal(result.plan.rituals, 'no');
    assert.equal(ids(hidden).includes('fortyNineDate'), false);
    assert.equal(ids({ ...result.answers, rituals: 'yes' }).includes('fortyNineDate'), true);
  }
});

test('all 49th-day choices remain after completion, while only a pending service asks its date', () => {
  const required = ['tablet', 'fortyNineMeal', 'gifts', 'eyeOpening', 'altar'];
  for (const fortyNineDone of ['no', 'unknown', 'yes']) {
    const active = ids({ rituals: 'yes', fortyNineDone });
    for (const id of required) assert.ok(active.includes(id), `${fortyNineDone}:${id}`);
    assert.equal(active.includes('fortyNineDate'), fortyNineDone !== 'yes');
  }
  const unnecessary = ids({ rituals: 'yes', firstWeekDone: 'notNeeded', fortyNineDone: 'notNeeded' });
  for (const id of [...required, 'fortyNineDate', 'firstWeekMeal']) assert.equal(unnecessary.includes(id), false);
  for (const firstWeekDone of ['yes', 'notNeeded']) assert.equal(ids({ rituals: 'yes', firstWeekDone }).includes('firstWeekMeal'), false);
});

test('burial, returns and inheritance are independent; engraving is asked only for around49', () => {
  for (const rituals of ['yes', 'no', 'unknown']) for (const burial of ['around49', 'later', 'unknown', 'done', 'none']) {
    const active = ids({ rituals, burial });
    for (const id of ['burial', 'returnsDone', 'inheritance']) assert.ok(active.includes(id));
    assert.equal(active.includes('engraving'), burial === 'around49');
  }
});

test('ID navigation follows the current branch forward and back, including review', () => {
  const answers = fill({ rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no', burial: 'around49' });
  assert.equal(getNextQuestionId(answers, 'intro'), 'deathDate');
  assert.equal(getPreviousQuestionId(answers, 'deathDate'), 'intro');
  assert.equal(getNextQuestionId(answers, 'firstWeekDone'), 'firstWeekMeal');
  assert.equal(getNextQuestionId({ ...answers, firstWeekDone: 'yes' }, 'firstWeekDone'), 'fortyNineDone');
  assert.equal(getPreviousQuestionId({ ...answers, firstWeekDone: 'yes' }, 'fortyNineDone'), 'firstWeekDone');
  assert.equal(getNextQuestionId(answers, 'inheritance'), 'review');
  assert.equal(getPreviousQuestionId(answers, 'review'), 'inheritance');
  assert.equal(getPreviousQuestionId({ ...answers, burial: 'none' }, 'returnsDone'), 'burial');
});

test('final confirmation validates every newly visible answer, not only the current question', () => {
  const hidden = fill({ rituals: 'no', burial: 'none' });
  const expanded = { ...hidden, rituals: 'yes', fortyNineDone: 'yes' };
  const issues = validateQuestionnaire(expanded, today);
  assert.ok(issues.some(issue => issue.questionId === 'tablet'));
  assert.ok(issues.some(issue => issue.questionId === 'firstWeekDone'));
  assert.equal(finalizeQuestionnaire(expanded, defaultPlan, today), null);
  assert.ok(finalizeQuestionnaire(fill(expanded), defaultPlan, today));
});

test('dates reject nonexistent/future death days and service dates before death; unknown is explicit', () => {
  for (const deathDate of ['2026-02-30', '2026-09-27', 'not-a-date']) {
    assert.ok(validateQuestionnaire(fill({ deathDate }), today).some(issue => issue.questionId === 'deathDate'));
  }
  const before = fill({ deathDate: '2026-09-20', rituals: 'yes', fortyNineDone: 'no', fortyNineDate: '2026-09-19' });
  assert.ok(validateQuestionnaire(before, today).some(issue => issue.reason === 'date-before-death'));
  assert.deepEqual(validateQuestionnaire({ ...before, fortyNineDate: '2026-12-01' }, today), []);
  assert.deepEqual(validateQuestionnaire({ ...before, fortyNineDate: 'unknown' }, today), []);
  assert.deepEqual(validateQuestionnaire({ ...before, rituals: 'no' }, today), []);
  assert.equal(finalizeQuestionnaire(fill(), defaultPlan, today).plan.deathDate, '');
});

test('re-edit uses the current plan after task completion and retains all draft branches', () => {
  const stale = fill({ rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no', burial: 'around49' });
  const plan = { ...defaultPlan, rituals: 'no', firstWeekDone: 'yes', fortyNineDone: 'yes', burial: 'done', returnsDone: 'yes', firstWeekMeal: 'yes', deathDate: '2026-09-01', tradition: 'other' };
  const revised = initializeQuestionnaire(stale, plan);
  assert.equal(revised.firstWeekDone, 'yes');
  assert.equal(revised.fortyNineDone, 'yes');
  assert.equal(revised.burial, 'done');
  assert.equal(revised.firstWeekMeal, 'yes');
  assert.equal(revised.shukyou, 'other');
  assert.equal(revised.deathDate, '2026-09-01');
  assert.equal(stale.firstWeekDone, 'no');
  assert.equal(finalizeQuestionnaire(revised, plan, today).plan.showMessages, true);
});

test('inactive invalid schedules remain in the raw draft but never enter the applied plan', () => {
  for (const branch of [{ rituals: 'no' }, { rituals: 'yes', fortyNineDone: 'yes' }]) {
    for (const fortyNineDate of ['2026-02-30', '2026-09-10']) {
      const answers = fill({ ...branch, deathDate: '2026-09-20', fortyNineDate });
      const result = finalizeQuestionnaire(answers, { ...defaultPlan, fortyNineDate }, today);
      assert.ok(result);
      assert.equal(result.answers.fortyNineDate, fortyNineDate);
      assert.equal(result.plan.fortyNineDate, '');
      assert.ok(validateQuestionnaire({ ...result.answers, rituals: 'yes', fortyNineDone: 'no' }, today)
        .some(issue => issue.questionId === 'fortyNineDate'));
    }
    const future = finalizeQuestionnaire(fill({ ...branch, deathDate: '2026-09-20', fortyNineDate: '2026-11-01' }), defaultPlan, today);
    assert.equal(future.plan.fortyNineDate, '2026-11-01');
  }
});

test('confirmation is a detached snapshot and invalid choices cannot become confirmed plan values', () => {
  const answers = fill();
  assert.equal(finalizeQuestionnaire({ ...answers, rituals: 'invalid' }, defaultPlan, today), null);
  const result = finalizeQuestionnaire(answers, defaultPlan, today);
  assert.ok(result);
  result.answers.nenkin = 'yes';
  result.plan.rituals = 'yes';
  assert.equal(answers.nenkin, 'unknown');
  assert.equal(defaultPlan.rituals, 'unknown');
});

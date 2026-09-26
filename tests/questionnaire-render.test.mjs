import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as questions from '../apps/mobile/src/data/questions.ts';
import * as questionnaire from '../apps/mobile/src/domain/questionnaire.ts';
import * as calendar from '../apps/mobile/src/domain/calendar.ts';
import { defaultPlan } from '../apps/mobile/src/domain/guidance-model.ts';
import * as theme from '../apps/mobile/src/theme.ts';

// Isolated component state/handler tests with inert native children. These do not
// execute real React scheduling, native layout, the calendar child or screen readers.
const compiled = ts.transpileModule(readFileSync('apps/mobile/src/components/Onboarding.tsx', 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function harness(props) {
  let index = 0;
  const state = [];
  const react = {
    Fragment: 'Fragment',
    createElement: (type, input, ...children) => ({ type, props: input ?? {}, children }),
    useState: initial => {
      const current = index++;
      if (!(current in state)) state[current] = typeof initial === 'function' ? initial() : initial;
      return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value; }];
    },
    useEffect: () => {},
  };
  const native = { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: value => value } };
  const imports = { react, 'react-native': native, '../data/questions': questions, '../domain/questionnaire': questionnaire,
    '../domain/calendar': calendar, '../theme': theme, './EnsoProgress': { EnsoProgress: 'EnsoProgress' },
    './CalendarDateField': { CalendarDateField: 'CalendarDateField' } };
  const context = { React: react, exports: {}, require: id => { assert.ok(imports[id], id); return imports[id]; } };
  vm.runInNewContext(compiled, context);
  return () => { index = 0; return context.exports.Onboarding(props); };
}
const nodes = value => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' ? [value, ...nodes(value.children ?? [])] : [];
const text = value => Array.isArray(value) ? value.map(text).join('')
  : value && typeof value === 'object' ? text(value.children ?? []) : typeof value === 'string' ? value : '';
const press = (render, label) => {
  const button = nodes(render()).find(node => node.type === 'Pressable' && text(node).includes(label));
  assert.ok(button, label);
  assert.ok(!button.props.disabled, label);
  button.props.onPress();
};
const questionNode = tree => nodes(tree).find(node => node.type === 'Text' && node.props.accessibilityRole === 'header');
const currentQuestion = (render, locale) => [...questions.questions, ...questions.guidanceQuestions]
  .find(question => question.title[locale] === text(questionNode(render())));
function answer(render, question, value, locale) {
  const label = question.options?.find(option => option.id === value)?.label[locale];
  const option = nodes(render()).find(node => node.type?.name === 'Option' && (label ? node.props.label === label : /あとで確認|check later/i.test(node.props.label)));
  assert.ok(option, `${question.id}:${value}`);
  option.props.onPress();
}
function completeFlow(render, locale, overrides = {}) {
  press(render, locale === 'ja' ? '質問をはじめる' : 'Start questions');
  let count = 0;
  while (currentQuestion(render, locale)) {
    const question = currentQuestion(render, locale);
    answer(render, question, overrides[question.id] ?? 'unknown', locale);
    const next = nodes(render()).find(node => node.type === 'Pressable' && /次へ|回答を確認する|Next|Review answers/.test(text(node)));
    assert.ok(next);
    next.props.onPress();
    assert.ok(++count <= 25, 'bounded questionnaire');
  }
  return count;
}

test('both languages allow explicit unknown for every question and only apply after final confirmation', () => {
  for (const locale of ['ja', 'en']) {
    const results = [];
    const render = harness({ locale, initialPlan: defaultPlan, onConfirm: result => results.push(result) });
    assert.equal(completeFlow(render, locale), 15);
    assert.equal(results.length, 0);
    assert.equal(nodes(render()).find(node => node.type === 'EnsoProgress').props.total, 15);
    press(render, locale === 'ja' ? 'この内容で確定する' : 'Confirm these answers');
    assert.equal(results.length, 1);
    assert.equal(results[0].answers.inheritance, 'unknown');
    assert.equal(results[0].plan.deathDate, '');
  }
});

test('review edits hide branches without dropping drafts and update the question count in both languages', () => {
  for (const locale of ['ja', 'en']) {
    const results = [];
    const render = harness({ locale, initialPlan: defaultPlan, onConfirm: result => results.push(result) });
    assert.equal(completeFlow(render, locale, { rituals: 'yes', firstWeekDone: 'no', fortyNineDone: 'no', burial: 'around49' }), 25);
    const ritual = questions.guidanceQuestions.find(question => question.id === 'rituals');
    press(render, ritual.title[locale].replace('\n', ''));
    answer(render, ritual, 'no', locale);
    press(render, locale === 'ja' ? '回答を確認する' : 'Review answers');
    assert.equal(nodes(render()).find(node => node.type === 'EnsoProgress').props.total, 16);
    assert.ok(nodes(render()).some(node => node.props['aria-expanded'] === false));
    assert.equal(results.length, 0);
    press(render, locale === 'ja' ? 'この内容で確定する' : 'Confirm these answers');
    assert.equal(results[0].answers.firstWeekDone, 'no');
    assert.equal(results[0].plan.rituals, 'no');
  }
});

test('opening a new branch from review cannot confirm until the newly visible question is answered', () => {
  const results = [];
  const render = harness({ locale: 'ja', initialPlan: defaultPlan, onConfirm: result => results.push(result) });
  completeFlow(render, 'ja');
  const ritual = questions.guidanceQuestions.find(question => question.id === 'rituals');
  press(render, ritual.title.ja.replace('\n', ''));
  answer(render, ritual, 'yes', 'ja');
  press(render, '回答一覧に戻る');
  press(render, 'この内容で確定する');
  assert.equal(results.length, 0);
  assert.equal(currentQuestion(render, 'ja').id, 'firstWeekDone');
  assert.ok(nodes(render()).some(node => node.props.accessibilityRole === 'alert'));
});

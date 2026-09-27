import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completionMessage, emptyCompletionSession } from '../apps/mobile/src/domain/completion-message.ts';

const event = { taskId: 'synthetic-task', actor: 'self', succeeded: true, wasDone: false, done: true, notNeeded: false };
test('completion message draws once per task and at most once per session', () => {
  const first = completionMessage(emptyCompletionSession(), event, () => 0.1);
  assert.equal(first.show, true);
  assert.equal(completionMessage(first.state, { ...event, taskId: 'another' }, () => 0).show, false);
  const miss = completionMessage(emptyCompletionSession(), event, () => 0.9);
  assert.equal(miss.show, false);
  assert.equal(completionMessage(miss.state, event, () => 0).show, false);
});
test('sync, failure, cancellation, already done and excluded work never draw', () => {
  for (const change of [{actor:'family'}, {succeeded:false}, {done:false}, {wasDone:true}, {notNeeded:true}]) {
    let draws = 0;
    const result = completionMessage(emptyCompletionSession(), {...event,...change}, () => { draws++; return 0; });
    assert.equal(result.show, false);
    assert.equal(draws, 0);
  }
});
test('disabled messages and invalid random values fail closed; exact 25% boundary', () => {
  assert.equal(completionMessage({...emptyCompletionSession(), disabled:true}, event, () => 0).show, false);
  for (const sample of [.25, 1, -1, NaN, Infinity]) assert.equal(completionMessage(emptyCompletionSession(), event, () => sample).show, false);
});
test('home puts the milestone after today tasks, including the empty and locked states', () => {
  const app = readFileSync('apps/mobile/src/App.tsx', 'utf8');
  const home = app.slice(app.indexOf("{screen === 'home' && activeMember"), app.indexOf("{screen === 'tasks' && activeMember"));
  assert.ok(home.indexOf('<MilestoneSection') > home.indexOf('{lockedTasks}'));
  assert.ok(home.indexOf('<MilestoneSection') > home.indexOf('There are no open applicable tasks'));
});

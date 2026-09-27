export type CompletionSession = { attemptedTaskIds: readonly string[]; shown: boolean; disabled: boolean };
export const emptyCompletionSession = (): CompletionSession => ({ attemptedTaskIds: [], shown: false, disabled: false });
export type CompletionEvent = { taskId: string; actor: 'self' | 'family'; succeeded: boolean; wasDone: boolean; done: boolean; notNeeded: boolean };

/** Session-only preference until the authenticated preference store is available. */
export function completionMessage(state: CompletionSession, event: CompletionEvent, random: () => number): { state: CompletionSession; show: boolean } {
  if (state.disabled || state.shown || !event.taskId || !event.succeeded || event.actor !== 'self'
    || event.wasDone || !event.done || event.notNeeded || state.attemptedTaskIds.includes(event.taskId)) return { state, show: false };
  const sample = random();
  const show = Number.isFinite(sample) && sample >= 0 && sample < .25;
  return { state: { ...state, attemptedTaskIds: [...state.attemptedTaskIds, event.taskId], shown: show }, show };
}

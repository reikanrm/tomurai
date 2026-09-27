export const STARTUP_DELAY_MS = 3_000;
export const STARTUP_FADE_MS = 280;

export type StartupConditions = {
  active: boolean;
  screenReader: boolean | null;
  reduceMotion: boolean | null;
};

type StartupPorts = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
  fade: (onFinished: () => void) => () => void;
  onComplete: () => void;
};

// Owns only this mount's lifecycle. The caller decides whether a new onboarding
// should show it; neither this sequence nor the screen stores first-use data.
export function createStartupSequence(ports: StartupPorts) {
  let conditions: StartupConditions = { active: false, screenReader: null, reduceMotion: null };
  let remaining = STARTUP_DELAY_MS;
  let startedAt: number | null = null;
  let cancelPending: (() => void) | null = null;
  let generation = 0;
  let finished = false;
  let disposed = false;

  function pause() {
    // Invalidate callbacks before cancellation: native animation cancellation can
    // invoke its callback synchronously, and already queued timers can still fire.
    generation++;
    if (startedAt !== null) remaining = Math.max(0, remaining - Math.max(0, ports.now() - startedAt));
    startedAt = null;
    const cancel = cancelPending;
    cancelPending = null;
    cancel?.();
  }

  function complete() {
    if (disposed || finished) return;
    finished = true;
    pause();
    ports.onComplete();
  }

  function resume() {
    if (disposed || finished || !conditions.active || conditions.screenReader !== false) return;
    const current = generation;
    if (remaining > 0) {
      startedAt = ports.now();
      cancelPending = ports.schedule(() => {
        if (disposed || finished || current !== generation) return;
        pause();
        resume();
      }, remaining);
      return;
    }
    // Unknown motion preferences fail safe: no animation, not an assumed opt-in.
    if (conditions.reduceMotion !== false) { complete(); return; }
    const cancel = ports.fade(() => {
      if (!disposed && !finished && current === generation) complete();
    });
    if (!disposed && !finished && current === generation) cancelPending = cancel;
    else cancel();
  }

  return {
    update(next: StartupConditions) {
      if (disposed || finished || (next.active === conditions.active &&
        next.screenReader === conditions.screenReader && next.reduceMotion === conditions.reduceMotion)) return;
      pause();
      conditions = { ...next };
      resume();
    },
    continue() {
      // Explicit interaction works even when accessibility detection fails.
      if (conditions.active) complete();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
    },
  };
}

export const STARTUP_DELAY_MS = 3_000;
export const STARTUP_FADE_MS = 280;
export const STARTUP_ENTRANCE_MS = 320;

export type StartupConditions = {
  active: boolean;
  screenReader: boolean | null;
  reduceMotion: boolean | null;
};

type StartupPorts = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
  fade: (onFinished: () => void) => () => void;
  onComplete: (animated: boolean) => void;
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
  let manual = false;
  let fading = false;

  function pause() {
    // Invalidate callbacks before cancellation: native animation cancellation can
    // invoke its callback synchronously, and already queued timers can still fire.
    generation++;
    if (startedAt !== null) remaining = Math.max(0, remaining - Math.max(0, ports.now() - startedAt));
    startedAt = null;
    const cancel = cancelPending;
    cancelPending = null;
    fading = false;
    cancel?.();
  }

  function complete(animated = false) {
    if (disposed || finished) return;
    finished = true;
    pause();
    ports.onComplete(animated);
  }

  function resume() {
    if (disposed || finished || !conditions.active || (!manual && conditions.screenReader !== false)) return;
    const current = generation;
    if (remaining > 0 && !manual) {
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
    fading = true;
    const cancel = ports.fade(() => {
      if (!disposed && !finished && current === generation) complete(true);
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
      if (disposed || finished || !conditions.active || fading) return;
      manual = true;
      pause();
      resume();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
    },
  };
}

import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native';
import { STARTUP_ENTRANCE_MS } from '../domain/startup';

/** Mounted only after the intro. No looping animation on answers or navigation. */
export function StartupEntrance({ animate, children }: { animate: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) { progress.setValue(1); return; }
    let alive = true;
    let stopped = false;
    const animation = Animated.timing(progress, {
      toValue: 1, duration: STARTUP_ENTRANCE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    const finish = () => {
      if (!alive) return;
      stopped = true;
      animation.stop();
      progress.setValue(1);
    };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => { if (enabled) finish(); });
    const app = AppState.addEventListener('change', state => { if (state !== 'active') finish(); });
    // Re-check preferences to cover the short gap between unmounting the intro
    // and subscribing here. A late query cannot start a cancelled animation.
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => { if (reduced) finish(); }).catch(finish);
    if (AppState.currentState === 'active' && !stopped) animation.start();
    else finish();
    return () => { alive = false; animation.stop(); motion.remove(); app.remove(); };
  }, [animate, progress]);
  return <Animated.View testID="startup-entrance" style={{ flex: 1, opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
    {children}
  </Animated.View>;
}

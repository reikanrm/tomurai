import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { createStartupSequence, STARTUP_FADE_MS, type StartupConditions } from '../domain/startup';
import { colors as c, font } from '../theme';
import { EnsoProgress } from './EnsoProgress';

export function StartupIntro({ locale, onComplete }: { locale: Locale; onComplete: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const sequenceRef = useRef<ReturnType<typeof createStartupSequence> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;

  useEffect(() => {
    let alive = true;
    let readerChanged = false;
    let motionChanged = false;
    const conditions: StartupConditions = {
      active: AppState.currentState === 'active', screenReader: null, reduceMotion: null,
    };
    const sequence = createStartupSequence({
      now: () => performance.now(),
      schedule(callback, delayMs) {
        const timer = setTimeout(callback, delayMs);
        return () => clearTimeout(timer);
      },
      fade(onFinished) {
        let completed = false;
        opacity.setValue(1);
        const animation = Animated.timing(opacity, {
          toValue: 0, duration: STARTUP_FADE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        });
        animation.start(({ finished }) => { if (finished) { completed = true; onFinished(); } });
        return () => { animation.stop(); if (!completed) opacity.setValue(1); };
      },
      onComplete: () => onCompleteRef.current(),
    });
    sequenceRef.current = sequence;
    sequence.update(conditions);
    const appSubscription = AppState.addEventListener('change', state => {
      if (!alive) return;
      conditions.active = state === 'active';
      sequence.update(conditions);
    });
    const readerSubscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => {
      if (!alive) return;
      readerChanged = true;
      conditions.screenReader = enabled;
      setScreenReader(enabled);
      sequence.update(conditions);
    });
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      if (!alive) return;
      motionChanged = true;
      conditions.reduceMotion = enabled;
      sequence.update(conditions);
    });
    // Subscribe before querying, and do not overwrite a newer native event with
    // a stale asynchronous initial value. Unknown/error stays manual and still.
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (!alive || readerChanged) return;
      conditions.screenReader = enabled;
      setScreenReader(enabled);
      sequence.update(conditions);
    }).catch(() => {});
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (!alive || motionChanged) return;
      conditions.reduceMotion = enabled;
      sequence.update(conditions);
    }).catch(() => {});
    return () => {
      alive = false;
      sequence.dispose();
      sequenceRef.current = null;
      appSubscription.remove();
      readerSubscription.remove();
      motionSubscription.remove();
    };
  }, [opacity]);

  return <Animated.View style={[s.root, { opacity }]} testID="startup-intro">
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.identity}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          <EnsoProgress completed={0} total={1} appearance="brand" label="" size={132} />
        </View>
        <Text accessibilityRole="header" style={s.title}>Tomurai</Text>
        <Text style={s.tagline}>{t('必要なことをひとつずつ。', 'One thing at a time.')}</Text>
        <Pressable accessibilityRole="button" onPress={() => sequenceRef.current?.continue()} style={s.skip}>
          <Text style={s.skipText}>{screenReader === false ? t('スキップ', 'Skip') : t('続ける', 'Continue')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  </Animated.View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36, minHeight: 360 },
  identity: { width: '100%', maxWidth: 360, alignItems: 'center' },
  title: { color: c.ink, fontFamily: font, fontSize: 32, lineHeight: 48, letterSpacing: 3, textAlign: 'center', marginBottom: 16 },
  tagline: { color: c.muted, fontFamily: font, fontSize: 15, lineHeight: 28, textAlign: 'center' },
  skip: { minHeight: 48, minWidth: 96, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 36 },
  skipText: { color: c.muted, fontFamily: font, fontSize: 14, lineHeight: 24, textAlign: 'center' },
});

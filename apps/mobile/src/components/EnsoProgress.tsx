import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';
import { progressValue, revealSector } from '../domain/progress';
import { colors, font } from '../theme';

// Code-native interpretation of the supplied brush-circle photograph.
// Not a pixel-exact extraction or a replacement for an approved master logo.
const BRUSH = [
  'M70 172 C39 166 17 133 18 99 C18 50 54 15 101 14 C150 12 184 51 182 102 C181 138 160 167 125 181 C151 164 166 135 165 104 C165 65 137 38 103 38 C64 36 39 66 39 104 C39 129 51 148 70 151 C83 152 91 164 83 173 C79 177 74 176 70 172 Z',
  'M52 162 C22 141 13 106 24 70 C36 31 76 10 114 19 C79 11 38 41 29 78 C18 119 34 145 52 162 Z',
  'M145 169 C170 149 187 121 182 85 C193 125 172 159 145 169 Z',
  'M120 182 C149 169 171 143 173 115 C173 146 153 171 120 182 Z',
  'M137 175 C166 153 177 129 177 99 C181 128 168 158 137 175 Z',
];

export function EnsoProgress({ completed, total, label, size = 116 }: {
  completed: number; total: number; label: string; size?: number;
}) {
  const value = progressValue(completed, total);
  const id = 'enso-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const animated = useRef(new Animated.Value(value.ratio)).current;
  const [shown, setShown] = useState(value.ratio);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(flag => { if (active) setReduceMotion(flag); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const listener = animated.addListener(({ value: next }) => setShown(next));
    if (reduceMotion) animated.setValue(value.ratio);
    else Animated.timing(animated, {
      toValue: value.ratio, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    return () => { animated.stopAnimation(); animated.removeListener(listener); };
  }, [value.ratio, reduceMotion, animated]);

  return <View style={styles.holder} accessible accessibilityRole="progressbar"
    accessibilityLabel={label}
    aria-valuemin={0} aria-valuemax={value.total || 1} aria-valuenow={value.completed}
    aria-valuetext={value.total ? `${value.completed} / ${value.total} · ${label}` : label}
    accessibilityValue={{ min: 0, max: value.total || 1, now: value.completed,
      text: value.total ? `${value.completed} / ${value.total} · ${label}` : label }}>
    <Svg width={size} height={size} viewBox="0 0 200 200" accessible={false}>
      <Defs><ClipPath id={id}><Path d={revealSector(shown)} /></ClipPath></Defs>
      <G fill={colors.line}>{BRUSH.map((d, i) => <Path key={i} d={d} />)}</G>
      {shown > 0 && <G fill={colors.green} clipPath={shown >= 1 ? undefined : `url(#${id})`}>
        {BRUSH.map((d, i) => <Path key={i} d={d} />)}
      </G>}
    </Svg>
    <Text style={styles.caption} accessible={false}>{value.completed} / {value.total}　{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  holder: { alignItems: 'center', marginBottom: 24 },
  caption: { fontFamily: font, fontSize: 12, color: colors.muted, marginTop: 7, letterSpacing: 1 },
});

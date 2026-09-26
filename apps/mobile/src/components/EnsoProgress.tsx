import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, Image, Mask, Path, Rect } from 'react-native-svg';
import { progressValue, revealSector } from '../domain/progress';
import { colors, font } from '../theme';

// The supplied PNG already contains transparency, including the fine dry-brush
// marks. Use that original alpha once, without redrawing or thresholding it.
const originalEnso = require('../../assets/enso-original.png');
const scale = 200 / 480;

export function EnsoProgress({ completed, total, label, size = 116, appearance = 'progress' }: {
  completed: number; total: number; label: string; size?: number; appearance?: 'progress' | 'brand';
}) {
  const value = progressValue(completed, total);
  const logoSize = size * 0.5;
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

  const isBrand = appearance === 'brand';
  const progressAccessibility = isBrand ? {} : {
    'aria-valuemin': 0, 'aria-valuemax': value.total || 1, 'aria-valuenow': value.completed,
    'aria-valuetext': value.total ? `${value.completed} / ${value.total} · ${label}` : label,
    accessibilityValue: { min: 0, max: value.total || 1, now: value.completed,
      text: value.total ? `${value.completed} / ${value.total} · ${label}` : label },
  };
  return <View style={styles.holder} accessible accessibilityRole={isBrand ? 'image' : 'progressbar'}
    accessibilityLabel={label}
    {...progressAccessibility}>
    <Svg width={logoSize} height={logoSize} viewBox="0 0 200 200" accessible={false} aria-hidden>
      <Defs><Mask id={id} x={0} y={0} width={200} height={200}
        maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" maskType="alpha" style={{ maskType: 'alpha' }}>
        <Image href={originalEnso} x={-280 * scale} y={-150 * scale}
          width={1024 * scale} height={1024 * scale} />
      </Mask></Defs>
      <G mask={`url(#${id})`}>
        <Rect width={200} height={200} fill={isBrand || shown >= 1 ? colors.enso : colors.line} />
        {!isBrand && shown > 0 && shown < 1 && <Path d={revealSector(shown)} fill={colors.enso} />}
      </G>
    </Svg>
    <Text style={styles.caption} accessible={false}>{isBrand ? label : `${value.completed} / ${value.total}　${label}`}</Text>
  </View>;
}

const styles = StyleSheet.create({
  holder: { alignItems: 'center', marginBottom: 24 },
  caption: { fontFamily: font, fontSize: 12, color: colors.muted, marginTop: 7, letterSpacing: 1 },
});

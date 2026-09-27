import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { colors as c, fonts } from '../theme';

export function CompletionMessage({ locale, onClose, onDisable }: { locale: Locale; onClose: () => void; onDisable: () => void }) {
  const [screenReader, setScreenReader] = useState<boolean | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    let active = true;
    let changed = false;
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', value => {
      if (!active) return;
      changed = true;
      setScreenReader(value);
    });
    AccessibilityInfo.isScreenReaderEnabled().then(value => {
      if (active && !changed) setScreenReader(value);
    }).catch(() => {});
    return () => { active = false; sub.remove(); };
  }, []);
  useEffect(() => {
    if (screenReader !== false) return;
    let active = true;
    const timer = setTimeout(() => { if (active) onCloseRef.current(); }, 6000);
    return () => { active = false; clearTimeout(timer); };
  }, [screenReader]);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  return <View style={s.card}>
    <Text accessibilityLiveRegion="polite" style={s.copy}>{t('大切な手続きがひとつ終わりました。', 'One important task is complete.')}</Text>
    <View style={s.actions}>
      <Pressable accessibilityRole="button" onPress={onDisable} style={s.button}><Text style={s.link}>{t('今回は以後表示しない', 'Hide for this session')}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onClose} style={s.button}><Text style={s.link}>{t('閉じる', 'Dismiss')}</Text></Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 16, backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, marginHorizontal: 16 },
  copy: { fontFamily: fonts.regular, color: c.ink, fontSize: 14, lineHeight: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  button: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  link: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20, color: c.green },
});

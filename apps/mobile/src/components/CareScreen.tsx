import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { careMoods, toggleCareMood, type CareMoodId } from '../data/care';
import type { Locale } from '../data/questions';
import { colors as c, fonts } from '../theme';

type CareScreenProps = {
  locale: Locale;
  onPause: () => void;
  onFindSupport: () => void;
};

/** PO mobile mock geometry, with the approved non-judgmental copy (C07/R17).
 * Mood selection is neither a diagnosis nor persisted/shared information. */
export function CareScreen({ locale, onPause, onFindSupport }: CareScreenProps) {
  const [mood, setMood] = useState<CareMoodId | null>(null);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;

  return <>
    <Text style={s.eyebrow}>{t('こころのケア', 'SPACE FOR YOURSELF')}</Text>
    <Text accessibilityRole="header" style={s.pageTitle}>{t('心のケア', 'Care for yourself')}</Text>
    <Text style={s.pageSub}>{t('手続きの合間に。ここでは、進めなくて大丈夫です。', 'Between the tasks. Here, you do not need to move forward.')}</Text>

    <Text style={s.mark}>{t('と む ら い', 'T O M U R A I')}</Text>
    <View style={s.quoteCard}>
      <Text style={s.quote}>{t('今の気持ちに、正解はありません。\n何かを感じても、何も感じなくても。\n今は、そのままで大丈夫です。', 'There is no right way to feel.\nYou may feel something, or nothing at all.\nThere is no need to change that right now.')}</Text>
      <Text style={s.quoteSign}>{t('— とむらいより', '— From Tomurai')}</Text>
    </View>

    <Text accessibilityRole="header" style={s.moodTitle}>{t('今のお気持ちに近いものは', 'How do you feel right now?')}</Text>
    <View style={s.moods}>
      {careMoods.map(option => <Pressable key={option.id}
        accessibilityRole="button"
        accessibilityLabel={option.label[locale]}
        accessibilityState={{ selected: mood === option.id }}
        aria-pressed={mood === option.id}
        onPress={() => setMood(current => toggleCareMood(current, option.id))}
        style={[s.moodCard, mood === option.id && s.moodSelected]}>
        <Text accessible={false} aria-hidden style={s.moodIcon}>{option.icon}</Text>
        <Text style={[s.moodLabel, mood === option.id && s.moodLabelSelected]}>{option.label[locale]}</Text>
      </Pressable>)}
    </View>
    <Text style={s.moodNote}>{t('選ばなくても大丈夫です。気分の履歴は保存しません。', 'You do not have to choose. No mood history is saved.')}</Text>

    <Text accessibilityRole="header" style={s.sectionLabel}>{t('今できること', 'What you can do now')}</Text>
    <Pressable accessibilityRole="button" onPress={onFindSupport}
      accessibilityLabel={t('グリーフカウンセラーに話す。Google Mapsで相談先を探す', 'Talk to a grief counsellor. Find support in Google Maps')}
      style={s.actionRow}>
      <View style={s.actionIconBox}><Text accessible={false} aria-hidden style={s.actionIcon}>🕊</Text></View>
      <View style={s.actionCopy}>
        <Text style={s.actionTitle}>{t('グリーフカウンセラーに話す', 'Talk to a grief counsellor')}</Text>
        <Text style={s.actionSub}>{t('Google Mapsで相談先を探します', 'Find support in Google Maps')}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onPause} style={s.actionRow}>
      <View style={s.actionIconBox}><Text accessible={false} aria-hidden style={s.actionIcon}>🌿</Text></View>
      <View style={s.actionCopy}>
        <Text style={s.actionTitle}>{t('少し、間（ま）を置く', 'Take a little space')}</Text>
        <Text style={s.actionSub}>{t('手続きから離れて、ひと息つく時間を', 'A moment away from the tasks')}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" disabled accessibilityState={{ disabled: true }}
      style={[s.actionRow, s.lastAction]}>
      <View style={s.actionIconBox}><Text accessible={false} aria-hidden style={s.actionIcon}>✎</Text></View>
      <View style={s.actionCopy}>
        <Text style={s.actionTitle}>{t('思い出を書き留めておく', 'Write down a memory')}</Text>
        <Text style={s.actionSub}>{t('準備中 · このプレビューでは記録できません', 'Coming later · Not available in this preview')}</Text>
      </View>
    </Pressable>
  </>;
}

// TOM-28: values transcribed from the public PO mobile mock, not the separate
// desktop index.html. Normal line-height is matched to measured PO browser line
// boxes; only the quote and page subheading have explicitly specified line-height.
// React Native/Web renderers can differ in glyph rasterization.
const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.light, fontSize: 11, lineHeight: 16, letterSpacing: 1.76, color: c.muted, marginBottom: 8 },
  pageTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginBottom: 6 },
  pageSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 25.9, color: c.muted, marginBottom: 26 },
  mark: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, letterSpacing: 1.3, color: c.warm, textAlign: 'center', marginBottom: 24 },
  quoteCard: { backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, paddingVertical: 26, paddingHorizontal: 22, marginBottom: 34 },
  quote: { fontFamily: fonts.light, fontSize: 16, lineHeight: 32, color: c.ink, textAlign: 'center' },
  quoteSign: { fontFamily: fonts.light, fontSize: 12, lineHeight: 17, color: c.muted, textAlign: 'center', marginTop: 10 },
  moodTitle: { fontFamily: fonts.light, fontSize: 16, lineHeight: 24, color: c.ink, textAlign: 'center', marginBottom: 18 },
  moods: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 30 },
  moodCard: { alignItems: 'center', gap: 6, width: 76, minHeight: 93, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: c.line, borderRadius: 3, backgroundColor: c.paperDeep },
  moodSelected: { backgroundColor: c.warmPaper, borderColor: c.warm },
  moodIcon: { fontFamily: fonts.light, fontSize: 20, lineHeight: 29 },
  moodLabel: { fontFamily: fonts.light, fontSize: 11, lineHeight: 16, color: c.muted, textAlign: 'center' },
  moodLabelSelected: { color: c.warm },
  moodNote: { fontFamily: fonts.light, fontSize: 11, lineHeight: 16, color: c.muted, textAlign: 'center' },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: c.ink, marginTop: 34, marginBottom: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line },
  lastAction: { borderBottomWidth: 0 },
  actionIconBox: { width: 36, height: 36, borderRadius: 3, backgroundColor: c.warmPaper, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { fontFamily: fonts.light, fontSize: 16, lineHeight: 24 },
  actionCopy: { flex: 1 },
  actionTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.ink, marginBottom: 2 },
  actionSub: { fontFamily: fonts.light, fontSize: 12, lineHeight: 17, color: c.muted },
});

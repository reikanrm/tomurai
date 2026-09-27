import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { careMoods, toggleCareMood, selfCareActions, toggleSelfCareAction, type CareMoodId, type SelfCareActionId } from '../data/care';
import type { Locale } from '../data/questions';
import { colors as c, fonts } from '../theme';
import { CareActionIcon, type CareActionIconName } from './CareActionIcon';

const selfCareIcons: Record<SelfCareActionId, CareActionIconName> = {
  water: 'tea', rest: 'breath', connection: 'message',
};

type CareScreenProps = {
  locale: Locale;
  onPause: () => void;
  onFindSupport: () => void;
};

/** PO mobile mock geometry, with the approved non-judgmental copy (C07/R17).
 * Mood selection is neither a diagnosis nor persisted/shared information. */
export function CareScreen({ locale, onPause, onFindSupport }: CareScreenProps) {
  const [mood, setMood] = useState<CareMoodId | null>(null);
  const [action, setAction] = useState<SelfCareActionId | null>(null);
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

    <Text style={s.supplement}>{t('気持ちは、日によって変わることがあります。\n無理に整理しようとせず、今の自分に合った過ごし方を探してみましょう。', 'Feelings can change from day to day.\nThere is no need to force them into order. Explore ways to spend your time that suit you now.')}</Text>

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
    <Text style={s.actionNote}>{t('今の自分に合うものがあれば。何も選ばずに過ごしてもかまいません。', 'Only if something suits you now. You can also leave everything unselected.')}</Text>
    {selfCareActions.map(option => <View key={option.id} style={s.smallAction}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: action === option.id }}
        aria-expanded={action === option.id} style={s.smallActionButton}
        onPress={() => setAction(current => toggleSelfCareAction(current, option.id))}>
        <View style={s.actionIconBox}><CareActionIcon name={selfCareIcons[option.id]} /></View>
        <Text style={[s.actionTitle, { flex: 1 }]}>{option.title[locale]}</Text>
        <Text accessible={false} aria-hidden style={s.disclosure}>{action === option.id ? '−' : '＋'}</Text>
      </Pressable>
      {action === option.id && <View style={s.smallActionBody}>
        <Text style={s.actionBody}>{option.body[locale]}</Text>
        <Pressable accessibilityRole="button" style={s.closeAction} onPress={() => setAction(null)}>
          <Text style={s.actionSub}>{t('案内を閉じる', 'Close this suggestion')}</Text>
        </Pressable>
      </View>}
    </View>)}
    <Pressable accessibilityRole="button" onPress={onFindSupport}
      accessibilityLabel={t('グリーフカウンセラーに話す。Google Mapsで相談先を探す', 'Talk to a grief counsellor. Find support in Google Maps')}
      style={s.actionRow}>
      <View style={s.actionIconBox}><CareActionIcon name="message" /></View>
      <View style={s.actionCopy}>
        <Text style={s.actionTitle}>{t('グリーフカウンセラーに話す', 'Talk to a grief counsellor')}</Text>
        <Text style={s.actionSub}>{t('Google Mapsで相談先を探します', 'Find support in Google Maps')}</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={onPause} style={[s.actionRow, s.lastAction]}>
      <View style={s.actionIconBox}><CareActionIcon name="breath" /></View>
      <View style={s.actionCopy}>
        <Text style={s.actionTitle}>{t('少し、間（ま）を置く', 'Take a little space')}</Text>
        <Text style={s.actionSub}>{t('手続きから離れて、ひと息つく時間を', 'A moment away from the tasks')}</Text>
      </View>
    </Pressable>
  </>;
}

// TOM-28: values transcribed from the public PO mobile mock, not the separate
// desktop index.html. Normal line-height is matched to measured PO browser line
// boxes; only the quote and page subheading have explicitly specified line-height.
// TOM-59 changes only the action artwork/40px box to the Web care SVGs.
// React Native/Web renderers can differ in glyph rasterization.
const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.light, fontSize: 11, lineHeight: 16, letterSpacing: 1.76, color: c.muted, marginBottom: 8 },
  pageTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginBottom: 6 },
  pageSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 25.9, color: c.muted, marginBottom: 26 },
  mark: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, letterSpacing: 1.3, color: c.warm, textAlign: 'center', marginBottom: 24 },
  quoteCard: { backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, paddingVertical: 26, paddingHorizontal: 22, marginBottom: 34 },
  quote: { fontFamily: fonts.light, fontSize: 16, lineHeight: 32, color: c.ink, textAlign: 'center' },
  quoteSign: { fontFamily: fonts.light, fontSize: 12, lineHeight: 17, color: c.muted, textAlign: 'center', marginTop: 10 },
  supplement: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22.2, color: c.muted, textAlign: 'center', marginTop: -16, marginBottom: 30 },
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
  actionIconBox: { width: 40, height: 40, flexShrink: 0, borderRadius: 3, backgroundColor: c.warmPaper, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1 },
  actionTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.ink, marginBottom: 2 },
  actionSub: { fontFamily: fonts.light, fontSize: 12, lineHeight: 17, color: c.muted },
  actionNote: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22, color: c.muted, marginVertical: 14 },
  smallAction: { borderBottomWidth: 1, borderColor: c.line },
  smallActionButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  disclosure: { color: c.warm, fontSize: 18, width: 24, textAlign: 'center' },
  smallActionBody: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.warmPaper, marginBottom: 12 },
  actionBody: { fontFamily: fonts.light, fontSize: 13, lineHeight: 25, color: c.ink },
  closeAction: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
});

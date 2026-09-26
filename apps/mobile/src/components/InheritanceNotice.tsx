import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import type { Choice } from '../domain/guidance-model';
import { getInheritanceNotice, inheritanceDetails, inheritanceSources, type InheritanceContext } from '../domain/inheritance';
import { colors as c, fonts } from '../theme';

type InheritanceNoticeProps = {
  locale: Locale;
  deathDate: string;
  today: string;
  consideration: Choice;
  context?: InheritanceContext;
  onConsiderationChange?: (value: Choice) => void;
  onFindSupport: () => void;
};

/** General safety guidance remains visible, including when the answer is “no”. */
export function InheritanceNotice({ locale, deathDate, today, consideration, context = 'overview', onConsiderationChange, onFindSupport }: InheritanceNoticeProps) {
  const [expanded, setExpanded] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const notice = getInheritanceNotice({ deathDate, today, consideration, context });
  const choices: Array<{ value: Choice; label: string }> = [
    { value: 'yes', label: t('はい', 'Yes') },
    { value: 'no', label: t('いいえ', 'No') },
    { value: 'unknown', label: t('わからない', 'Not sure') },
  ];
  async function openSource(url: string) {
    setSourceError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setSourceError(true);
    }
  }

  return <View style={s.card}>
    <Text style={s.eyebrow}>{t('相続について', 'INHERITANCE IN JAPAN')}</Text>
    <Text accessibilityRole="header" style={s.title}>{notice.title[locale]}</Text>
    {notice.reminderText && <Text style={s.reminder}>{notice.reminderText[locale]}</Text>}
    <Text style={s.warning}>{notice.warning[locale]}</Text>

    <Pressable accessibilityRole="button"
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={() => setExpanded(value => !value)} style={s.detailToggle}>
      <Text style={s.linkText}>{expanded ? t('詳しい説明を閉じる', 'Hide details') : t('期間・手続きと出典を確認する', 'Read about timing, procedures and sources')}</Text>
      <Text accessible={false} aria-hidden style={s.toggleMark}>{expanded ? '−' : '＋'}</Text>
    </Pressable>

    {expanded && <View style={s.details}>
      {inheritanceDetails.map(detail => <View key={detail.id} style={s.detail}>
        <Text accessibilityRole="header" style={s.detailTitle}>{detail.title[locale]}</Text>
        <Text style={s.body}>{detail.body[locale]}</Text>
      </View>)}
      <Text style={s.note}>{t('日本の制度についての一般的な案内です。個別の判断は専門家・家庭裁判所に確認してください。', 'This is general information about procedures in Japan. Confirm your own situation with a qualified professional or the family court.')}</Text>
      {inheritanceSources.map(source => <Pressable key={source.id} accessibilityRole="link"
        accessibilityHint={t('外部ブラウザで開きます', 'Opens in your browser')}
        onPress={() => void openSource(source.url)} style={s.sourceLink}>
        <Text style={s.sourceText}>{source.label[locale]} ↗</Text>
      </Pressable>)}
      {sourceError && <Text accessibilityRole="alert" style={s.error}>{t('裁判所のページを開けませんでした。通信状態を確認して、もう一度リンクを押してください。', 'The court page could not be opened. Check your connection and try the link again.')}</Text>}
      {onConsiderationChange && <View style={s.question}>
        <Text style={s.questionTitle}>{t('相続放棄・限定承認を検討していますか？（任意）', 'Are you considering renunciation or limited acceptance? (Optional)')}</Text>
        <View style={s.choices}>
          {choices.map(choice => <Pressable key={choice.value}
            accessibilityRole="button"
            accessibilityLabel={choice.label}
            accessibilityState={{ selected: notice.consideration === choice.value }}
            aria-pressed={notice.consideration === choice.value}
            onPress={() => onConsiderationChange(choice.value)}
            style={[s.choice, notice.consideration === choice.value && s.choiceSelected]}>
            <Text style={[s.choiceText, notice.consideration === choice.value && s.choiceTextSelected]}>
              {notice.consideration === choice.value ? '✓ ' : ''}{choice.label}
            </Text>
          </Pressable>)}
        </View>
      </View>}

      <Pressable accessibilityRole="button" onPress={onFindSupport}
        accessibilityLabel={t('相続の相談先をGoogle Mapsで探す', 'Find inheritance support in Google Maps')}
        style={s.supportButton}>
        <Text style={s.supportText}>{t('相談先をGoogle Mapsで探す', 'Find support in Google Maps')}</Text>
      </Pressable>
    </View>}
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 18, marginTop: 18, marginBottom: 20, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, backgroundColor: c.warmPaper },
  eyebrow: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, letterSpacing: 1, color: c.muted, marginBottom: 6 },
  title: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 25, color: c.ink, marginBottom: 10 },
  reminder: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, color: c.muted, marginBottom: 10 },
  warning: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 24, color: c.ink },
  question: { marginTop: 18 },
  questionTitle: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, color: c.ink, marginBottom: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, backgroundColor: c.paper },
  choiceSelected: { borderColor: c.green, backgroundColor: c.green },
  choiceText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20, color: c.ink },
  choiceTextSelected: { color: c.white },
  detailToggle: { minHeight: 44, marginTop: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 21, color: c.green },
  toggleMark: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 24, color: c.green },
  details: { borderTopWidth: 1, borderTopColor: c.warmLine, paddingTop: 16, marginBottom: 8 },
  detail: { marginBottom: 16 },
  detailTitle: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 22, color: c.ink, marginBottom: 5 },
  body: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 22, color: c.ink },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 20, color: c.muted, marginBottom: 6 },
  sourceLink: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  sourceText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 20, color: c.green, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, color: c.ink, marginTop: 8 },
  supportButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.green, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 12, marginTop: 6 },
  supportText: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 22, color: c.green, textAlign: 'center' },
});

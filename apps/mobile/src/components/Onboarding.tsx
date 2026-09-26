import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { questions, type Locale } from '../data/questions';
import { isValidPastDate } from '../domain/progress';
import { colors as c, font, fonts } from '../theme';
import { EnsoProgress } from './EnsoProgress';
import { CalendarDateField } from './CalendarDateField';
import { todayInJapan } from '../domain/calendar';

export function Onboarding({ locale, onConfirm, initialAnswers = {} }: {
  locale: Locale; onConfirm: (answers: Record<string, string>) => void; initialAnswers?: Record<string, string>;
}) {
  const [step, setStep] = useState(Object.keys(initialAnswers).length ? questions.length : -1);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [error, setError] = useState('');
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const question = questions[step];
  const selected = question ? answers[question.id] : undefined;
  const [today, setToday] = useState(todayInJapan);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInJapan()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const next = () => {
    if (!question || !selected) return;
    if (question.id === 'deathDate' && selected !== 'unknown' && !isValidPastDate(selected, todayInJapan())) {
      setError(t('今日以前の実際の日付を YYYY-MM-DD で入力するか、「あとで確認する」を選んでください。', 'Enter a real date on or before today as YYYY-MM-DD, or choose “Check later”.'));
      return;
    }
    setError(''); setStep(step + 1);
  };
  const choose = (value: string) => {
    if (question) setAnswers({ ...answers, [question.id]: value });
    setError('');
  };
  return <View style={s.root}>
    <EnsoProgress completed={Math.max(0, step)} total={questions.length}
      appearance={step < 0 ? 'brand' : 'progress'}
      label={step < 0 ? t('全10問・あとで確認も選べます', '10 questions · you can check later') : t('質問の確認', 'questions reviewed')} size={132} />
    {step < 0 ? <>
      <Text style={s.eyebrow}>{t('はじめに', 'GETTING STARTED')}</Text>
      <Text accessibilityRole="header" style={s.title}>{t('必要なことを、\nひとつずつ。', 'One thing\nat a time.')}</Text>
      <Text style={s.copy}>{t('いくつかの質問から、必要な手続きを整理します。\nわからないことは、あとで確認できます。', 'A few questions help organise what needs to be done.\nYou can check anything you are unsure about later.')}</Text>
      <View style={s.note}><Text style={s.noteText}>{t('回答するのは、ご家族の代表1名です。\n最後に内容を確認してから確定します。', 'One designated family member answers.\nReview your answers before confirming.')}</Text></View>
      <Pressable accessibilityRole="button" style={s.primary} onPress={() => setStep(0)}>
        <Text style={s.primaryText}>{t('質問をはじめる', 'Start questions')}　→</Text>
      </Pressable>
    </> : question ? <>
      <Text style={s.eyebrow}>{t(`質問 ${step + 1} / ${questions.length}`, `QUESTION ${step + 1} OF ${questions.length}`)}</Text>
      <Text accessibilityRole="header" style={s.title}>{question.title[locale]}</Text>
      <Text style={s.copy}>{t('わかる範囲で、お聞かせください。', 'Answer with what you know for now.')}</Text>
      {question.id === 'deathDate' ? <>
        <CalendarDateField locale={locale} label={t('亡くなった日', 'Date of death')}
          value={selected === 'unknown' ? '' : selected ?? ''} onChange={choose} maxDate={today} />
        <Option label={t('わからない・あとで確認する', 'Not sure · check later')}
          selected={selected === 'unknown'} onPress={() => choose('unknown')} />
      </> : question.options?.map(option => <Option key={option.id} label={option.label[locale]}
        selected={selected === option.id} onPress={() => choose(option.id)} />)}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <View style={s.actions}>
        <Pressable accessibilityRole="button" onPress={() => { setStep(step - 1); setError(''); }} style={s.back}>
          <Text style={s.backText}>←　{t('戻る', 'Back')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !selected }} aria-disabled={!selected}
          disabled={!selected} onPress={next} style={[s.primary, { flex: 1 }, !selected && s.disabled]}>
          <Text style={s.primaryText}>{step === questions.length - 1 ? t('回答を確認する', 'Review answers') : t('次へ', 'Next')}　→</Text>
        </Pressable>
      </View>
      <Text style={s.footnote}>{t('入力内容はまだ確定していません。', 'Your answers have not been confirmed yet.')}</Text>
    </> : <>
      <Text accessibilityRole="header" style={s.title}>{t('回答を確認する', 'Review your answers')}</Text>
      <Text style={s.copy}>{t('「わからない」のままでも進めます。\n必要に応じて、あとで確認しましょう。', 'You can continue with “Not sure”.\nCheck those details when you need to.')}</Text>
      {questions.map((q, i) => <Pressable key={q.id} accessibilityRole="button"
        accessibilityLabel={t(q.title.ja.replace('\n', '') + 'を見直す', 'Review: ' + q.title.en.replace('\n', ' '))}
        style={s.summary} onPress={() => setStep(i)}>
        <View style={{ flex: 1 }}><Text style={s.inputLabel}>{q.title[locale].replace('\n', '')}</Text>
          <Text style={s.answer}>{q.options?.find(o => o.id === answers[q.id])?.label[locale]
            ?? (answers[q.id] === 'unknown' ? t('あとで確認する', 'Check later') : answers[q.id])}</Text>
        </View><Text style={s.backText}>{t('修正', 'Edit')}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" style={s.primary} onPress={() => onConfirm({ ...answers })}>
        <Text style={s.primaryText}>{t('この内容で確定する', 'Confirm these answers')}</Text>
      </Pressable>
    </>}
    <Text style={s.footnote}>{t('個人を特定する情報は入力しないでください。\n入力内容は、アプリを開き直すと消えます。', 'Do not enter identifying personal information.\nEntries are cleared when the app is reopened.')}</Text>
  </View>;
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }}
    aria-checked={selected}
    accessibilityLabel={label} onPress={onPress} style={[s.option, selected && s.selected]}>
    <View style={[s.radio, selected && s.radioSelected]}>{selected && <View style={s.dot} />}</View>
    <Text style={s.optionText}>{label}</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  root: { paddingTop: 6 }, eyebrow: { color: c.muted, fontFamily: font, textAlign: 'center', fontSize: 12, letterSpacing: 1.4, marginBottom: 13 },
  title: { fontFamily: fonts.bold, color: c.ink, fontSize: 25, lineHeight: 39, textAlign: 'center', marginBottom: 16 },
  copy: { fontFamily: font, color: c.muted, fontSize: 14, lineHeight: 25, textAlign: 'center', marginBottom: 28 },
  note: { borderLeftWidth: 2, borderLeftColor: c.greenSoft, padding: 18, backgroundColor: c.paperDeep, marginBottom: 32 },
  noteText: { fontFamily: font, color: c.muted, fontSize: 14, lineHeight: 24 },
  primary: { backgroundColor: c.green, borderRadius: 3, minHeight: 52, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryText: { color: c.white, fontFamily: fonts.medium, fontSize: 15, textAlign: 'center' },
  disabled: { opacity: .45 }, option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 3, padding: 17, minHeight: 60, marginBottom: 10, gap: 14 },
  selected: { borderColor: c.green, backgroundColor: '#EFF3EF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: c.greenSoft, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: c.green }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
  optionText: { flex: 1, fontFamily: font, color: c.ink, fontSize: 15, lineHeight: 24 },
  inputLabel: { fontFamily: font, fontSize: 12, lineHeight: 21, color: c.muted, marginBottom: 7 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  back: { minHeight: 48, padding: 12, justifyContent: 'center' }, backText: { fontFamily: font, color: c.green, fontSize: 14 },
  footnote: { fontFamily: font, fontSize: 12, color: c.muted, textAlign: 'center', lineHeight: 21, marginTop: 24 },
  error: { fontFamily: font, color: '#8C3824', fontSize: 14, lineHeight: 23 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 14 },
  answer: { fontFamily: font, fontSize: 15, color: c.ink },
});

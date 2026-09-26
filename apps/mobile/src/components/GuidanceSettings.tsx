import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { addDays, validDate } from '../domain/calendar';
import type { Choice, GuidancePlan } from '../domain/guidance-model';
import { colors as c, fonts } from '../theme';
import { CalendarDateField } from './CalendarDateField';

export function GuidanceSettings({ locale, plan, onApply, onClose }: {
  locale: Locale; plan: GuidancePlan; onApply: (plan: GuidancePlan) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(plan);
  const [section, setSection] = useState('rituals');
  const [error, setError] = useState('');
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const update = <K extends keyof GuidancePlan>(key: K, value: GuidancePlan[K]) => {
    setDraft(current => ({ ...current, [key]: value })); setError('');
  };
  const choices = [{ id: 'yes', label: t('はい', 'Yes') }, { id: 'no', label: t('いいえ', 'No') }, { id: 'unknown', label: t('わからない', 'Not sure') }];
  const serviceChoices = [{ id: 'yes', label: t('実施済み', 'Completed') }, { id: 'no', label: t('まだ', 'Not yet') },
    { id: 'unknown', label: t('わからない', 'Not sure') }, { id: 'notNeeded', label: t('行わない', 'Not holding it') }];
  const field = (key: keyof GuidancePlan, label: string, options = choices, help?: string) => <View style={s.field}>
    <Text accessibilityRole="header" style={s.label}>{label}</Text>
    {help && <Text style={s.help}>{help}</Text>}
    <View style={s.options}>{options.map(option => <Pressable key={option.id} accessibilityRole="radio"
      accessibilityLabel={`${label}：${option.label}`} accessibilityState={{ checked: draft[key] === option.id }} aria-checked={draft[key] === option.id}
      style={[s.option, draft[key] === option.id && s.selected]} onPress={() => update(key, option.id as Choice)}>
      <Text style={[s.optionText, draft[key] === option.id && s.selectedText]}>{option.label}</Text>
    </Pressable>)}</View>
  </View>;
  const heading = (id: string, title: string) => <Pressable accessibilityRole="button" accessibilityState={{ expanded: section === id }} aria-expanded={section === id}
    onPress={() => setSection(section === id ? '' : id)} style={s.section}>
    <Text style={s.sectionText}>{title}</Text><Text style={s.sectionText}>{section === id ? '−' : '+'}</Text>
  </Pressable>;
  const save = () => {
    if (draft.fortyNineDate && (!validDate(draft.fortyNineDate) || (validDate(draft.deathDate) && draft.fortyNineDate < draft.deathDate))) {
      setSection('rituals');
      setError(t('法要の予定日は、亡くなった日以降の実際の日付を YYYY-MM-DD で入力してください。未定なら空欄にできます。', 'Enter a real service date on or after the date of death as YYYY-MM-DD, or leave it blank.'));
      return;
    }
    onApply(draft);
  };
  return <>
    <Text style={s.eyebrow}>{t('ご家族のかたちに合わせて', 'FOR YOUR FAMILY')}</Text>
    <Text accessibilityRole="header" style={s.title}>{t('法要・ご供養の確認', 'Rituals & remembrance')}</Text>
    <Text style={s.copy}>{t('わかる範囲で選んでください。宗派・地域・ご家庭によって必要なことは異なります。あとから変更できます。', 'Choose what you know. Practices differ by tradition, region and family. You can change these choices later.')}</Text>
    {field('rituals', t('初七日・四十九日の案内を表示しますか？', 'Show seventh-day and 49th-day guidance?'), [
      { id: 'yes', label: t('表示する', 'Show') }, { id: 'no', label: t('表示しない', 'Hide') }, { id: 'unknown', label: t('あとで確認', 'Check later') },
    ])}
    {heading('rituals', t('法要と準備', 'Services & preparation'))}
    {section === 'rituals' && <>
      {field('funeralDone', t('通夜・葬儀は終わりましたか？', 'Have the funeral services finished?'))}
      {draft.rituals === 'yes' && <>
        {field('firstWeekDone', t('初七日法要は実施済みですか？', 'Has the seventh-day service already been held?'), serviceChoices,
          t('葬儀当日に行った場合も含みます。形式や実施の要否は寺院・僧侶に確認できます。', 'This includes a service held with the funeral. Ask your temple about the form and whether it is needed.'))}
        <Text style={s.help}>{t('初七日の目安：', 'Seventh-day guide: ')}{addDays(draft.deathDate, 6) ?? t('日付未定', 'Date unknown')}{'\n'}
          {t('四十九日の目安：', '49th-day guide: ')}{addDays(draft.deathDate, 48) ?? t('日付未定', 'Date unknown')}</Text>
        {field('firstWeekMeal', t('初七日後の会食を予定していますか？', 'Plan a meal after the seventh-day service?'))}
        {field('fortyNineDone', t('四十九日法要はすでに行いましたか？', 'Has the 49th-day service already been held?'), serviceChoices)}
        <Text style={s.label}>{t('四十九日法要の予定日（任意）', '49th-day service date (optional)')}</Text>
        <Text style={s.help}>{t('49日目より前に行う場合もあります。目安の日付とは別に扱います。', 'The service may be held earlier. This date is separate from the 49th-day guide.')}</Text>
        <CalendarDateField locale={locale} label={t('四十九日法要の予定日', '49th-day service date')}
          value={draft.fortyNineDate} onChange={value => update('fortyNineDate', value)}
          minDate={validDate(draft.deathDate) ? draft.deathDate : undefined}
          clearLabel={t('予定日を未定に戻す', 'Clear the service date')} />
        {field('tablet', t('本位牌等を使用しますか？', 'Will your family use a memorial tablet?'), choices,
          t('浄土真宗など原則として本位牌を使わない宗派もあります。不明な場合は菩提寺・寺院へ確認してください。', 'Some traditions, including Jodo Shinshu, generally do not use these tablets. Ask your temple if unsure.'))}
        {field('fortyNineMeal', t('四十九日後の会食を予定していますか？', 'Plan a meal after the 49th-day service?'))}
        {field('gifts', t('四十九日の返礼品を用意しますか？', 'Prepare gifts for the 49th-day service?'))}
        {field('eyeOpening', t('開眼供養等を行いますか？', 'Will a consecration or similar rite be held?'), choices, t('名称や必要性は宗派・ご家庭によります。', 'The name and need depend on your tradition and family.'))}
        {field('altar', t('後飾り祭壇を設けていますか？', 'Does your family have a temporary memorial altar?'))}
      </>}
    </>}
    {draft.rituals !== 'yes' && !!draft.fortyNineDate && <View style={s.field}>
      <Text style={s.label}>{t('入力済みの法要予定日', 'Previously entered service date')}</Text>
      <Text style={s.help}>{draft.fortyNineDate}</Text>
      <Pressable accessibilityRole="button" style={s.option} onPress={() => update('fortyNineDate', '')}>
        <Text style={s.optionText}>{t('予定日を未定に戻す', 'Clear the service date')}</Text></Pressable>
    </View>}
    {heading('burial', t('納骨', 'Interment'))}
    {section === 'burial' && <>
      {field('burial', t('四十九日前後に納骨を予定していますか？', 'Do you plan interment around the 49th day?'), [
        { id: 'around49', label: t('予定している', 'Yes') }, { id: 'later', label: t('別の時期', 'Another time') },
        { id: 'unknown', label: t('未定', 'Undecided') }, { id: 'done', label: t('納骨済み', 'Already completed') }, { id: 'none', label: t('案内不要', 'No guidance needed') },
      ], t('四十九日に納骨することは必須ではありません。', 'Interment does not have to take place on the 49th day.'))}
      {draft.burial === 'around49' && field('engraving', t('石材店への追加彫刻等が必要ですか？', 'Is additional engraving or stonework needed?'))}
    </>}
    {heading('thanks', t('香典返し・お礼', 'Condolence gifts & thanks'))}
    {section === 'thanks' && field('returnsDone', t('香典返しはすでに済んでいますか？', 'Have condolence gifts and thanks been completed?'), [
      { id: 'yes', label: t('済んでいる', 'Completed') }, { id: 'no', label: t('未対応がある', 'Some remain') },
      { id: 'unknown', label: t('わからない', 'Not sure') }, { id: 'notNeeded', label: t('不要', 'Not needed') },
    ])}
    {heading('messages', t('Tomuraiからの言葉', 'Words from Tomurai'))}
    {section === 'messages' && <Pressable accessibilityRole="switch" accessibilityState={{ checked: draft.showMessages }} aria-checked={draft.showMessages}
      onPress={() => update('showMessages', !draft.showMessages)} style={s.toggle}>
      <Text style={s.label}>{t('節目の言葉を表示する', 'Show milestone messages')}</Text>
      <Text style={s.optionText}>{draft.showMessages ? t('オン', 'On') : t('オフ', 'Off')}</Text>
    </Pressable>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={save} style={s.primary}><Text style={s.primaryText}>{t('この内容を反映する', 'Apply these choices')}</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.optionText}>{t('変更せず戻る', 'Return without changes')}</Text></Pressable>
  </>;
}
const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.light, fontSize: 11, letterSpacing: 1.5, color: c.muted, marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginBottom: 10 },
  copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 25, color: c.muted, marginBottom: 20 },
  field: { marginVertical: 15 }, label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 24, color: c.ink, marginBottom: 8 },
  help: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 22, color: c.muted, marginBottom: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: c.line, borderRadius: 3, justifyContent: 'center' },
  selected: { borderColor: c.green, backgroundColor: c.paperDeep }, optionText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: c.green }, selectedText: { fontFamily: fonts.medium },
  section: { borderBottomWidth: 1, borderColor: c.line, paddingVertical: 16, minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  sectionText: { fontFamily: fonts.medium, fontSize: 15, color: c.ink, lineHeight: 24 },
  toggle: { minHeight: 52, paddingVertical: 14, gap: 8 }, error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 23, color: '#8C3824', marginTop: 16 },
  primary: { minHeight: 52, padding: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: c.green, marginTop: 26, borderRadius: 3 },
  primaryText: { color: c.white, fontFamily: fonts.medium, fontSize: 15, lineHeight: 24 }, close: { alignItems: 'center', padding: 14, minHeight: 48, marginTop: 8 },
});

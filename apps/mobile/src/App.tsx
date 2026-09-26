import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EnsoProgress } from './components/EnsoProgress';
import { Onboarding } from './components/Onboarding';
import { ModalBackground } from './components/ModalBackground';
import { demoTasks, members, type DemoTask } from './data/demo';
import type { Locale } from './data/questions';
import { colors as c, font } from './theme';

type Screen = 'onboarding' | 'home' | 'tasks' | 'specialists' | 'care';
const screens: Screen[] = ['onboarding', 'home', 'tasks', 'specialists', 'care'];
type Filter = 'all' | 'mine' | 'open' | 'done';

export default function App() {
  return <SafeAreaProvider><Tomurai /></SafeAreaProvider>;
}
function Tomurai() {
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [locale, setLocale] = useState<Locale>('ja');
  const [tasks, setTasks] = useState(demoTasks);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [pause, setPause] = useState(false);
  const [mood, setMood] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (!url) return;
      const query = new URL(url).searchParams;
      const initial = query.get('screen');
      if (initial && screens.includes(initial as Screen)) setScreen(initial as Screen);
      if (query.get('lang') === 'en') setLocale('en');
    }).catch(() => {});
  }, []);
  const selected = tasks.find(task => task.id === selectedId);
  const doneCount = tasks.filter(task => task.done).length;
  const name = (id: string | null) => members.find(member => member.id === id)?.name[locale] ?? t('未割当', 'Unassigned');
  const openTask = (task: DemoTask) => { setSelectedId(task.id); setAssignee(task.assignee); };
  const updateTask = (change: Partial<DemoTask>) => {
    setTasks(tasks.map(task => task.id === selectedId ? { ...task, ...change } : task));
  };
  const externalMap = async (query: string) => {
    setLinkError('');
    try { await Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)); }
    catch { setLinkError(t('地図を開けませんでした。通信環境を確認して、もう一度お試しください。', 'Unable to open Maps. Check your connection and try again.')); }
  };
  const renderTask = (task: DemoTask) => <Pressable key={task.id} accessibilityRole="button"
    accessibilityLabel={task.title[locale] + ' · ' + (task.done ? t('完了', 'Done') : t('未完了', 'Open')) + ' · ' + name(task.assignee)}
    style={s.item} onPress={() => openTask(task)}>
    <View style={[s.checkbox, task.done && s.checked]}><Text style={s.checkmark}>{task.done ? '✓' : ''}</Text></View>
    <View style={{ flex: 1 }}><Text style={s.itemMeta}>{task.done ? t('完了', 'Done') : t('期限は未計算・表示サンプル', 'Sample · deadline not calculated')}</Text>
      <Text style={[s.itemTitle, task.done && s.completedText]}>{task.title[locale]}</Text>
      <Text style={s.secondary}>{t('担当：', 'Assigned: ')}{name(task.assignee)}</Text></View>
    <Text style={s.chevron}>›</Text>
  </Pressable>;

  return <SafeAreaView style={s.safe}>
    <View style={s.frame}>
      <ModalBackground hidden={!!selected || pause}>
      <View style={s.header}><Text style={s.brand}>と む ら い</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ja' ? 'Switch to English' : '日本語に切り替える'}
          onPress={() => setLocale(locale === 'ja' ? 'en' : 'ja')} style={s.language}>
          <Text style={s.languageText}>{locale === 'ja' ? 'EN' : '日本語'}</Text></Pressable>
      </View>
      <ScrollView key={screen} style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {screen !== 'onboarding' && <Text style={s.demo}>{t('開発プレビュー · 家族プランのサンプル', 'Development preview · family-plan sample')}</Text>}
        {screen === 'onboarding' && <Onboarding locale={locale} onConfirm={() => setScreen('home')} />}
        {screen === 'home' && <>
          <EnsoProgress completed={doneCount} total={tasks.length} label={t('完了', 'completed')} />
          <Text accessibilityRole="header" style={s.greeting}>{t('今日は、ご自身のペースで。', 'At your own pace, today.')}</Text>
          <Text style={s.centerCopy}>{t('進められることから、ひとつずつ。\n必要なことを、家族と分けながら。', 'One thing at a time.\nShare what needs to be done with your family.')}</Text>
          <Text style={s.section}>{t('今日、進められること', 'Things you can work on')}</Text>
          {tasks.filter(task => !task.done).slice(0, 3).map(renderTask)}
          {doneCount === tasks.length && <Text style={s.empty}>{t('表示サンプルのタスクはすべて完了です。', 'All sample tasks are complete.')}</Text>}
          <Pressable accessibilityRole="button" style={s.warmCard} onPress={() => setPause(true)}>
            <Text style={s.leaf}>◌</Text><View style={{ flex: 1 }}><Text style={s.warmTitle}>{t('少し、間（ま）を置く', 'Take a little space')}</Text>
              <Text style={s.secondary}>{t('手続きから離れる時間も。', 'A moment away from the tasks.')}</Text></View><Text style={s.chevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={s.textButton} onPress={() => setScreen('onboarding')}>
            <Text style={s.link}>{t('オンボーディングを確認する', 'Preview onboarding')}</Text></Pressable>
          <Text style={s.footnote}>{t('回答に基づく抽出・保存・家族同期は未接続です。\nこのプレビューでは実際の期限を判断できません。', 'Filtering by answers, saving and family sync are not connected.\nThis preview does not determine actual deadlines.')}</Text>
        </>}
        {screen === 'tasks' && <>
          <Text style={s.eyebrow}>{t('やることナビ', 'YOUR NEXT STEPS')}</Text>
          <Text accessibilityRole="header" style={s.title}>{t('タスク', 'Tasks')}</Text>
          <Text style={s.copy}>{t('必要なことを、確認しながら。\n担当と進み具合を家族で共有します。', 'Review what needs to be done.\nShare responsibilities and progress with your family.')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {(['all', 'mine', 'open', 'done'] as Filter[]).map((value, i) => <Pressable key={value}
              accessibilityRole="button" accessibilityState={{ selected: filter === value }} aria-pressed={filter === value}
              style={[s.chip, filter === value && s.chipSelected]} onPress={() => setFilter(value)}>
              <Text style={[s.chipText, filter === value && s.chipTextSelected]}>
                {[t('すべて', 'All'), t('自分の担当', 'Mine'), t('未完了', 'Open'), t('完了済み', 'Done')][i]}
              </Text></Pressable>)}
          </ScrollView>
          {tasks.filter(task => filter === 'all' || (filter === 'mine' && task.assignee === 'self') || (filter === 'done' && task.done) || (filter === 'open' && !task.done))
            .map(renderTask)}
          <Text style={s.footnote}>{t('操作はこのプレビュー内のみ。実際の手続きは完了しません。', 'Changes affect only this preview, not any real procedure.')}</Text>
        </>}
        {screen === 'specialists' && <>
          <Text style={s.eyebrow}>{t('相談先を探す', 'FIND SUPPORT')}</Text>
          <Text accessibilityRole="header" style={s.title}>{t('専門家に相談', 'Professional support')}</Text>
          <Text style={s.copy}>{t('確認したい分野から、\nGoogle Mapsで相談先を探せます。', 'Choose a field to search\nfor support in Google Maps.')}</Text>
          {[[t('相続・法律', 'Inheritance & law'), '弁護士 司法書士 相続'], [t('税金のこと', 'Tax questions'), '税理士 相続'], [t('遺品整理', 'Sorting belongings'), '遺品整理']].map(([label, query]) =>
            <Pressable key={query} accessibilityRole="link" accessibilityLabel={label + t('、外部のGoogle Mapsを開く', ', opens Google Maps')}
              onPress={() => externalMap(query!)} style={s.mapRow}>
              <Text style={s.itemTitle}>{label}</Text><Text style={s.link}>↗</Text></Pressable>)}
          {linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
          <View style={s.notice}><Text style={s.warmTitle}>{t('Tomurai提携パートナー', 'Tomurai partners')}</Text>
            <Text style={s.copy}>{t('提携先の地図は準備中です。掲載先・表示の確認が済んでからご案内します。', 'The partner map is being prepared. Listings and disclosure will be reviewed before release.')}</Text></View>
          <Text style={s.footnote}>{t('相談内容や家族の情報を、自動送信することはありません。現在地へのアクセスも行いません。', 'We do not automatically send your questions or family information. This preview does not access your location.')}</Text>
        </>}
        {screen === 'care' && <>
          <Text style={s.eyebrow}>{t('こころのケア', 'SPACE FOR YOURSELF')}</Text>
          <Text accessibilityRole="header" style={s.title}>{t('こころのケア', 'Care for yourself')}</Text>
          <Text style={s.copy}>{t('手続きとは別に、ご自身のための時間を。', 'A little time for yourself, apart from the tasks.')}</Text>
          <View style={s.careQuote}><Text style={s.quote}>{t('今の気持ちに、正解はありません。\n何かを感じても、何も感じなくても。\n今は、そのままで大丈夫です。', 'There is no right way to feel.\nYou may feel something, or nothing at all.\nThere is no need to change that right now.')}</Text></View>
          <Text style={s.copy}>{t('気持ちは、日によって変わることがあります。\n無理に整理しようとせず、今の自分に合った過ごし方を探してみましょう。', 'Feelings can change from day to day.\nYou do not have to make sense of everything. Explore what suits you now.')}</Text>
          <Text style={s.section}>{t('今に近いものがあれば（任意）', 'If one feels close to you (optional)')}</Text>
          <View style={s.moods}>{[t('ぼんやり', 'Numb'), t('怒りがある', 'Angry'), t('少し楽', 'A little lighter'), t('何も感じない', 'Feeling nothing'), t('安心している', 'Relieved')].map(label =>
            <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: mood === label }} aria-pressed={mood === label}
              style={[s.chip, mood === label && s.moodSelected]} onPress={() => setMood(mood === label ? null : label)}>
              <Text style={s.chipText}>{label}</Text></Pressable>)}</View>
          <Text style={s.footnote}>{t('選ばなくても大丈夫です。気持ちの履歴は保存しません。', 'You do not have to choose. No mood history is saved.')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setPause(true)} style={s.warmCard}>
            <Text style={s.warmTitle}>{t('少し、間（ま）を置く', 'Take a little space')}　→</Text></Pressable>
        </>}
      </ScrollView>
      {screen !== 'onboarding' && <View style={s.nav} accessibilityRole="tablist">
        {(['home', 'tasks', 'specialists', 'care'] as Screen[]).map((value, i) => <Pressable key={value}
          accessibilityRole="tab" accessibilityState={{ selected: screen === value }} aria-selected={screen === value} onPress={() => setScreen(value)} style={s.navButton}>
          <Text style={[s.navIcon, screen === value && s.navActive]}>{['○', '☰', '↗', '◌'][i]}</Text>
          <Text style={[s.navText, screen === value && s.navActive]}>{[t('ホーム', 'Home'), t('タスク', 'Tasks'), t('専門家', 'Support'), t('こころのケア', 'Self-care')][i]}</Text>
        </Pressable>)}
      </View>}
      </ModalBackground>
      <Modal visible={!!selected} transparent animationType="none" accessibilityLabel={selected?.title[locale]}
        onRequestClose={() => setSelectedId(null)}>
        <View style={s.modalBackdrop}><View style={s.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={{ padding: 26 }}>
            <Text style={s.eyebrow}>{selected?.category[locale]}</Text>
            <Text accessibilityRole="header" style={s.title}>{selected?.title[locale]}</Text>
            <Text style={s.copy}>{t('これは操作確認用のサンプルです。手続きの適用条件・提出先・期限は、監修済み情報への接続後に表示します。', 'This is an interaction sample. Reviewed eligibility, authority and deadline information will be connected later.')}</Text>
            <Text style={s.section}>{t('担当を割り当てる', 'Assign a family member')}</Text>
            <View style={s.assignment}>{[{ id: null, label: t('未割当', 'Unassigned') }, ...members.map(member => ({ id: member.id, label: member.name[locale] }))].map(member =>
              <Pressable key={member.id ?? 'none'} accessibilityRole="radio" accessibilityState={{ checked: assignee === member.id }} aria-checked={assignee === member.id}
                style={[s.chip, assignee === member.id && s.chipSelected]} onPress={() => setAssignee(member.id)}>
                <Text style={[s.chipText, assignee === member.id && s.chipTextSelected]}>{member.label}</Text></Pressable>)}</View>
            <Pressable accessibilityRole="button" style={s.primary} onPress={() => { updateTask({ assignee }); setSelectedId(null); }}>
              <Text style={s.primaryText}>{t('担当を保存する', 'Save assignment')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={() => { updateTask({ done: !selected?.done }); setSelectedId(null); }}>
              <Text style={s.link}>{selected?.done ? t('未完了に戻す', 'Mark as open') : t('完了にする', 'Mark as done')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={s.textButton} onPress={() => setSelectedId(null)}><Text style={s.secondary}>{t('変更せず閉じる', 'Close without changes')}</Text></Pressable>
          </ScrollView>
        </View></View>
      </Modal>
      <Modal visible={pause} transparent animationType="none" accessibilityLabel={t('少し、間を置く', 'Take a little space')}
        onRequestClose={() => setPause(false)}>
        <View style={s.pause} accessibilityViewIsModal><Text style={s.pauseBrand}>と む ら い</Text>
          <Text accessibilityRole="header" style={s.pauseTitle}>{t('ここで、少し\n間を置いても。', 'A little space,\njust here.')}</Text>
          <Text style={s.pauseCopy}>{t('次に進むタイミングは、ご自身で。\nこの画面はいつでも閉じられます。', 'You can decide when to move on.\nYou can close this screen at any time.')}</Text>
          <Pressable accessibilityRole="button" style={s.pauseButton} onPress={() => setPause(false)}><Text style={s.link}>{t('元の画面に戻る', 'Return to the previous screen')}</Text></Pressable>
        </View>
      </Modal>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#DCD5C4' }, frame: { flex: 1, backgroundColor: c.paper, width: '100%', maxWidth: 430, alignSelf: 'center' },
  header: { borderBottomWidth: 1, borderColor: c.line, minHeight: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 64 },
  brand: { fontFamily: font, fontSize: 14, color: c.greenSoft, letterSpacing: 4 },
  language: { position: 'absolute', right: 12, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  languageText: { color: c.green, fontFamily: font, fontSize: 12 }, scroll: { flex: 1 }, content: { padding: 24, paddingTop: 25, paddingBottom: 34 },
  demo: { fontFamily: font, color: c.muted, fontSize: 11, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  greeting: { fontFamily: font, color: c.ink, fontSize: 22, fontWeight: '600', lineHeight: 36, textAlign: 'center', marginBottom: 13 },
  centerCopy: { fontFamily: font, fontSize: 14, lineHeight: 25, color: c.muted, textAlign: 'center', marginBottom: 15 },
  eyebrow: { fontFamily: font, fontSize: 11, letterSpacing: 1.5, color: c.muted, marginBottom: 9 },
  title: { fontFamily: font, fontSize: 24, fontWeight: '600', color: c.ink, marginBottom: 12, lineHeight: 36 },
  copy: { fontFamily: font, color: c.muted, fontSize: 14, lineHeight: 25, marginBottom: 20 },
  section: { fontFamily: font, color: c.ink, fontSize: 15, fontWeight: '500', borderBottomWidth: 1, borderColor: c.line, paddingBottom: 12, marginTop: 25, marginBottom: 3 },
  item: { flexDirection: 'row', gap: 13, paddingVertical: 18, borderBottomWidth: 1, borderColor: c.line, minHeight: 78 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: c.greenSoft, borderRadius: 3, marginTop: 4, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: c.green }, checkmark: { color: c.white, fontSize: 14 },
  itemMeta: { fontFamily: font, fontSize: 11, color: c.green, marginBottom: 5, lineHeight: 18 },
  itemTitle: { fontFamily: font, fontSize: 15, fontWeight: '500', color: c.ink, lineHeight: 24, marginBottom: 4 },
  completedText: { textDecorationLine: 'line-through', color: c.muted },
  secondary: { fontFamily: font, fontSize: 12, color: c.muted, lineHeight: 21 }, chevron: { fontSize: 22, color: c.greenSoft, alignSelf: 'center' },
  warmCard: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, padding: 18, marginTop: 25, minHeight: 74 },
  warmTitle: { color: c.warm, fontFamily: font, fontSize: 15, fontWeight: '600', lineHeight: 24, marginBottom: 3 },
  leaf: { fontSize: 30, color: c.warm }, link: { fontFamily: font, fontSize: 14, color: c.green, lineHeight: 23 },
  textButton: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  footnote: { fontFamily: font, fontSize: 12, lineHeight: 21, color: c.muted, marginTop: 20, textAlign: 'center' },
  filters: { gap: 8, paddingBottom: 18 }, chip: { borderWidth: 1, borderColor: c.line, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: c.green, borderColor: c.green }, chipText: { fontFamily: font, fontSize: 13, color: c.muted, lineHeight: 20 },
  chipTextSelected: { color: c.white }, assignment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 20 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, paddingVertical: 8, backgroundColor: c.paper },
  navButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, minHeight: 54, gap: 4 },
  navIcon: { fontSize: 22, color: c.muted }, navText: { fontFamily: font, fontSize: 10, color: c.muted }, navActive: { color: c.green, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(35,41,34,.38)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: c.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  primary: { minHeight: 52, backgroundColor: c.green, borderRadius: 3, padding: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: c.white, fontSize: 15, fontFamily: font }, secondaryButton: { borderWidth: 1, borderColor: c.line, minHeight: 52, marginTop: 12, padding: 15, alignItems: 'center', borderRadius: 3 },
  mapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderWidth: 1, borderColor: c.line, marginBottom: 13, gap: 12 },
  notice: { backgroundColor: c.paperDeep, padding: 18, marginTop: 18 }, error: { color: '#8C3824', fontSize: 14 },
  careQuote: { backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, padding: 23, marginVertical: 10, marginBottom: 24 },
  quote: { fontFamily: font, color: c.ink, fontSize: 16, lineHeight: 32, textAlign: 'center' },
  moods: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 18 }, moodSelected: { borderColor: c.warm, backgroundColor: c.warmPaper },
  pause: { flex: 1, backgroundColor: c.warm, justifyContent: 'center', alignItems: 'center', padding: 32 },
  pauseBrand: { fontFamily: font, color: c.white, fontSize: 13, letterSpacing: 4, marginBottom: 35 },
  pauseTitle: { fontFamily: font, color: c.white, fontSize: 28, lineHeight: 47, textAlign: 'center' },
  pauseCopy: { fontFamily: font, color: c.white, fontSize: 14, lineHeight: 26, textAlign: 'center', marginVertical: 25 },
  pauseButton: { backgroundColor: c.paper, padding: 18, minHeight: 52, borderRadius: 3 },
  empty: { color: c.muted, fontFamily: font, lineHeight: 24, paddingVertical: 20 },
});

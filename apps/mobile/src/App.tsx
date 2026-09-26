import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EnsoProgress } from './components/EnsoProgress';
import { Onboarding } from './components/Onboarding';
import { ModalBackground } from './components/ModalBackground';
import { CareScreen } from './components/CareScreen';
import { SpecialistsScreen } from './components/SpecialistsScreen';
import { assigneeInitial, demoTasks, members, type DemoTask } from './data/demo';
import { bundledNotoFonts } from './fonts';
import { googleMapsSearchUrl } from './domain/maps';
import { navigationIcons } from './data/navigation';
import type { Locale } from './data/questions';
import { colors as c, font, fonts } from './theme';

type Screen = 'onboarding' | 'home' | 'tasks' | 'specialists' | 'care';
const screens: Screen[] = ['onboarding', 'home', 'tasks', 'specialists', 'care'];
type Filter = 'all' | 'mine' | 'open' | 'done';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(bundledNotoFonts);
  if (!fontsLoaded) return <SafeAreaProvider><SafeAreaView style={[s.safe, s.loading]}>
    <Text accessibilityRole={fontError ? 'alert' : undefined} style={s.loadingText}>
      {fontError ? '文字を読み込めませんでした。アプリを開き直してください。\nUnable to load fonts. Please reopen the app.' : 'と む ら い\n文字を準備しています…'}
    </Text>
  </SafeAreaView></SafeAreaProvider>;
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
    setTasks(current => current.map(task => task.id === selectedId ? { ...task, ...change } : task));
  };
  const externalMap = async (query: string) => {
    setLinkError('');
    try { await Linking.openURL(googleMapsSearchUrl(query)); }
    catch { setLinkError(t('地図を開けませんでした。通信環境を確認して、もう一度お試しください。', 'Unable to open Maps. Check your connection and try again.')); }
  };
  const renderTask = (task: DemoTask) => <Pressable key={task.id} accessibilityRole="button"
    accessibilityLabel={task.title[locale] + ' · ' + (task.done ? t('完了', 'Done') : t('未完了', 'Open')) + ' · ' + name(task.assignee)}
    style={s.item} onPress={() => openTask(task)}>
    <View style={[s.checkbox, task.done && s.checked]}><Text style={s.checkmark}>{task.done ? '✓' : ''}</Text></View>
    <View style={{ flex: 1 }}><Text style={s.itemMeta}>{task.done ? t('完了', 'Done') : t('期限は未計算・表示サンプル', 'Sample · deadline not calculated')}</Text>
      <Text style={[s.itemTitle, task.done && s.completedText]}>{task.title[locale]}</Text>
      <Text style={s.secondary}>{t('担当：', 'Assigned: ')}{name(task.assignee)}</Text></View>
    {task.assignee && <View style={s.avatar} accessible={false} aria-hidden>
      <Text style={s.avatarText}>{assigneeInitial(task.assignee, locale)}</Text>
    </View>}
  </Pressable>;

  return <SafeAreaView style={s.safe}>
    <View style={s.frame}>
      <ModalBackground hidden={!!selected || pause}>
      <View style={s.header}><Text style={s.brand}>と む ら い</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ja' ? 'Switch to English' : '日本語に切り替える'}
          onPress={() => setLocale(locale === 'ja' ? 'en' : 'ja')} style={s.language}>
          <Text style={s.languageText}>{locale === 'ja' ? 'EN' : '日本語'}</Text></Pressable>
      </View>
      <ScrollView key={screen} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
        {screen === 'specialists' && <SpecialistsScreen locale={locale} onOpenMap={externalMap} error={linkError} />}
        {screen === 'care' && <>
          <CareScreen locale={locale} onPause={() => setPause(true)} onFindSupport={() => externalMap('グリーフケア カウンセリング')} />
          {linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
        </>}
        {screen !== 'onboarding' && <Text style={s.demo}>{t('開発プレビュー · 家族プランのサンプル', 'Development preview · family-plan sample')}</Text>}
      </ScrollView>
      {screen !== 'onboarding' && <View style={s.nav} accessibilityRole="tablist">
        {(['home', 'tasks', 'specialists', 'care'] as Screen[]).map((value, i) => <Pressable key={value}
          accessibilityRole="tab" accessibilityState={{ selected: screen === value }} aria-selected={screen === value} onPress={() => setScreen(value)} style={s.navButton}>
          <Text accessible={false} aria-hidden style={[s.navIcon, screen === value && s.navIconActive]}>{navigationIcons[value as keyof typeof navigationIcons]}</Text>
          <Text style={[s.navText, screen === value && s.navActive]}>{[t('ホーム', 'Home'), t('タスク', 'Tasks'), t('専門家', 'Support'), t('心のケア', 'Self-care')][i]}</Text>
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
              <Pressable key={member.id ?? 'none'} accessibilityRole="radio" accessibilityLabel={member.label} accessibilityState={{ checked: assignee === member.id }} aria-checked={assignee === member.id}
                style={s.assigneeTarget} onPress={() => setAssignee(member.id)}>
                <View style={[s.assigneePill, assignee === member.id && s.assigneeSelected]}>
                  <View style={s.assigneeDot} accessible={false} aria-hidden><Text style={s.assigneeInitial}>{assigneeInitial(member.id, locale)}</Text></View>
                  <Text style={[s.assigneeText, assignee === member.id && s.assigneeTextSelected]}>{member.label}</Text>
                </View></Pressable>)}</View>
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
  loading: { justifyContent: 'center', alignItems: 'center', padding: 24 }, loadingText: { fontSize: 14, lineHeight: 25, textAlign: 'center', color: c.ink },
  safe: { flex: 1, backgroundColor: '#DCD5C4' }, frame: { flex: 1, backgroundColor: c.paper, width: '100%', maxWidth: 430, alignSelf: 'center' },
  header: { borderBottomWidth: 1, borderColor: c.line, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  brand: { fontFamily: font, fontSize: 14, lineHeight: 20, color: c.greenSoft, letterSpacing: 4.2 },
  language: { position: 'absolute', right: 12, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  languageText: { color: c.green, fontFamily: font, fontSize: 12 }, scroll: { flex: 1 }, content: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 34 },
  demo: { fontFamily: font, color: c.muted, fontSize: 11, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  greeting: { fontFamily: fonts.bold, color: c.ink, fontSize: 22, lineHeight: 36, textAlign: 'center', marginBottom: 13 },
  centerCopy: { fontFamily: font, fontSize: 14, lineHeight: 25, color: c.muted, textAlign: 'center', marginBottom: 15 },
  eyebrow: { fontFamily: font, fontSize: 11, lineHeight: 16, letterSpacing: 1.76, color: c.muted, marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: c.ink, marginBottom: 6, lineHeight: 32 },
  copy: { fontFamily: fonts.regular, color: c.muted, fontSize: 14, lineHeight: 25.9, marginBottom: 26 },
  section: { fontFamily: fonts.medium, color: c.ink, fontSize: 14.5, lineHeight: 21, borderBottomWidth: 1, borderColor: c.line, paddingBottom: 10, marginTop: 34, marginBottom: 4 },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderColor: c.line, minHeight: 78 },
  checkbox: { width: 19, height: 19, borderWidth: 1.5, borderColor: c.greenSoft, borderRadius: 3, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
  checked: { backgroundColor: c.green }, checkmark: { color: c.white, fontSize: 14 },
  itemMeta: { fontFamily: font, fontSize: 11, color: c.green, marginBottom: 5, lineHeight: 18 },
  itemTitle: { fontFamily: fonts.medium, fontSize: 15, color: c.ink, lineHeight: 22, marginBottom: 4 },
  avatar: { width: 24, height: 24, flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.paperDeep, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font, fontSize: 9.5, lineHeight: 14, color: c.muted },
  completedText: { textDecorationLine: 'line-through', color: c.muted },
  secondary: { fontFamily: font, fontSize: 12, color: c.muted, lineHeight: 21 }, chevron: { fontSize: 22, color: c.greenSoft, alignSelf: 'center' },
  warmCard: { flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, padding: 18, marginTop: 25, minHeight: 74 },
  warmTitle: { color: c.warm, fontFamily: fonts.medium, fontSize: 15, lineHeight: 24, marginBottom: 3 },
  leaf: { fontSize: 30, color: c.warm }, link: { fontFamily: font, fontSize: 14, color: c.green, lineHeight: 23 },
  textButton: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  footnote: { fontFamily: font, fontSize: 12, lineHeight: 21, color: c.muted, marginTop: 20, textAlign: 'center' },
  filters: { gap: 8, paddingBottom: 18 }, chip: { borderWidth: 1, borderColor: c.line, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: c.green, borderColor: c.green }, chipText: { fontFamily: font, fontSize: 13, color: c.muted, lineHeight: 20 },
  chipTextSelected: { color: c.white }, assignment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 20 },
  assigneeTarget: { minHeight: 44, justifyContent: 'center' },
  assigneePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderWidth: 1, borderColor: c.line, borderRadius: 20 },
  assigneeSelected: { borderColor: c.green, backgroundColor: c.paperDeep },
  assigneeDot: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
  assigneeInitial: { fontFamily: font, fontSize: 9, lineHeight: 13, color: c.muted }, assigneeText: { fontFamily: font, fontSize: 12, lineHeight: 17, color: c.muted }, assigneeTextSelected: { color: c.green },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, paddingVertical: 9, paddingHorizontal: 6, backgroundColor: c.paper },
  navButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4, minHeight: 47, gap: 4 },
  navIcon: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: c.muted, opacity: .5 }, navIconActive: { color: c.green, opacity: 1 },
  navText: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: c.muted }, navActive: { color: c.green },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(35,41,34,.38)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: c.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  primary: { minHeight: 52, backgroundColor: c.green, borderRadius: 3, padding: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: c.white, fontSize: 15, fontFamily: font }, secondaryButton: { borderWidth: 1, borderColor: c.line, minHeight: 52, marginTop: 12, padding: 15, alignItems: 'center', borderRadius: 3 },
  error: { fontFamily: font, color: '#8C3824', fontSize: 14, lineHeight: 24 },
  pause: { flex: 1, backgroundColor: c.warm, justifyContent: 'center', alignItems: 'center', padding: 32 },
  pauseBrand: { fontFamily: font, color: c.white, fontSize: 13, letterSpacing: 4, marginBottom: 35 },
  pauseTitle: { fontFamily: font, color: c.white, fontSize: 28, lineHeight: 47, textAlign: 'center' },
  pauseCopy: { fontFamily: font, color: c.white, fontSize: 14, lineHeight: 26, textAlign: 'center', marginVertical: 25 },
  pauseButton: { backgroundColor: c.paper, padding: 18, minHeight: 52, borderRadius: 3 },
  empty: { color: c.muted, fontFamily: font, lineHeight: 24, paddingVertical: 20 },
});

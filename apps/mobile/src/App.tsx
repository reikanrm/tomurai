import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EnsoProgress } from './components/EnsoProgress';
import { Onboarding } from './components/Onboarding';
import { ModalBackground } from './components/ModalBackground';
import { CareScreen } from './components/CareScreen';
import { SpecialistsScreen } from './components/SpecialistsScreen';
import { GuidanceSettings } from './components/GuidanceSettings';
import { InheritanceNotice } from './components/InheritanceNotice';
import { MilestoneSection } from './components/MilestoneSection';
import { DevelopmentButton, DevelopmentMenu } from './components/DevelopmentMenu';
import { AccessSheet, LockedTasks } from './components/AccessGate';
import { defaultAccess, resolveAccess, canEditAnswers, freezeFreeTaskIds, selectTaskAccess, lockAction, type AccessPreview } from './domain/access';
import { assigneeInitial, members } from './data/demo';
import { defaultPlan, type GuidancePlan, type GuidanceTask, type TaskProgress } from './domain/guidance-model';
import { deriveGuidanceTasks, applyTaskProgress } from './domain/guidance';
import { allGuidanceComplete, planWithCompletion, recordPlanEvents, type EventDates } from './domain/guidance-state';
import { todayInJapan } from './domain/calendar';
import { bundledNotoFonts } from './fonts';
import { googleMapsSearchUrl } from './domain/maps';
import { navigationIcons } from './data/navigation';
import type { Locale } from './data/questions';
import { colors as c, font, fonts } from './theme';

type Screen = 'onboarding' | 'home' | 'tasks' | 'specialists' | 'care' | 'guidance';
const screens: Screen[] = ['onboarding', 'home', 'tasks', 'specialists', 'care', 'guidance'];
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<GuidancePlan>(defaultPlan);
  const [burialBeforeCompletion, setBurialBeforeCompletion] = useState<Exclude<GuidancePlan['burial'], 'done'>>('unknown');
  const [progress, setProgress] = useState<TaskProgress>({});
  const [eventDates, setEventDates] = useState<EventDates>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [today, setToday] = useState(todayInJapan);
  const [answerNotice, setAnswerNotice] = useState(false);
  const [previewAccess, setPreviewAccess] = useState<AccessPreview>(defaultAccess);
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [freeTaskIds, setFreeTaskIds] = useState<readonly string[] | null>(null);
  const access = resolveAccess(previewAccess, __DEV__);
  const canAnswer = canEditAnswers(access);
  const activeMember = access.membership === 'active';
  const tasks = applyTaskProgress(deriveGuidanceTasks(plan), progress).sort((a, b) =>
    (a.scheduledDate ?? a.guidanceDate ?? '9999').localeCompare(b.scheduledDate ?? b.guidanceDate ?? '9999') || a.id.localeCompare(b.id));
  const taskAccess = selectTaskAccess(tasks, access, freeTaskIds ?? freezeFreeTaskIds(tasks, null));
  const visibleTasks = taskAccess.visibleTasks;
  const action = lockAction(access);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [pause, setPause] = useState(false);
  const [linkError, setLinkError] = useState('');
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  useEffect(() => {
    if (activeMember && (screen === 'home' || screen === 'tasks') && freeTaskIds === null) {
      setFreeTaskIds(freezeFreeTaskIds(tasks, null));
    }
  }, [activeMember, screen, freeTaskIds, tasks]);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInJapan()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const allTasksDone = allGuidanceComplete(tasks, plan);
  useEffect(() => {
    if (allTasksDone) setEventDates(current => current['all-tasks'] ? current : { ...current, 'all-tasks': today });
    else setEventDates(current => {
      if (!current['all-tasks']) return current;
      const next = { ...current }; delete next['all-tasks']; return next;
    });
  }, [allTasksDone, today]);
  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (!url) return;
      const query = new URL(url).searchParams;
      const initial = query.get('screen');
      if (initial && screens.includes(initial as Screen)) setScreen(initial as Screen);
      if (query.get('lang') === 'en') setLocale('en');
    }).catch(() => {});
  }, []);
  const selected = visibleTasks.find(task => task.id === selectedId);
  const doneCount = visibleTasks.filter(task => task.done).length;
  const name = (id: string | null) => members.find(member => member.id === id)?.name[locale] ?? t('未割当', 'Unassigned');
  const applyPlan = (next: GuidancePlan) => {
    if (next.burial === 'done' && plan.burial !== 'done') setBurialBeforeCompletion(plan.burial);
    setEventDates(current => recordPlanEvents(plan, next, today, current));
    setPlan(next);
  };
  const openTask = (task: GuidanceTask) => {
    if (!visibleTasks.some(visible => visible.id === task.id)) return;
    setSelectedId(task.id); setAssignee(task.assignee);
  };
  const updateTask = (change: { done?: boolean; assignee?: string | null }) => {
    if (!selected) return;
    if (selected.completionKey && change.done !== undefined) applyPlan(planWithCompletion(plan, selected.completionKey, change.done, burialBeforeCompletion));
    setProgress(current => ({ ...current, [selected.id]: { ...current[selected.id], ...change } }));
  };
  const externalMap = async (query: string) => {
    setLinkError('');
    try { await Linking.openURL(googleMapsSearchUrl(query)); }
    catch { setLinkError(t('地図を開けませんでした。通信環境を確認して、もう一度お試しください。', 'Unable to open Maps. Check your connection and try again.')); }
  };
  const taskDate = (task: GuidanceTask) => task.scheduledDate
    ? t(`予定日 ${task.scheduledDate}`, `Planned ${task.scheduledDate}`)
    : task.guidanceDate ? t(`目安 ${task.guidanceDate}`, `Guide ${task.guidanceDate}`) : t('日付は個別に確認', 'Check timing individually');
  const planLink = canAnswer ? <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={() => setScreen('guidance')}>
    <Text style={s.link}>{t('法要・ご供養の確認', 'Rituals & remembrance')}</Text></Pressable> : null;
  const inheritance = (context: 'overview' | 'belongings' = 'overview') => <InheritanceNotice locale={locale} deathDate={activeMember ? plan.deathDate : ''} today={today}
    consideration={activeMember ? plan.inheritance : 'unknown'} context={context} onConsiderationChange={canAnswer ? value => applyPlan({ ...plan, inheritance: value }) : undefined}
    onFindSupport={() => { setSelectedId(null); void externalMap('相続 弁護士'); }} />;
  const lockedTasks = taskAccess.hasLocked && action ? <LockedTasks locale={locale} action={action} onPress={() => setAccessSheetOpen(true)} /> : null;
  const restrictedScreen = (!activeMember && ['home', 'tasks'].includes(screen)) || (!canAnswer && ['onboarding', 'guidance'].includes(screen));
  const navigate = (next: Screen) => { setSelectedId(null); setAccessSheetOpen(false); setScreen(next); };
  const changePreview = (next: AccessPreview, destination?: Screen) => {
    if (!__DEV__) return;
    setSelectedId(null); setAssignee(null); setPause(false); setAccessSheetOpen(false);
    setPreviewAccess(next); setDevelopmentOpen(false); setFilter('all');
    setPreviewRevision(current => current + 1);
    const target = destination ?? (['onboarding', 'guidance'].includes(screen) ? 'home' : screen);
    setScreen(target);
  };
  const renderTask = (task: GuidanceTask) => <Pressable key={task.id} accessibilityRole="button"
    accessibilityLabel={task.title[locale] + ' · ' + (task.done ? t('完了', 'Done') : t('未完了', 'Open')) + ' · ' + name(task.assignee)}
    style={s.item} onPress={() => openTask(task)}>
    <View style={[s.checkbox, task.done && s.checked]}><Text style={s.checkmark}>{task.done ? '✓' : ''}</Text></View>
    <View style={{ flex: 1 }}><Text style={s.itemMeta}>{task.done ? t('完了', 'Done') : `${taskDate(task)}${task.optional ? t(' · 任意', ' · Optional') : ''}`}</Text>
      <Text style={[s.itemTitle, task.done && s.completedText]}>{task.title[locale]}</Text>
      <Text style={s.secondary}>{t('担当：', 'Assigned: ')}{name(task.assignee)}</Text></View>
    {task.assignee && <View style={s.avatar} accessible={false} aria-hidden>
      <Text style={s.avatarText}>{assigneeInitial(task.assignee, locale)}</Text>
    </View>}
  </Pressable>;

  return <SafeAreaView style={s.safe}>
    <View style={s.frame}>
      <ModalBackground hidden={!!selected || pause || developmentOpen || accessSheetOpen}>
      <View style={s.header}><Text style={s.brand}>と む ら い</Text>
        {__DEV__ && <DevelopmentButton locale={locale} onPress={() => setDevelopmentOpen(true)} />}
        <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ja' ? 'Switch to English' : '日本語に切り替える'}
          onPress={() => setLocale(locale === 'ja' ? 'en' : 'ja')} style={s.language}>
          <Text style={s.languageText}>{locale === 'ja' ? 'EN' : '日本語'}</Text></Pressable>
      </View>
      <ScrollView key={screen} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {restrictedScreen && <>
          <Text style={s.eyebrow}>{t('ご家族と進めるために', 'FOR YOUR FAMILY')}</Text>
          <Text accessibilityRole="header" style={s.title}>{!activeMember ? t('参加の承認をお待ちください', 'Awaiting family approval') : t('回答担当の方が確認します', 'Your respondent manages these answers')}</Text>
          <Text style={s.copy}>{!activeMember ? t('承認後に、共有された手続きを確認できます。心のケアや相談先の検索は、そのままご利用いただけます。', 'Shared tasks become available after approval. Self-care and support search remain available.') : t('質問の回答や変更は、指定されたお一人が行います。共有されたタスクは、家族で分担できます。', 'One designated person manages the answers. You can share work on the available tasks.')}</Text>
          {activeMember && <Pressable accessibilityRole="button" style={s.primary} onPress={() => navigate('tasks')}><Text style={s.primaryText}>{t('タスクを見る', 'View tasks')}</Text></Pressable>}
          <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={() => navigate('care')}><Text style={s.link}>{t('心のケアへ', 'Go to self-care')}</Text></Pressable>
          {inheritance()}
        </>}
        {screen === 'onboarding' && canAnswer && <Onboarding key={previewRevision} locale={locale} initialAnswers={answers} onConfirm={next => {
          if (!canAnswer) return;
          setAnswers(next);
          const deathDate = next.deathDate === 'unknown' ? '' : next.deathDate ?? '';
          const invalidSchedule = !!(deathDate && plan.fortyNineDate && plan.fortyNineDate < deathDate);
          setAnswerNotice(invalidSchedule);
          const nextPlan: GuidancePlan = { ...plan, deathDate, tradition: next.shukyou === 'yes' ? 'buddhist' : next.shukyou === 'other' ? 'other' : 'unknown',
            fortyNineDate: invalidSchedule ? '' : plan.fortyNineDate };
          setFreeTaskIds(current => freezeFreeTaskIds(deriveGuidanceTasks(nextPlan), current));
          applyPlan(nextPlan);
          setScreen('home');
        }} />}
        {screen === 'guidance' && canAnswer && <GuidanceSettings key={previewRevision} locale={locale} plan={plan} onApply={next => { if (canAnswer) { applyPlan(next); setScreen('tasks'); } }} onClose={() => setScreen('home')} />}
        {screen === 'home' && activeMember && <>
          <EnsoProgress completed={doneCount} total={visibleTasks.length} label={taskAccess.fullAccess ? t('完了', 'completed') : t('閲覧できるタスクの完了', 'available tasks completed')} />
          <Text accessibilityRole="header" style={s.greeting}>{t('今日は、ご自身のペースで。', 'At your own pace, today.')}</Text>
          <Text style={s.centerCopy}>{t('進められることから、ひとつずつ。\n必要なことを、家族と分けながら。', 'One thing at a time.\nShare what needs to be done with your family.')}</Text>
          <MilestoneSection locale={locale} context={{ today, plan, eventDates, allTasksDone: taskAccess.fullAccess && allTasksDone, dismissed }}
            onDismiss={id => setDismissed(current => [...new Set([...current, id])])} />
          {plan.rituals === 'unknown' && <Text style={s.secondary}>{t('法要やご供養の状況に合わせて、表示することを選べます。', 'Choose guidance to match your family’s plans.')}</Text>}
          {planLink}
          {answerNotice && <Text accessibilityRole="alert" style={s.secondary}>{t('死亡日の変更に伴い、それより前の法要予定日を未定に戻しました。予定を確認してください。', 'The service date preceded the corrected date of death and has been cleared. Please check your plans.')}</Text>}
          {inheritance()}
          <Text style={s.section}>{t('今日、進められること', 'Things you can work on')}</Text>
          {visibleTasks.filter(task => !task.done).slice(0, 3).map(renderTask)}
          {lockedTasks}
          {visibleTasks.length > 0 && doneCount === visibleTasks.length && <Text style={s.empty}>{t('表示中のタスクに、未完了のものはありません。', 'There are no open tasks in this list.')}</Text>}
          <Pressable accessibilityRole="button" style={s.warmCard} onPress={() => setPause(true)}>
            <Text style={s.leaf}>◌</Text><View style={{ flex: 1 }}><Text style={s.warmTitle}>{t('少し、間（ま）を置く', 'Take a little space')}</Text>
              <Text style={s.secondary}>{t('手続きから離れる時間も。', 'A moment away from the tasks.')}</Text></View><Text style={s.chevron}>›</Text>
          </Pressable>
          {canAnswer && <Pressable accessibilityRole="button" style={s.textButton} onPress={() => setScreen('onboarding')}>
            <Text style={s.link}>{t('回答を確認・変更する', 'Review or change answers')}</Text></Pressable>}
        </>}
        {screen === 'tasks' && activeMember && <>
          <Text style={s.eyebrow}>{t('やることナビ', 'YOUR NEXT STEPS')}</Text>
          <Text accessibilityRole="header" style={s.title}>{t('タスク', 'Tasks')}</Text>
          <Text style={s.copy}>{t('必要なことを、確認しながら。\n担当と進み具合を整理します。', 'Review what needs to be done.\nOrganise responsibilities and progress.')}</Text>
          {planLink}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
            {(['all', 'mine', 'open', 'done'] as Filter[]).map((value, i) => <Pressable key={value}
              accessibilityRole="button" accessibilityState={{ selected: filter === value }} aria-pressed={filter === value}
              style={[s.chip, filter === value && s.chipSelected]} onPress={() => setFilter(value)}>
              <Text style={[s.chipText, filter === value && s.chipTextSelected]}>
                {[t('すべて', 'All'), t('自分の担当', 'Mine'), t('未完了', 'Open'), t('完了済み', 'Done')][i]}
              </Text></Pressable>)}
          </ScrollView>
          {visibleTasks.filter(task => filter === 'all' || (filter === 'mine' && task.assignee === 'self') || (filter === 'done' && task.done) || (filter === 'open' && !task.done))
            .map(renderTask)}
          {lockedTasks}
          {inheritance()}
          <Text style={s.footnote}>{t('アプリで完了にしても、提出・申請などの手続き自体が完了するわけではありません。', 'Marking a task done does not submit or complete the actual procedure.')}</Text>
        </>}
        {screen === 'specialists' && <SpecialistsScreen locale={locale} onOpenMap={externalMap} error={linkError} />}
        {screen === 'care' && <>
          <CareScreen locale={locale} onPause={() => setPause(true)} onFindSupport={() => externalMap('グリーフケア カウンセリング')} />
          {linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
        </>}
        {(screen === 'home' || screen === 'tasks' || screen === 'guidance') && linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
      </ScrollView>
      {screen !== 'onboarding' && <View style={s.nav} accessibilityRole="tablist">
        {(['home', 'tasks', 'specialists', 'care'] as Screen[]).map((value, i) => <Pressable key={value}
          accessibilityRole="tab" accessibilityState={{ selected: screen === value }} aria-selected={screen === value} onPress={() => navigate(value)} style={s.navButton}>
          <Text accessible={false} aria-hidden style={[s.navIcon, screen === value && s.navIconActive]}>{navigationIcons[value as keyof typeof navigationIcons]}</Text>
          <Text style={[s.navText, screen === value && s.navActive]}>{[t('ホーム', 'Home'), t('タスク', 'Tasks'), t('専門家', 'Support'), t('心のケア', 'Self-care')][i]}</Text>
        </Pressable>)}
      </View>}
      </ModalBackground>
      {__DEV__ && developmentOpen && <DevelopmentMenu locale={locale} value={access} onApply={changePreview} onClose={() => setDevelopmentOpen(false)} />}
      {action && <AccessSheet visible={accessSheetOpen} locale={locale} action={action} activeMemberCount={access.activeMemberCount} onClose={() => setAccessSheetOpen(false)} />}
      <Modal visible={!!selected} transparent animationType="none" accessibilityLabel={selected?.title[locale]}
        onRequestClose={() => setSelectedId(null)}>
        <View style={s.modalBackdrop}><View style={s.sheet} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={{ padding: 26 }}>
            <Text style={s.eyebrow}>{selected?.category[locale]}</Text>
            <Text accessibilityRole="header" style={s.title}>{selected?.title[locale]}</Text>
            <Text style={s.copy}>{selected?.description[locale]}</Text>
            {selected && <Text style={s.secondary}>{taskDate(selected)}{selected.guidanceDate && selected.scheduledDate ? t(`（目安：${selected.guidanceDate}）`, ` (guide: ${selected.guidanceDate})`) : ''}</Text>}
            {selected?.optional && <Text style={s.secondary}>{t('ご家庭の状況に合わせて選ぶ任意の候補です。', 'This is an optional suggestion to suit your family.')}</Text>}
            {selected?.group === 'general' && <Text style={s.secondary}>{t('適用条件・提出先・期限は、手続き先へ確認してください。', 'Confirm eligibility, where to apply and deadlines with the relevant authority.')}</Text>}
            {selected?.group === 'belongings' && inheritance('belongings')}
            {canAnswer && selected?.needsConfirmation && selected.group !== 'general' && <Pressable accessibilityRole="button" style={s.textButton} onPress={() => { setSelectedId(null); setScreen('guidance'); }}>
              <Text style={s.link}>{t('状況を確認・変更する', 'Review or change these choices')}</Text></Pressable>}
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

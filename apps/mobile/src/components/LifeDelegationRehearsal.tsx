import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { lifeChapters } from '../data/life-notes';
import {
  beginLifeRehearsal, configureLifeScenario, delegationStatus, lifeRehearsalCommand, projectLifeRehearsal,
  DELEGATION_DURATION_MS, REHEARSAL_NOTE_ID,
  type LifeRehearsalState, type LifeRehearsalCommand, type LifeRehearsalError, type RehearsalFieldId, type DraftSample,
} from '../domain/life-delegation-rehearsal';
import { colors as c, fonts } from '../theme';

const topics = [
  { id: 'future-try' as const, title: lifeChapters.find(chapter => chapter.id === 'future')!.items[0]! },
  { id: 'future-family' as const, title: lifeChapters.find(chapter => chapter.id === 'future')!.items[1]! },
];

/** Fixed examples only. No editable personal information, real identity, persistence or sharing. */
export function LifeDelegationRehearsal({ locale, enabled }: { locale: Locale; enabled: boolean }) {
  const [session, setSession] = useState<LifeRehearsalState | null>(null);
  const [role, setRole] = useState<'parent' | 'employee'>('parent');
  const [selected, setSelected] = useState<RehearsalFieldId[]>([]);
  const [scenarios, setScenarios] = useState(false);
  useEffect(() => { if (!enabled) { setSession(null); setRole('parent'); setSelected([]); setScenarios(false); } }, [enabled]);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const sample = (value: 'initial' | DraftSample) => value === 'initial'
    ? t('まだ決めていません。（確認用の例文）', 'Not decided yet. (Example only)')
    : value === 'a' ? t('例文A：近くの公園を散歩したい。', 'Example A: I would like to walk in a nearby park.')
      : t('例文B：家でゆっくりお茶を飲みたい。', 'Example B: I would like to enjoy tea at home.');
  const button = (id: string, ja: string, en: string, onPress: () => void, primary = false, disabled = false) =>
    <Pressable key={id} testID={id} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{t(ja, en)}</Text></Pressable>;
  const reset = () => { setSession(null); setRole('parent'); setSelected([]); setScenarios(false); };
  if (!enabled) return null;
  if (!session) return <View style={s.section}>
    <Text style={s.eyebrow}>{t('法人向け · 仮データで操作確認', 'CORPORATE · SYNTHETIC REHEARSAL')}</Text>
    <Text accessibilityRole="header" style={s.heading}>{t('入力を頼み、自分で確かめる。', 'Ask for help. Review it yourself.')}</Text>
    <Text style={s.body}>{t('親の承認から下書きの確認まで、この端末だけで試せます。実際の認証・保存・共有は行いません。', 'Try parent approval and draft review on this device. No real sign-in, saving or sharing occurs.')}</Text>
    {button('life-start', '代理入力の流れを試す', 'Try delegated entry', () => setSession(beginLifeRehearsal()), true)}
  </View>;

  const view = projectLifeRehearsal(session, role);
  const status = delegationStatus(session);
  const canApprove = session.parentEligible && session.parentCanApprove;
  const send = (type: LifeRehearsalCommand['type'], extra: Partial<LifeRehearsalCommand> = {}) => {
    // Capture the displayed version, then evaluate against the latest queued state.
    const command: LifeRehearsalCommand = { actor: role, type, noteId: REHEARSAL_NOTE_ID, expectedRevision: session.revision, ...extra };
    setSession(current => current ? lifeRehearsalCommand(current, command) : null);
  };
  const scenario = (patch: Parameters<typeof configureLifeScenario>[1]) =>
    setSession(current => current ? configureLifeScenario(current, patch) : null);
  const errors: Record<LifeRehearsalError, [string, string]> = {
    invalid_request: ['操作の内容を確認してください。', 'Check the selected action.'],
    not_authorized: ['この立場・利用資格では操作できません。', 'This role or eligibility does not permit the action.'],
    revision_conflict: ['状態が更新されました。もう一度内容を確認してください。', 'The state changed. Review it again.'],
    delegation_inactive: ['入力の委任が有効ではありません。親本人の承認が必要です。', 'Delegation is not active. Parent approval is needed.'],
    stale_delegation: ['以前の委任は使えません。現在の承認を確認してください。', 'The previous delegation cannot be used. Check the current approval.'],
    active_delegation: ['有効な委任があります。期間は自動更新しません。', 'A delegation is already active. Its duration does not renew automatically.'],
    approval_unavailable: ['親本人が承認できるまで、開始・確定は保留します。', 'Starting or confirming stays on hold until the parent can approve.'],
    review_required: ['下書きを確認してから確定してください。', 'Review the draft before confirming.'],
    review_changed: ['確認後に下書きが更新されています。改めて内容を確認してください。', 'The draft changed after review. Review the new content before confirming.'],
  };
  const statusLabels = {
    none: t('親本人の承認待ち', 'Awaiting parent approval'), active: t('入力担当に委任中', 'Delegation active'),
    revoked: t('委任を取り消しました', 'Delegation cancelled'), expired: t('30日間の有効期限が切れました', 'The thirty-day delegation expired'),
    eligibility_lost: t('利用資格の喪失により失効しました', 'Delegation ended after eligibility loss'),
  };
  return <View style={s.section} testID="life-rehearsal">
    <View style={s.notice}>
      <Text style={s.label}>{t('この端末だけの操作確認 · 仮データ', 'On-device rehearsal · synthetic data')}</Text>
      <Text style={s.small}>{t('実際の認証・保存・共有は行いません。例文だけを使用し、終了・画面移動・再読み込みで消えます。', 'No real sign-in, saving or sharing. Only fixed examples are used. Ending, leaving or reloading clears the rehearsal.')}</Text>
    </View>
    <Text accessibilityRole="header" style={s.heading}>{t('入力を頼み、自分で確かめる。', 'Ask for help. Review it yourself.')}</Text>
    <View style={s.roles}>
      {(['parent', 'employee'] as const).map(id => <Pressable key={id} testID={`life-role-${id}`} accessibilityRole="radio"
        accessibilityState={{ checked: role === id }} aria-checked={role === id} onPress={() => setRole(id)} style={[s.role, role === id && s.roleSelected]}>
        <Text style={s.buttonText}>{role === id ? '✓ ' : ''}{id === 'parent' ? t('親本人の視点', 'Parent view') : t('社員の視点', 'Employee view')}</Text>
      </Pressable>)}
    </View>
    <Text style={s.small}>{t('視点切替は練習用です。本番は各自のアカウントで操作します。', 'This view switch is only for rehearsal. Real users need their own accounts.')}</Text>
    <Text testID="life-status" accessibilityLiveRegion="polite" style={s.status}>{statusLabels[status]}</Text>
    {session.delegation && <Text style={s.small}>{t('確認用の期限：', 'Simulated expiry: ')}{new Date(session.delegation.expiresAtMs).toISOString().slice(0, 10)} · {t('30日間・自動更新なし', '30 days · no auto-renewal')}</Text>}
    {session.error && <Text testID="life-error" accessibilityRole="alert" style={s.error}>{t(...errors[session.error])}</Text>}

    {role === 'parent' && status !== 'active' && <View style={s.block}>
      <Text accessibilityRole="header" style={s.subheading}>{t('入力をお願いする項目', 'Items to delegate')}</Text>
      <Text style={s.small}>{t('確認用の社員に、選んだ項目の閲覧と下書き入力を許可します。内容の確定・共有は別です。', 'The synthetic employee may read and draft only the selected items. Confirming and sharing are separate.')}</Text>
      {topics.map(topic => <Pressable key={topic.id} testID={`life-select-${topic.id}`} accessibilityRole="checkbox"
        accessibilityState={{ checked: selected.includes(topic.id) }} aria-checked={selected.includes(topic.id)}
        onPress={() => setSelected(current => current.includes(topic.id) ? current.filter(id => id !== topic.id) : [...current, topic.id])} style={s.checkRow}>
        <Text accessible={false} aria-hidden style={s.check}>{selected.includes(topic.id) ? '☑' : '□'}</Text><Text style={[s.body, s.flex]}>{topic.title[locale]}</Text>
      </Pressable>)}
      {button('life-grant', session.delegation ? '社員を入力担当に再承認する' : '社員を入力担当に承認する', session.delegation ? 'Approve the employee again' : 'Approve the employee',
        () => send('grant', { fields: selected }), true, !selected.length || !canApprove || !session.employeeEligible)}
      {(!canApprove || !session.employeeEligible) && <Text style={s.small}>{t('本人の承認と、双方の有効な利用資格が必要です。', 'Parent approval and valid eligibility for both people are required.')}</Text>}
    </View>}

    {role === 'employee' && view.fields.length === 0 && <View style={s.block}>
      <Text style={s.body}>{t('閲覧・入力できる項目はありません。親本人の視点で、項目と入力担当の承認を確認してください。', 'No items are available to read or draft. Check item and operator approval in the parent view.')}</Text>
    </View>}
    {view.fields.map(field => <View key={field.id} testID={`life-field-${field.id}`} style={s.block}>
      <Text accessibilityRole="header" style={s.subheading}>{topics.find(topic => topic.id === field.id)!.title[locale]}</Text>
      <Text style={s.label}>{t('確定内容', 'Confirmed')}</Text><Text style={s.body}>{sample(field.confirmed)}</Text>
      {field.draft && <View style={s.draft}>
        <Text style={s.label}>{t('社員の下書き', 'Employee draft')} · v{field.draft.revision}</Text>
        <Text style={s.body}>{sample(field.draft.sample)}</Text><Text style={s.small}>{t('まだ確定していません。', 'Not confirmed yet.')}</Text>
      </View>}
      {role === 'employee' ? <>
        <Text style={s.small}>{t('例文を選んで下書きに入れます。実際の情報は入力できません。', 'Choose a fixed example for the draft. Real information cannot be entered.')}</Text>
        <View style={s.choices}>{(['a', 'b'] as const).map(value => button(`life-write-${field.id}-${value}`, `例文${value.toUpperCase()}を下書きに入れる`, `Use example ${value.toUpperCase()} as draft`,
          () => send('write', { fieldId: field.id, sample: value, grantId: session.delegation!.id })))}</View>
      </> : field.draft && <View style={s.choices}>
        {button(`life-review-${field.id}`, '下書きの内容を確認する', 'Review draft', () => send('review', { fieldId: field.id }), false, !canApprove)}
        {button(`life-discard-${field.id}`, 'この下書きを削除する', 'Discard this draft', () => send('discard', { fieldId: field.id }))}
      </View>}
    </View>)}
    {view.review && <View testID="life-review-content" style={s.review}>
      <Text accessibilityRole="header" style={s.subheading}>{t('この内容を確定しますか？', 'Confirm this content?')}</Text>
      <Text style={s.label}>{topics.find(topic => topic.id === view.review!.fieldId)!.title[locale]} · v{view.review.draftRevision}</Text>
      <Text style={s.body}>{sample(view.review.sample)}</Text>
      <Text style={s.small}>{t('確定しても家族や勤務先へ自動共有しません。下書きが更新された場合は再確認が必要です。', 'Confirmation does not share with family or your employer. A changed draft must be reviewed again.')}</Text>
      {button('life-confirm', '親本人としてこの内容を確定する', 'Confirm this content as parent', () => send('confirm'), true, !canApprove)}
    </View>}
    {role === 'parent' && status === 'active' && button('life-revoke', '入力の委任を取り消す', 'Cancel delegation', () => send('revoke'))}
    <Text style={s.small}>{t('取消・期限切れでも、下書きは親側に残ります。確定内容は消えません。', 'Cancellation or expiry keeps drafts with the parent and does not delete confirmed content.')}</Text>

    <Pressable testID="life-scenarios" accessibilityRole="button" accessibilityState={{ expanded: scenarios }} aria-expanded={scenarios}
      onPress={() => setScenarios(!scenarios)} style={[s.button, s.scenarioToggle]}><Text style={s.buttonText}>{scenarios ? '− ' : '+ '}{t('期限・利用資格を試す', 'Test expiry and eligibility')}</Text></Pressable>
    {scenarios && <View style={s.scenarios}>
      <Text style={s.small}>{t('以下は確認用の条件変更です。現実の時刻・資格は変更しません。', 'These controls change simulated conditions only, not real time or eligibility.')}</Text>
      {button('life-expire', '30日経過を試す', 'Advance thirty days', () => scenario({ advanceMs: DELEGATION_DURATION_MS }))}
      {button('life-employee-eligibility', session.employeeEligible ? '社員の利用資格を失効させる' : '社員の利用資格を復活させる', session.employeeEligible ? 'Expire employee eligibility' : 'Restore employee eligibility', () => scenario({ employeeEligible: !session.employeeEligible }))}
      {button('life-parent-eligibility', session.parentEligible ? '親の利用資格を失効させる' : '親の利用資格を復活させる', session.parentEligible ? 'Expire parent eligibility' : 'Restore parent eligibility', () => scenario({ parentEligible: !session.parentEligible }))}
      {button('life-parent-approval', session.parentCanApprove ? '親本人が承認できない場合を試す' : '親本人が承認できる状態に戻す', session.parentCanApprove ? 'Test parent unable to approve' : 'Restore parent approval ability', () => scenario({ parentCanApprove: !session.parentCanApprove }))}
      <Text style={s.small}>{t('資格が復活しても委任は再開しません。親本人が項目を確認し、再承認します。', 'Restoring eligibility does not restart delegation. The parent must review the items and approve again.')}</Text>
    </View>}
    {button('life-end', '練習を終了してリセット', 'End and clear rehearsal', reset)}
  </View>;
}

const s = StyleSheet.create({
  section: { marginVertical: 24, paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line },
  eyebrow: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 22, letterSpacing: 1, color: c.muted },
  heading: { fontFamily: fonts.light, fontSize: 22, lineHeight: 36, color: c.ink, marginVertical: 16 },
  subheading: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 28, color: c.ink },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 27, color: c.ink },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 23, color: c.muted },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 23, color: c.muted, marginVertical: 6 },
  notice: { backgroundColor: c.paperDeep, padding: 16, borderLeftWidth: 2, borderColor: c.greenSoft },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  role: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 3, flexGrow: 1, justifyContent: 'center' },
  roleSelected: { borderColor: c.green, backgroundColor: c.paperDeep },
  status: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 27, color: c.green, marginTop: 20 },
  error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 25, color: c.warm, marginTop: 12 },
  block: { borderTopWidth: 1, borderColor: c.line, marginTop: 20, paddingTop: 20, gap: 8 },
  draft: { padding: 14, backgroundColor: c.paperDeep, borderLeftWidth: 2, borderColor: c.greenSoft, marginVertical: 8 },
  review: { borderWidth: 1, borderColor: c.greenSoft, padding: 16, marginTop: 16, gap: 10 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center', marginTop: 8 },
  primary: { backgroundColor: c.green, borderRadius: 3 },
  buttonText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 25, color: c.green },
  primaryText: { color: c.white, textAlign: 'center' }, disabled: { opacity: 0.45 },
  checkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  check: { color: c.green, fontSize: 22 }, flex: { flex: 1 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scenarioToggle: { borderTopWidth: 1, borderColor: c.line, marginTop: 24 }, scenarios: { padding: 12, backgroundColor: c.paperDeep },
});

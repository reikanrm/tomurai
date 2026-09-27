import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Locale } from '../data/questions';
import type { AccessPreview } from '../domain/access';
import { rehearsalLink, REHEARSAL_PASSPHRASE, type InvitationRehearsalState, type RehearsalCommand } from '../domain/invitation-rehearsal';
import { colors as c, font, fonts } from '../theme';
import { AppIcon } from './AppIcon';

type Plan = AccessPreview['entitlement'];
type Props = { locale: Locale; session: InvitationRehearsalState | null; initialPlan: Plan;
  onStart: (plan: Plan) => void; onCommand: (command: RehearsalCommand) => void; onEnd: () => void; onReviewPlan: () => void };

/** Explicit synthetic rehearsal, not the application's identity or family membership. */
export function InvitationRehearsal({ locale, session, initialPlan, onStart, onCommand, onEnd, onReviewPlan }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [recipient, setRecipient] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const button = (ja: string, en: string, press: () => void, primary = false, disabled = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={press}
      style={[s.button, primary && s.primary, disabled && s.disabled]}>
      <Text style={[s.link, primary && s.primaryText]}>{t(ja, en)}</Text>
    </Pressable>;
  const check = (ja: string, en: string, value: boolean, change: (value: boolean) => void) =>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} aria-checked={value}
      onPress={() => change(!value)} style={s.checkboxRow}>
      <View style={[s.checkbox, value && s.checked]}>{value && <AppIcon name="Check" size={17} color={c.white} />}</View>
      <Text style={[s.body, { flex: 1 }]}>{t(ja, en)}</Text>
    </Pressable>;
  if (!session) return <View style={s.section}>
    <AppIcon name="Community" size={30} color={c.green} />
    <Text accessibilityRole="header" style={s.heading}>{t('招待から、参加まで。', 'From invitation to joining.')}</Text>
    <Text style={s.body}>{t('実際の招待は準備中です。先に、この端末だけで一連の操作を試せます。送信・ログイン・家族との共有は行いません。', 'Real invitations are not connected yet. Try the full flow on this device only. Nothing is sent, and no real sign-in or family sharing occurs.')}</Text>
    <Text style={s.label}>{t('操作確認するプラン（実契約は変更しません）', 'Rehearsal plan (does not change your subscription)')}</Text>
    <View style={s.choices}>
      {([['free', '無料', 'Free'], ['b2c_family', '家族', 'Family'], ['b2c_solo', '単独有料', 'Solo'], ['beta', 'β', 'Beta'], ['corporate', '法人', 'Corporate'], ['expired', '失効後', 'Expired']] as const).map(([id, ja, en]) =>
        <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: plan === id }} aria-checked={plan === id}
          onPress={() => setPlan(id)} style={[s.choice, plan === id && s.choiceSelected]}>
          <Text style={s.link}>{plan === id ? '✓ ' : ''}{t(ja, en)}</Text>
        </Pressable>)}
    </View>
    {button('招待の流れを試す', 'Try the invitation flow', () => onStart(plan), true)}
  </View>;

  const record = session.invitation;
  const expired = !!record && Date.now() + session.offsetMs >= record.expiresAtMs && !['accepted', 'revoked'].includes(record.status);
  const terminal = !!record && (expired || ['accepted', 'revoked'].includes(record.status));
  const send = (type: RehearsalCommand['type']) => onCommand({ type, expectedRevision: session.group.revision, signedIn, passphrase });
  const errors: Record<string, [string, string]> = {
    verification_required: ['合言葉が一致しません。受け取った内容を確認してください。', 'The passphrase does not match. Please check it.'],
    not_authorized: ['確認用アカウントでのログイン操作を選んでください。', 'Select the rehearsal sign-in step first.'],
    expired: ['有効期限が過ぎています。招待を作り直してください。', 'This invitation has expired. Create a new one.'],
    revoked: ['この招待は取り消されています。新しい招待が必要です。', 'This invitation was cancelled. A new one is needed.'],
    used: ['この招待は使用済みです。繰り返し参加はできません。', 'This invitation was used and cannot be used again.'],
    plan_change_required: ['家族プランへの変更待ちです。契約者の同意と決済確認が未接続のため、ここでは参加を承認できません。', 'A family plan change is needed. Payer consent and payment verification are not connected, so this request cannot be approved here.'],
    revision_conflict: ['状態が更新されました。表示を確認してから操作してください。', 'The state changed. Review it before trying again.'],
  };
  const error = session.error ? errors[session.error] ?? ['操作できません。現在の招待状態を確認してください。', 'This action is unavailable. Check the invitation status.'] : null;
  const status = expired ? t('期限切れ', 'Expired') : !record ? t('作成前', 'Not created') :
    ({ issued: t('参加申請を待っています', 'Awaiting a request'), pending_approval: t('ご家族の承認待ち', 'Awaiting family approval'),
      accepted: t('参加を承認しました（この端末のみ）', 'Participation approved (this device only)'), revoked: t('取消済み', 'Cancelled') })[record.status];
  return <View style={s.section} testID="invitation-rehearsal">
    <View style={s.notice}>
      <Text style={s.label}>{t('この端末だけの操作確認', 'On-device rehearsal only')}</Text>
      <Text style={s.small}>{t('実際の送信・ログイン・共有は行いません。再読み込み・練習終了で消えます。個人情報は入力しないでください。', 'No real sending, sign-in or sharing. Reloading or ending clears this rehearsal. Do not enter personal information.')}</Text>
    </View>
    <Text accessibilityRole="header" style={s.heading}>{t(recipient ? '招待を受け取る側' : '招待する側', recipient ? 'Recipient’s view' : 'Inviter’s view')}</Text>
    <Text accessibilityLiveRegion="polite" style={s.status}>{status}</Text>
    {error && <Text accessibilityRole="alert" style={s.error}>{t(...error)}</Text>}

    {!recipient ? <>
      {(!record || terminal) && button(record ? '新しい招待を作る' : '招待を作る', record ? 'Create another invitation' : 'Create an invitation', () => send('create'), true)}
      {record?.status === 'issued' && !expired && <View style={s.block}>
        <Text style={s.label}>{t('確認用リンク · 7日間・1人1回', 'Rehearsal link · seven days · one recipient')}</Text>
        <Text style={s.linkValue}>{rehearsalLink(record)}</Text>
        <Text style={s.small}>{t('これは送信・アクセスできない確認用リンクです。', 'This example link cannot be sent or opened.')}</Text>
        {button(showPassphrase ? '合言葉を閉じる' : '別経路で伝える合言葉を確認', showPassphrase ? 'Hide passphrase' : 'View passphrase for a separate channel', () => setShowPassphrase(!showPassphrase))}
        {showPassphrase && <><Text style={s.code}>{REHEARSAL_PASSPHRASE}</Text><Text style={s.small}>{t('本番ではリンクと同じメッセージに含めず、電話など別の方法で伝えます。', 'In the real flow, share this separately, such as by phone, not in the message containing the link.')}</Text></>}
        {button('受け取る側を試す', 'Try the recipient’s view', () => { setRecipient(true); setPassphrase(''); setSignedIn(false); }, true)}
      </View>}
      {record?.status === 'pending_approval' && !expired && <View style={s.block}>
        <Text style={s.label}>{t('確認用の家族から参加申請', 'Request from a rehearsal family member')}</Text>
        <Text style={s.body}>{t('申請しただけでは参加できません。相手を別の方法で確認してから承認します。', 'A request alone does not grant membership. Check who the person is through another channel before approving.')}</Text>
        {check('申請者が招待した相手であることを確認した（練習）', 'I checked this is the intended recipient (rehearsal)', confirmed, setConfirmed)}
        {button('参加を承認する', 'Approve participation', () => { if (confirmed) send('approve'); }, true, !confirmed)}
      </View>}
      {record && !terminal && button('この招待を取り消す', 'Cancel this invitation', () => send('revoke'))}
      {record && !terminal && button('7日経過を試す', 'Test after seven days', () => send('expire'))}
      {session.error === 'plan_change_required' && button('プランの案内を見る', 'View plan information', onReviewPlan)}
      <View style={s.block}>
        <Text style={s.label}>{t('この練習で参加した家族', 'Members added in this rehearsal')}</Text>
        {session.members.length === 0 ? <Text style={s.body}>{t('まだ参加は確定していません。', 'No participation confirmed yet.')}</Text>
          : session.members.map((member, index) => <View key={member} style={s.member}><View style={s.avatar}><AppIcon name="Community" size={20} color={c.green} /></View>
            <Text style={s.body}>{t(`確認用の家族 ${index + 1} · 承認済み`, `Rehearsal family member ${index + 1} · approved`)}</Text></View>)}
        <Text style={s.small}>{t('実際の家族一覧・タスクの担当・ノートの公開先は変わりません。', 'Real family members, task assignments and note sharing remain unchanged.')}</Text>
      </View>
    </> : <>
      {record?.status === 'issued' && !expired && <View style={s.block}>
        <Text style={s.body}>{t('本番ではご自身のアカウントでログインします。この練習では、確認用の家族アカウントを使います。', 'Sign in with your own account in the real flow. This rehearsal uses a synthetic family account.')}</Text>
        {check('確認用アカウントでログインする（練習）', 'Sign in with the rehearsal account', signedIn, setSignedIn)}
        <Text style={s.label}>{t('別の方法で受け取った合言葉', 'Passphrase received separately')}</Text>
        <TextInput accessibilityLabel={t('合言葉（練習）', 'Passphrase (rehearsal)')} value={passphrase} onChangeText={setPassphrase}
          autoCapitalize="none" autoCorrect={false} maxLength={40} style={s.input} placeholder="tomurai-demo" />
        {button('参加を申請する', 'Request participation', () => send('request'), true)}
      </View>}
      {record?.status === 'pending_approval' && !expired && <Text style={s.body}>{t('申請しました（この端末のみ）。承認されるまで、家族の情報は見られません。', 'Request recorded on this device only. Family information is unavailable until approval.')}</Text>}
      {button('招待する側へ戻る', 'Return to the inviter’s view', () => { setRecipient(false); setPassphrase(''); setConfirmed(false); })}
    </>}
    {button('練習を終了してリセット', 'End and clear rehearsal', onEnd)}
  </View>;
}

const s = StyleSheet.create({
  section: { borderTopWidth: 1, borderColor: c.line, paddingVertical: 24 },
  heading: { fontFamily: fonts.light, fontSize: 22, lineHeight: 36, color: c.ink, marginVertical: 18 },
  body: { fontFamily: font, fontSize: 14, lineHeight: 27, color: c.muted },
  small: { fontFamily: font, fontSize: 12, lineHeight: 23, color: c.muted },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 25, color: c.ink, marginTop: 10, marginBottom: 8 },
  notice: { backgroundColor: c.paperDeep, padding: 16, borderLeftWidth: 2, borderColor: c.greenSoft },
  block: { borderTopWidth: 1, borderColor: c.line, paddingVertical: 20, gap: 8 },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center', marginTop: 8 },
  primary: { backgroundColor: c.green, alignItems: 'center', borderRadius: 3 },
  link: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 25, color: c.green },
  primaryText: { color: c.white, textAlign: 'center' }, disabled: { opacity: 0.45 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  choice: { minHeight: 44, padding: 10, borderWidth: 1, borderColor: c.line, borderRadius: 3, justifyContent: 'center' },
  choiceSelected: { borderColor: c.green, backgroundColor: c.paperDeep },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: c.green },
  input: { fontFamily: fonts.regular, fontSize: 16, color: c.ink, minHeight: 50, borderWidth: 1, borderColor: c.greenSoft, borderRadius: 3, padding: 12 },
  code: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 30, color: c.ink },
  linkValue: { fontFamily: font, fontSize: 13, lineHeight: 24, color: c.muted, flexShrink: 1 },
  status: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 26, color: c.green, marginBottom: 14 },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 25, color: c.warm, marginBottom: 16 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
});

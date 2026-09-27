import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import type { AccessPreview } from '../domain/access';
import { colors as c, font, fonts } from '../theme';

/** Local presentation only. AccessPreview cannot authorize invitation commands.
 * No connected API means no link/secret, member list, receipt or success state. */
export function FamilyScreen({ locale, access, onBack, onReviewPlan }: {
  locale: Locale; access: AccessPreview; onBack: () => void; onReviewPlan: () => void;
}) {
  const [preparing, setPreparing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const active = access.membership === 'active';
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  return <View style={s.root}>
    <Text style={s.eyebrow}>{t('FAMILY', 'FAMILY')}</Text>
    <Text accessibilityRole="header" style={s.title}>{t('家族と、分担する。', 'Share tasks with family.')}</Text>
    <Text style={s.copy}>{t('必要な手続きを、一緒に確認していきましょう。\nご家族の人数に上限はありません。', 'Review the tasks ahead together.\nThere is no family member limit.')}</Text>

    {!active ? <View style={s.notice}>
      <Text accessibilityRole="header" style={s.sectionTitle}>{t('参加の承認をお待ちください', 'Please wait for participation approval')}</Text>
      <Text style={s.body}>{t('ログインと合言葉の確認後、既存のご家族1名の承認が必要です。承認前は家族の情報を確認したり、ほかの方を招待したりできません。', 'After sign-in and passphrase verification, an existing family member must approve participation. Family information and invitation actions are unavailable before approval.')}</Text>
      <Text style={s.note}>{t('参加状態を確認する接続は準備中です。この画面で参加申請や承認は行われません。', 'The connection for checking participation is not available yet. This screen does not submit or approve participation.')}</Text>
    </View> : <>
      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t('ご家族を招待する', 'Invite a family member')}</Text>
        <Text style={s.body}>{t('招待リンクと合言葉を受け取った方が、ご自身のアカウントで参加を申請します。既存のご家族が相手を確認してから承認します。', 'The recipient uses the invitation link and passphrase to request participation with their own account. An existing family member checks the person before approving.')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: preparing }} aria-expanded={preparing}
          onPress={() => setPreparing(value => !value)} style={s.primary}>
          <Text style={s.primaryText}>{t('招待の準備をする', 'Prepare an invitation')}</Text>
        </Pressable>
        {preparing && <View style={s.preparation} testID="invitation-preparation">
          <Text style={s.status} accessibilityLiveRegion="polite">{t('招待機能は準備中です。リンクは発行されていません。', 'Invitations are not available yet. No invitation link has been issued.')}</Text>
          <View style={s.step}><Text style={s.number}>01</Text><View style={s.stepContent}>
            <Text style={s.stepTitle}>{t('7日間・1人1回', 'Seven days · one recipient')}</Text>
            <Text style={s.body}>{t('招待リンクは1人の参加にだけ使用できます。期限切れや取消後のリンクは使えません。', 'Each link is for one recipient. Expired or cancelled links cannot be used.')}</Text>
          </View></View>
          <View style={s.step}><Text style={s.number}>02</Text><View style={s.stepContent}>
            <Text style={s.stepTitle}>{t('合言葉は別の方法で', 'Share the passphrase separately')}</Text>
            <Text style={s.body}>{t('リンクと合言葉は同じメッセージで送らず、電話など別の方法で伝えます。', 'Do not send the link and passphrase in one message. Share the passphrase through another channel, such as a call.')}</Text>
          </View></View>
          <View style={s.step}><Text style={s.number}>03</Text><View style={s.stepContent}>
            <Text style={s.stepTitle}>{t('ご本人のログインと、ご家族の承認', 'Their sign-in, then family approval')}</Text>
            <Text style={s.body}>{t('申請しただけでは参加は確定しません。既存のご家族1名が確認して承認します。', 'A request alone does not complete participation. One existing family member must check and approve it.')}</Text>
          </View></View>
          <Text style={s.note}>{t('発行・送信・参加確定はいずれも行っていません。', 'No invitation has been issued or sent, and no participation has been confirmed.')}</Text>
        </View>}
      </View>

      <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t('家族と参加申請', 'Family and participation requests')}</Text>
        <Text style={s.body}>{t('家族一覧・参加申請は、まだ取得できません。', 'Family members and participation requests cannot be loaded yet.')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: reviewing }} aria-expanded={reviewing}
          onPress={() => setReviewing(value => !value)} style={s.secondary}>
          <Text style={s.link}>{t('参加申請を確認する', 'Review participation requests')}</Text>
        </Pressable>
        {reviewing && <Text testID="participation-unavailable" style={s.status} accessibilityLiveRegion="polite">
          {t('申請を取得・承認する機能は準備中です。申請がないという意味ではありません。この画面では誰の参加も承認していません。', 'Loading and approving participation requests is not available yet. This does not mean there are no requests. Nobody has been approved through this screen.')}
        </Text>}
      </View>

      {access.entitlement === 'b2c_solo' && <View style={s.section}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t('2人目からのご利用について', 'When a second member joins')}</Text>
        <Text style={s.body}>{t('招待しただけで料金は変わりません。単独プランからの変更は、契約者が差額・適用日を確認して同意し、家族プランが有効になってから参加を確定します。', 'An invitation alone does not change the price. For a solo plan, participation is confirmed only after the payer agrees to the price difference and effective date and the family plan is active.')}</Text>
        <Pressable accessibilityRole="button" onPress={onReviewPlan} style={s.secondary}>
          <Text style={s.link}>{access.canManageBilling ? t('プランを確認する', 'Review plans') : t('契約者への依頼を確認する', 'Review a request to the payer')}</Text>
        </Pressable>
      </View>}
    </>}

    <View style={s.privacy}>
      <Text style={s.note}>{t('3人目以降の人数追加料金はありません。招待や参加だけで、ノートが自動で公開されることはありません。', 'There are no added member fees from the third person onward. Notes are never shared automatically through an invitation or participation.')}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onBack} style={s.back}>
      <Text style={s.link}>{t('←　ホームへ戻る', '←　Back to home')}</Text>
    </Pressable>
  </View>;
}

const s = StyleSheet.create({
  root: { paddingTop: 10, paddingBottom: 24 },
  eyebrow: { fontFamily: font, fontSize: 11, letterSpacing: 2, color: c.muted, marginBottom: 12 },
  title: { fontFamily: fonts.light, fontSize: 25, lineHeight: 39, color: c.ink, marginBottom: 16 },
  copy: { fontFamily: font, fontSize: 14, lineHeight: 27, color: c.muted, marginBottom: 30 },
  section: { borderTopWidth: 1, borderColor: c.line, paddingVertical: 24 },
  sectionTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 28, color: c.ink, marginBottom: 12 },
  body: { fontFamily: font, fontSize: 13, lineHeight: 25, color: c.muted },
  primary: { minHeight: 50, backgroundColor: c.green, borderRadius: 3, padding: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 24, color: c.white, textAlign: 'center' },
  secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center', marginTop: 10 },
  link: { fontFamily: font, fontSize: 14, lineHeight: 25, color: c.green },
  preparation: { marginTop: 20, paddingTop: 4 },
  status: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 25, color: c.muted, marginVertical: 10 },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderColor: c.line },
  number: { fontFamily: font, fontSize: 12, lineHeight: 25, color: c.greenSoft },
  stepContent: { flex: 1 },
  stepTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 26, color: c.ink, marginBottom: 6 },
  note: { fontFamily: font, fontSize: 12, lineHeight: 24, color: c.muted },
  privacy: { borderTopWidth: 1, borderColor: c.line, paddingTop: 24 },
  notice: { borderLeftWidth: 2, borderLeftColor: c.greenSoft, padding: 18, backgroundColor: c.paperDeep, marginBottom: 24, gap: 12 },
  back: { minHeight: 48, paddingVertical: 12, justifyContent: 'center', marginTop: 20 },
});

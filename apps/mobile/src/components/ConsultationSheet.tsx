import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import type { Partner } from '../domain/partners';
import { beginConsultation, consultationRoute, externalConsultationUrl, initialConsultationState, withdrawConsultationConsent } from '../domain/consultation';
import { colors as c, fonts } from '../theme';

export type ConsultationSheetProps = {
  partner: Partner; locale: Locale; registered: boolean; entitled: boolean; today: string; onClose: () => void;
};

export function ConsultationSheet({ partner, locale, registered, entitled, today, onClose }: ConsultationSheetProps) {
  const context = { partner, today, registered, entitled };
  const route = consultationRoute(context);
  const scope = JSON.stringify([route, partner]);
  const [consentScope, setConsentScope] = useState('');
  const [requestState, setRequestState] = useState(initialConsultationState);
  const [notice, setNotice] = useState<{ scope: string; kind: 'unavailable' | 'link-error' } | null>(null);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  useEffect(() => {
    // Leaving a recipient or registration/entitlement route must not restore an
    // old sending consent if the user later returns to that same recipient.
    setConsentScope('');
    setRequestState(initialConsultationState());
    setNotice(null);
  }, [scope]);
  const confirmed = consentScope === scope;
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const externalUrl = externalConsultationUrl(context);

  const openContact = async () => {
    const url = externalConsultationUrl(context);
    if (!url || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setNotice(null);
    try {
      // This is explicit navigation only. Never append family data or infer a
      // received consultation from a successful operating-system URL handoff.
      await Linking.openURL(url);
    } catch {
      setNotice({ scope, kind: 'link-error' });
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  };
  const confirmRequest = () => {
    if (!confirmed || consultationRoute(context) !== 'request') return;
    // No network request, personal input, real operation ID or future queued
    // submission is created while the receiving service is unavailable.
    setRequestState(beginConsultation(requestState, context, {
      sendConsent: confirmed, operationId: 'local-unconnected', transportAvailable: false,
    }));
    setNotice({ scope, kind: 'unavailable' });
  };

  return <Modal visible transparent animationType="none" onRequestClose={onClose}
    accessibilityLabel={t('専門家への相談', 'Contact a specialist')}>
    <View style={s.backdrop}><View style={s.sheet} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>{t('専門家への相談', 'Contact a specialist')}</Text>
        <Text style={s.label}>{t('相談先', 'Recipient')}</Text>
        <Text style={s.recipient}>{partner.name[locale]}</Text>
        {route === 'unavailable' && <Text accessibilityRole="alert" style={s.body}>
          {t('この相談先は現在ご利用いただけません。掲載状況を確認し、一覧から選び直してください。', 'This contact is not available at present. Please return to the listings and choose again.')}
        </Text>}
        {route === 'registration' && <>
          <Text style={s.body}>{t('相談するにはTomuraiへの登録が必要です。登録しただけで相談内容が送られたり、有料プランに変更されたりすることはありません。', 'A Tomurai account is needed to contact a partner. Registration does not send a consultation or change your plan.')}</Text>
          <Pressable accessibilityRole="button" disabled accessibilityState={{ disabled: true }} style={[s.primary, s.disabled]}>
            <Text style={s.primaryText}>{t('Tomuraiに登録する', 'Register with Tomurai')}</Text>
          </Pressable>
          <Text style={s.note}>{t('登録機能は準備中です。この画面では登録や送信は行いません。', 'Registration is not available yet. This screen does not register you or send a request.')}</Text>
        </>}
        {route === 'external' && externalUrl && <>
          <Text style={s.body}>{t('確認済みの問い合わせ先を開きます。相談は移動先で行います。Tomuraiから家族の情報や相談内容を自動送信することはありません。', 'Open the verified contact page and make your enquiry there. Tomurai does not automatically send family information or consultation details.')}</Text>
          <Text style={s.note}>{new URL(externalUrl).hostname}</Text>
          <Pressable accessibilityRole="link" disabled={opening} accessibilityState={{ disabled: opening, busy: opening }}
            onPress={openContact} style={[s.primary, opening && s.disabled]}>
            <Text style={s.primaryText}>{t('問い合わせ先を開く', 'Open contact page')}</Text>
          </Pressable>
          <Text style={s.note}>{t('外部サイトへの移動は、相談受付の完了ではありません。', 'Opening an external page does not mean a consultation has been received.')}</Text>
        </>}
        {route === 'request' && <>
          <Text style={s.body}>{t('宛先と送信予定の項目を確認してください。登録時の同意とは別に、送信への同意が必要です。', 'Review the recipient and the proposed information. Sending consent is separate from registration consent.')}</Text>
          <View style={s.summary}>
            <Text style={s.label}>{t('送信予定の項目', 'Proposed information')}</Text>
            <Text style={s.body}>{t('選んだ相談先の識別子・受付識別子', 'Selected recipient identifier and request identifier')}</Text>
            <Text style={s.note}>{t('連絡先や相談内容の入力・送信はまだできません。家族の回答・ノート・AI会話は自動添付しません。', 'Contact details and a consultation message cannot be entered or sent yet. Family answers, notes and AI conversations are not automatically attached.')}</Text>
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} aria-checked={confirmed}
            onPress={() => { setConsentScope(confirmed ? '' : scope); setNotice(null); if (confirmed) setRequestState(withdrawConsultationConsent(requestState)); }} style={s.confirm}>
            <Text accessible={false} aria-hidden style={s.check}>{confirmed ? '✓' : '□'}</Text>
            <Text style={s.confirmText}>{t('この宛先に上記の項目を送ることに同意します。', 'I agree to send the above information to this recipient.')}</Text>
          </Pressable>
          <Pressable testID="consultation-confirm" accessibilityRole="button" disabled={!confirmed} accessibilityState={{ disabled: !confirmed }}
            onPress={confirmRequest} style={[s.primary, !confirmed && s.disabled]}>
            <Text style={s.primaryText}>{t('受付状況を確認する', 'Check request availability')}</Text>
          </Pressable>
          <Text style={s.note}>{t('相談受付は準備中です。確認しても送信されず、後から自動送信されることもありません。', 'Consultation requests are not available yet. Confirming does not send or queue anything for later.')}</Text>
        </>}
        {notice?.scope === scope && <Text accessibilityRole="alert" style={s.notice}>
          {notice.kind === 'link-error'
            ? t('問い合わせ先を開けませんでした。接続を確認して、もう一度お試しください。', 'The contact page could not be opened. Check your connection and try again.')
            : t('送信していません。相談受付は準備中です。', 'Nothing has been sent. Consultation requests are not available yet.')}
        </Text>}
        <Pressable accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.closeText}>{t('閉じる', 'Close')}</Text></Pressable>
      </ScrollView>
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(35,41,34,.38)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: c.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  content: { padding: 24, paddingBottom: 32 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginBottom: 24 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 20, color: c.muted, marginBottom: 6 },
  recipient: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 26, color: c.ink, marginBottom: 18 },
  body: { fontFamily: fonts.light, fontSize: 14, lineHeight: 26, color: c.ink, marginBottom: 16 },
  note: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22, color: c.muted, marginVertical: 12 },
  summary: { padding: 16, backgroundColor: c.paperDeep, borderLeftWidth: 3, borderLeftColor: c.greenSoft },
  confirm: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  check: { color: c.green, fontSize: 22, width: 26, textAlign: 'center' },
  confirmText: { flex: 1, fontFamily: fonts.regular, color: c.ink, fontSize: 13, lineHeight: 24 },
  primary: { minHeight: 52, padding: 15, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  primaryText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, color: c.white, textAlign: 'center' },
  disabled: { backgroundColor: c.muted },
  notice: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 24, color: '#8C3824', marginTop: 16 },
  close: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  closeText: { fontFamily: fonts.regular, color: c.green, fontSize: 14, lineHeight: 24 },
});

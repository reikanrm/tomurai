import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { AccessPreview } from '../domain/access';
import type { Locale } from '../data/questions';
import { colors as c, fonts } from '../theme';

export type PreviewScreen = 'onboarding' | 'home' | 'tasks' | 'specialists' | 'care' | 'guidance' | 'family' | 'notifications' | 'life-notes';

export function DevelopmentButton({ locale, onPress }: { locale: Locale; onPress: () => void }) {
  if (!__DEV__) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={locale === 'ja' ? '開発用の権限・プラン設定' : 'Development permissions and plans'}
    onPress={onPress} style={s.entry}>
    <Svg width={21} height={21} viewBox="0 0 24 24" accessible={false} aria-hidden>
      <Path d="M3 6h18M3 12h18M3 18h18" stroke={c.ink} strokeWidth={1.3} />
      <Circle cx={8} cy={6} r={2.3} fill={c.paper} stroke={c.ink} strokeWidth={1.3} />
      <Circle cx={16} cy={12} r={2.3} fill={c.paper} stroke={c.ink} strokeWidth={1.3} />
      <Circle cx={10} cy={18} r={2.3} fill={c.paper} stroke={c.ink} strokeWidth={1.3} />
    </Svg>
  </Pressable>;
}

/** Development-only, ephemeral fixture controls; never an authorization source. */
export function DevelopmentMenu({ locale, value, onApply, onClose }: {
  locale: Locale; value: AccessPreview; onApply: (value: AccessPreview, screen?: PreviewScreen) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [destination, setDestination] = useState<PreviewScreen | undefined>();
  if (!__DEV__) return null;
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const update = (change: Partial<AccessPreview>) => setDraft(current => ({ ...current, ...change }));
  const choices = <T extends string | number | boolean,>(label: string, selected: T, options: Array<[T, string]>, change: (value: T) => void, preset = false) =>
    <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.options}>
      {options.map(([id, text]) => <Pressable key={String(id)} accessibilityRole={preset ? 'button' : 'radio'}
        accessibilityLabel={`${label}：${text}`} accessibilityState={preset ? undefined : { checked: selected === id }} aria-checked={preset ? undefined : selected === id}
        style={[s.option, selected === id && s.selected]} onPress={() => change(id)}>
        <Text style={[s.optionText, selected === id && s.selectedText]}>{text}</Text>
      </Pressable>)}
    </View></View>;
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <View style={s.backdrop}><View style={s.sheet} accessibilityViewIsModal>
      <View style={s.heading}><View style={{ flex: 1 }}><Text style={s.eyebrow}>DEVELOPMENT</Text>
        <Text accessibilityRole="header" style={s.title}>{t('権限・プランを確認', 'Preview access & plans')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('開発設定を閉じる', 'Close development settings')} onPress={onClose} style={s.close}>
          <Text style={s.closeText}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.note}>{t('この端末の表示だけを切り替えます。実際の契約・権限・送信は変更しません。再起動すると戻ります。', 'Changes this local view only, not real subscriptions, permissions or messages. Resets on restart.')}</Text>
        {choices('プリセット / Preset', '', [
          ['payer', t('契約者＋回答担当', 'Payer + respondent')],
          ['family', t('招待された家族', 'Invited family')],
          ['pending', t('参加承認待ち', 'Awaiting approval')],
        ], preset => update(preset === 'payer' ? { membership: 'active', canManageBilling: true, isRespondent: true }
          : preset === 'family' ? { membership: 'active', canManageBilling: false, isRespondent: false, activeMemberCount: 2 }
            : { membership: 'pending', canManageBilling: false, isRespondent: false }), true)}
        {choices(t('プラン', 'Plan'), draft.entitlement, [
          ['free', t('無料', 'Free')], ['beta', 'β'], ['b2c_solo', t('単独', 'Solo')],
          ['b2c_family', t('家族', 'Family')], ['corporate', t('法人支援', 'Corporate')], ['expired', t('失効', 'Expired')],
        ], entitlement => update({ entitlement }))}
        {choices(t('参加状態', 'Membership'), draft.membership, [['active', t('承認済み', 'Approved')], ['pending', t('承認待ち', 'Pending')]], membership => update({ membership }))}
        {choices(t('支払・契約を決める権限', 'Can manage billing'), draft.canManageBilling, [[true, t('あり', 'Yes')], [false, t('なし', 'No')]], canManageBilling => update({ canManageBilling }))}
        {choices(t('質問の回答担当', 'Questionnaire respondent'), draft.isRespondent, [[true, t('担当する', 'Yes')], [false, t('担当しない', 'No')]], isRespondent => update({ isRespondent }))}
        {choices(t('承認済み人数（確認用）', 'Approved members (fixture)'), draft.activeMemberCount, [[1, t('1名', '1')], [2, t('2名以上', '2 or more')]], activeMemberCount => update({ activeMemberCount }))}
        <Text style={s.note}>{t('家族の人数上限はありません。単独プランで複数名を選ぶと、整合しない状態として無料枠で表示します。', 'There is no family size cap. Solo with multiple members falls back to free access.')}</Text>
        {choices(t('開く画面（任意）', 'Open a screen (optional)'), destination ?? '', [
          ['tasks', t('タスク', 'Tasks')], ['home', t('ホーム', 'Home')], ['onboarding', t('質問', 'Questions')],
          ['guidance', t('法要の確認', 'Rituals')], ['care', t('心のケア', 'Self-care')], ['specialists', t('専門家', 'Support')],
          ['family', t('家族管理', 'Family')], ['notifications', t('お知らせ', 'Notifications')], ['life-notes', t('生前ノート', 'Life notes')],
        ], next => setDestination(next as PreviewScreen))}
      </ScrollView>
      <View style={s.footer}><Pressable accessibilityRole="button" onPress={() => onApply(draft, destination)} style={s.apply}>
        <Text style={s.applyText}>{t('この設定で表示する', 'Apply to preview')}</Text></Pressable></View>
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  entry: { position: 'absolute', left: 10, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(35,41,34,.38)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '92%', backgroundColor: c.paper, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  heading: { padding: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line },
  eyebrow: { fontFamily: fonts.regular, fontSize: 10, letterSpacing: 1.6, color: c.muted, lineHeight: 18 },
  title: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 30, color: c.ink },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 27, color: c.muted }, content: { padding: 22, paddingTop: 16 },
  note: { fontFamily: fonts.regular, color: c.muted, fontSize: 12, lineHeight: 21, marginBottom: 10 },
  field: { marginBottom: 20 }, label: { fontFamily: fonts.medium, color: c.ink, fontSize: 13, lineHeight: 22, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: c.line, borderRadius: 5, justifyContent: 'center' },
  selected: { backgroundColor: c.green, borderColor: c.green }, optionText: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, lineHeight: 20 },
  selectedText: { color: c.white }, footer: { padding: 18, paddingBottom: 26, borderTopWidth: 1, borderColor: c.line },
  apply: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: c.green, borderRadius: 4, padding: 14 },
  applyText: { fontFamily: fonts.medium, fontSize: 14, color: c.white, lineHeight: 22 },
});

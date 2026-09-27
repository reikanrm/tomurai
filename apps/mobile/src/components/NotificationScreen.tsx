import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Locale } from '../data/questions';
import type { NotificationItem } from '../domain/notifications';
import { colors as c, fonts } from '../theme';

export type NotificationSourceState = 'unavailable' | 'loaded' | 'error';
export function NotificationButton({ locale, unread, sourceState = 'unavailable', onPress }: {
  locale: Locale; unread: number; sourceState?: NotificationSourceState; onPress: () => void;
}) {
  const countKnown = sourceState === 'loaded' && Number.isSafeInteger(unread) && unread >= 0;
  const label = countKnown ? (locale === 'ja' ? `お知らせ、未読${unread}件` : `Notifications, ${unread} unread`)
    : sourceState === 'unavailable' ? (locale === 'ja' ? 'お知らせ、準備中' : 'Notifications, not available yet')
      : (locale === 'ja' ? 'お知らせ、件数を確認できません' : 'Notifications, count unavailable');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.bell}>
    <Svg width={21} height={21} viewBox="0 0 24 24" accessible={false} aria-hidden>
      <Path d="M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9M10 21h4" fill="none" stroke={c.ink} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>{countKnown && unread > 0 && <View style={s.dot} accessible={false} />}
  </Pressable>;
}
export function NotificationScreen({ locale, userId, items, sourceState = 'unavailable', onRead, onBack }: {
  locale: Locale; userId: string; items: readonly NotificationItem[]; sourceState?: NotificationSourceState;
  onRead: (id: string) => void; onBack: () => void;
}) {
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const own = sourceState === 'loaded' ? items.filter(item => item.ownerId === userId) : [];
  return <View>
    <Text style={s.eyebrow}>NOTIFICATIONS</Text><Text accessibilityRole="header" style={s.title}>{t('お知らせ', 'Notifications')}</Text>
    <Text style={s.copy}>{t('ご自身の担当と期限に合わせて、必要なときだけ。', 'Only when needed, based on your assigned tasks and confirmed deadlines.')}</Text>
    {sourceState !== 'loaded' && <View style={s.empty}><Text style={s.copy} accessibilityLiveRegion="polite">
      {sourceState === 'error'
        ? t('お知らせを読み込めませんでした。お知らせの有無や件数は確認できていません。', 'Notifications could not be loaded. Their availability and count are unknown.')
        : t('お知らせ一覧は準備中です。お知らせの有無や件数は、まだ取得できません。', 'The notification list is not available yet. Notifications and their count cannot be loaded.')}
    </Text></View>}
    {sourceState === 'loaded' && own.length === 0 && <View style={s.empty}><Text style={s.copy}>{t('新しいお知らせはありません。', 'No new notifications.')}</Text></View>}
    {own.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => onRead(item.id)} style={s.row}>
      <Text style={s.date}>{item.date} · {item.read ? t('既読', 'Read') : t('未読', 'Unread')}</Text>
      <Text style={s.copy}>{t('確認できる手続きがあります。', 'There are tasks you can review.')}</Text>
    </Pressable>)}
    <Text style={s.heading}>{t('通知の受け取り', 'Delivery settings')}</Text>
    <Text style={s.copy}>{t('LINE連携と通知設定は準備中です。この画面から実際の通知は送られません。', 'LINE linking and notification settings are being prepared. This screen does not send real notifications.')}</Text>
    <Text style={s.note}>{t('完了率や気持ちを評価して通知することはありません。任意の法要やケアを催促せず、通知は停止できます。通知の既読とLINEでの受信は別に扱います。', 'We do not judge progress or feelings. Optional rituals and self-care are not chased. Delivery can be stopped. Reading here is separate from receiving a LINE message.')}</Text>
    <Pressable accessibilityRole="button" style={s.back} onPress={onBack}><Text style={s.link}>{t('ホームに戻る', 'Back to home')}</Text></Pressable>
  </View>;
}
const s = StyleSheet.create({
  bell: { position: 'absolute', right: 54, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: 9, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: c.green },
  eyebrow: { fontFamily: fonts.light, fontSize: 11, letterSpacing: 1.7, color: c.muted },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginVertical: 10 },
  copy: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 26, color: c.muted },
  empty: { paddingVertical: 30, borderBottomWidth: 1, borderColor: c.line },
  row: { paddingVertical: 18, borderBottomWidth: 1, borderColor: c.line },
  date: { fontFamily: fonts.regular, fontSize: 12, color: c.green, marginBottom: 8 },
  heading: { fontFamily: fonts.medium, fontSize: 15, color: c.ink, marginTop: 30, marginBottom: 12 },
  note: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22, color: c.muted, marginTop: 16 },
  back: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  link: { fontFamily: fonts.regular, fontSize: 14, color: c.green },
});

import { useEffect, useId, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, FeGaussianBlur, Filter, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Locale } from '../data/questions';
import { colors as c, font, fonts } from '../theme';
import { taskRowMetrics as row, publicPreviewTitles, wrapPreviewTitle, rowHeightFromLines } from '../domain/task-row-layout';

type Action = 'checkout' | 'request';
type LockedTasksProps = { locale: Locale; action: Action; onPress: () => void };
type AccessSheetProps = {
  visible: boolean; locale: Locale; action: Action; activeMemberCount: number; onClose: () => void;
};

/** Public task-row preview only: never accept hidden tasks or their count. */
export function LockedTasks({ locale, action, onPress }: LockedTasksProps) {
  const filterId = `locked-tasks-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(0);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const textX = row.checkboxSize + row.rowGap;
  let backgroundHeight = 0;
  const backgroundRows = [...publicPreviewTitles, ...publicPreviewTitles.slice(0, 1)].map((title, index) => {
    const lines = wrapPreviewTitle(title[locale], Math.max(1, width - textX - 4));
    const height = rowHeightFromLines(lines.length);
    const top = backgroundHeight;
    backgroundHeight += height;
    return { index, top, height, lines };
  });
  return <View style={[s.locked, width > 0 && { minHeight: backgroundHeight }]}
    onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      {width > 0 && <Svg width={width} height={backgroundHeight} accessible={false}>
        <Defs><Filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
          <FeGaussianBlur stdDeviation={3} />
        </Filter></Defs>
        <G filter={`url(#${filterId})`} opacity={0.7}>
          {backgroundRows.map(({ index, top, height, lines }) => {
            const metaY = top + row.rowPadding + row.metaFontSize + 2;
            const titleY = top + row.rowPadding + row.metaLineHeight + row.metaGap + row.titleFontSize + 2;
            const assigneeY = top + height - row.rowPadding - row.rowBorderWidth - 5;
            return <G key={index}>
              <Rect x={row.checkboxBorderWidth / 2} y={top + row.rowPadding + row.checkboxTop + row.checkboxBorderWidth / 2}
                width={row.checkboxSize - row.checkboxBorderWidth} height={row.checkboxSize - row.checkboxBorderWidth}
                rx={row.checkboxRadius} fill="none" stroke={c.greenSoft} strokeWidth={row.checkboxBorderWidth} />
              <SvgText x={textX} y={metaY} fontFamily={font} fontSize={row.metaFontSize} fill={c.green}>
                {t('日付は個別に確認', 'Check timing individually')}
              </SvgText>
              {lines.map((line, lineIndex) => <SvgText key={lineIndex} x={textX} y={titleY + lineIndex * row.titleLineHeight}
                fontFamily={fonts.medium} fontSize={row.titleFontSize} fill={c.ink}>{line}</SvgText>)}
              <SvgText x={textX} y={assigneeY} fontFamily={font} fontSize={row.assigneeFontSize} fill={c.muted}>
                {t('担当：未割当', 'Assigned: Unassigned')}
              </SvgText>
              <Line x1={0} x2={width} y1={top + height - 0.5} y2={top + height - 0.5} stroke={c.line} strokeWidth={row.rowBorderWidth} />
            </G>;
          })}
        </G>
      </Svg>}
    </View>
    <View style={s.gateCard}>
      <View style={s.lockMark} accessible={false} aria-hidden>
        <Svg width={23} height={26} viewBox="0 0 24 28" accessible={false}>
          <Path d="M6 12V8a6 6 0 0 1 12 0v4" fill="none" stroke={c.green} strokeWidth={1.4} strokeLinecap="round" />
          <Rect x={3} y={12} width={18} height={13} rx={3} fill="none" stroke={c.green} strokeWidth={1.4} />
          <Path d="M12 17v3" fill="none" stroke={c.green} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      </View>
      <Text accessibilityRole="header" style={s.gateTitle}>{t('この先の手続きも、\nご家族のペースで。', 'Continue together,\nat your family’s pace.')}</Text>
      <Text style={s.gateCopy}>{action === 'checkout'
        ? t('すべての手続きの確認・分担には、\nご利用プランをご確認ください。', 'Review your plan to see and share\nall your family’s tasks.')
        : t('すべての手続きの確認・分担について、\n契約者に相談できます。', 'Ask the person managing your plan\nabout access to all family tasks.')}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={({ pressed }) => [s.primary, pressed && s.pressed, focused && s.focus]}>
        <Text style={s.primaryText}>{action === 'checkout' ? t('プランを確認する', 'Review plans') : t('契約者にリクエスト', 'Request access')}</Text>
      </Pressable>
    </View>
  </View>;
}

/** This sheet explains the next step; it cannot send, charge, or grant access. */
export function AccessSheet({ visible, locale, action, activeMemberCount, onClose }: AccessSheetProps) {
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [focused, setFocused] = useState('');
  const insets = useSafeAreaInsets();
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const family = activeMemberCount >= 2;
  const amount = interval === 'year' ? (family ? '14,208' : '9,408') : (family ? '1,480' : '980');
  const heading = action === 'checkout' ? t('ご利用プラン', 'Your plan') : t('契約者にリクエスト', 'Request access');
  useEffect(() => { setInterval('month'); setFocused(''); }, [visible, action, activeMemberCount]);
  const focusProps = (id: string) => ({ onFocus: () => setFocused(id), onBlur: () => setFocused('') });

  return <Modal visible={visible} transparent animationType="none" accessibilityLabel={heading} onRequestClose={onClose}>
    <View style={s.backdrop}>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={s.sheetHeader}>
          <Text accessibilityRole="header" style={s.sheetTitle}>{heading}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('閉じる', 'Close')} onPress={onClose} {...focusProps('close')}
            style={({ pressed }) => [s.close, pressed && s.pressed, focused === 'close' && s.focus]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
              <Path d="M5 5l14 14M19 5 5 19" fill="none" stroke={c.green} strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
        <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetContent}>
          {action === 'checkout' ? <>
            <Text style={s.copy}>{t('手続きを確認し、ご家族で分担するためのプランです。', 'A plan for reviewing and sharing the tasks ahead.')}</Text>
            <View style={s.planCard}>
              <Text style={s.planName}>{family ? t('家族プラン', 'Family plan') : t('単独プラン', 'Solo plan')}</Text>
              <Text style={s.secondary}>{family
                ? t('承認済みメンバーが2名以上のご家族', 'For families with two or more approved members')
                : t('承認済みメンバーが1名の場合', 'For one approved member')}</Text>
              <View style={s.intervalRow}>{(['month', 'year'] as const).map(value => <Pressable key={value}
                accessibilityRole="radio" accessibilityState={{ checked: interval === value }} aria-checked={interval === value}
                onPress={() => setInterval(value)} {...focusProps(value)}
                style={({ pressed }) => [s.interval, interval === value && s.intervalSelected, pressed && s.pressed, focused === value && s.focus]}>
                <Text style={[s.intervalText, interval === value && s.intervalTextSelected]}>{value === 'month' ? t('月払い', 'Monthly') : t('年払い · 20%OFF', 'Yearly · 20% off')}</Text>
              </Pressable>)}</View>
              <Text style={s.price} accessibilityLiveRegion="polite">¥{amount}<Text style={s.priceUnit}>{interval === 'month' ? t(' / 月', ' / month') : t(' / 年', ' / year')}</Text></Text>
              <Text style={s.secondary}>{t('税込・1家族グループあたり', 'Tax included · per family group')}</Text>
              <View style={s.planRule} />
              <Text style={s.secondary}>{family
                ? t('3人目以降の人数追加料金はありません。ご家族の人数上限もありません。', 'No added member fees from the third person onward. There is no family member limit.')
                : t('2名以上で利用する場合は家族プランになります。招待しただけで請求されることはありません。', 'Two or more members use the family plan. Sending an invitation does not create a charge.')}</Text>
            </View>
            <Text style={s.copy}>{t('お支払いにはStripeを利用する予定です。決済リンクはまだ設定されていないため、現在はお申し込みできません。', 'Payment will be handled through Stripe. The payment link is not set up yet, so you cannot subscribe here now.')}</Text>
            <Pressable accessibilityRole="button" disabled accessibilityState={{ disabled: true }} aria-disabled style={s.unavailable}>
              <Text style={s.unavailableText}>{t('決済の準備中', 'Payment is not available yet')}</Text>
            </Pressable>
            <Text style={s.note}>{t('この画面で料金は発生しません。現在のプランも変わりません。', 'This screen does not charge you or change your current plan.')}</Text>
          </> : <>
            <Text style={s.copy}>{t('すべての手続きを家族で確認・分担できるよう、契約者に依頼する内容を確認できます。', 'Review the request to the person managing your plan for access to all family tasks.')}</Text>
            <View style={s.planCard}>
              <Text style={s.requestLabel}>{t('依頼先', 'To')}</Text>
              <Text style={s.requestValue}>{t('現在の契約者（支払権限を持つ方）', 'The current person authorized to manage payment')}</Text>
              <View style={s.planRule} />
              <Text style={s.requestLabel}>{t('依頼内容', 'Request')}</Text>
              <Text style={s.requestValue}>{t('手続きを家族で分担したいので、ご利用プランを確認してください。', 'Please review our plan so we can share the family’s tasks.')}</Text>
            </View>
            <Text style={s.copy}>{t('リクエストの送信はまだ利用できません。ここに表示した内容は、契約者には送られていません。', 'Request delivery is not available yet. The message shown here has not been sent to the person managing your plan.')}</Text>
            <Pressable accessibilityRole="button" disabled accessibilityState={{ disabled: true }} aria-disabled style={s.unavailable}>
              <Text style={s.unavailableText}>{t('送信の準備中', 'Sending is not available yet')}</Text>
            </Pressable>
            <Text style={s.note}>{t('リクエストだけで料金やプランが変わることはありません。', 'A request alone does not change the plan or create a charge.')}</Text>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  locked: { minHeight: 515, paddingHorizontal: 12, paddingVertical: 103, justifyContent: 'center', overflow: 'hidden' },
  gateCard: { paddingHorizontal: 20, paddingVertical: 24, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, borderRadius: 8, alignItems: 'center' },
  lockMark: { marginBottom: 14 },
  gateTitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 29, color: c.ink, textAlign: 'center', marginBottom: 10 },
  gateCopy: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 23, color: c.muted, textAlign: 'center', marginBottom: 20 },
  primary: { minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.green, borderRadius: 5 },
  primaryText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 23, textAlign: 'center', color: c.white },
  backdrop: { flex: 1, backgroundColor: 'rgba(35,41,34,0.35)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 430, alignSelf: 'center', maxHeight: '90%', backgroundColor: c.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHeader: { paddingLeft: 24, paddingRight: 12, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line, gap: 12 },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 19, lineHeight: 30, color: c.ink, flex: 1 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  copy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 25, color: c.muted, marginBottom: 20 },
  planCard: { backgroundColor: c.white, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 20, marginBottom: 22 },
  planName: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 28, color: c.green, marginBottom: 5 },
  secondary: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 22, color: c.muted },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, marginBottom: 22 },
  interval: { flexGrow: 1, minHeight: 46, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: c.line, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  intervalSelected: { borderColor: c.green, backgroundColor: c.paperDeep },
  intervalText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, color: c.muted },
  intervalTextSelected: { fontFamily: fonts.medium, color: c.green },
  price: { fontFamily: fonts.medium, fontSize: 31, lineHeight: 43, color: c.ink, fontVariant: ['tabular-nums'], marginBottom: 4 },
  priceUnit: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  planRule: { height: 1, backgroundColor: c.line, marginVertical: 17 },
  requestLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 20, color: c.muted, marginBottom: 7 },
  requestValue: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 27, color: c.ink },
  unavailable: { minHeight: 50, borderRadius: 5, backgroundColor: c.paperDeep, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', padding: 12 },
  unavailableText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 23, color: c.muted, textAlign: 'center' },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 22, color: c.muted, marginTop: 12, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  focus: { outlineColor: c.green, outlineWidth: 2, outlineStyle: 'solid' },
});

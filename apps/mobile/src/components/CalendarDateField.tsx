import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { Locale } from '../data/questions';
import { todayInJapan } from '../domain/calendar';
import { dateSelectable, formatCalendarDate, initialMonth, monthCells, monthSelectable, monthStart, monthTitle, shiftMonth } from '../domain/date-picker';
import { colors as c, fonts } from '../theme';

type Props = {
  locale: Locale; label: string; value: string; onChange: (value: string) => void;
  minDate?: string; maxDate?: string; initialOpen?: boolean; clearLabel?: string;
};

/** Display navigation never changes the answer; the parent owns confirmation. */
export function CalendarDateField({ locale, label, value, onChange, minDate, maxDate, initialOpen = false, clearLabel }: Props) {
  const [today, setToday] = useState(todayInJapan);
  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<'calendar' | 'input'>('calendar');
  const [month, setMonth] = useState(() => initialMonth(value, today, minDate, maxDate));
  const [choosingMonth, setChoosingMonth] = useState(false);
  const [year, setYear] = useState(month.slice(0, 4));
  const [focused, setFocused] = useState('');
  const fieldRef = useRef<View>(null);
  const monthRef = useRef<View>(null);
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const selected = dateSelectable(value, minDate, maxDate);
  const weekdays = locale === 'ja' ? ['日', '月', '火', '水', '木', '金', '土'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const cells = monthCells(month);
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const validYear = /^\d{4}$/.test(year);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInJapan()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (dateSelectable(value, minDate, maxDate)) setMonth(monthStart(value)!);
  }, [value, minDate, maxDate]);
  const toggle = () => {
    if (!open) {
      setMonth(initialMonth(value, today, minDate, maxDate));
      setChoosingMonth(false);
    }
    setOpen(!open);
  };
  const changeMode = () => {
    setMode(mode === 'calendar' ? 'input' : 'calendar');
    setChoosingMonth(false);
  };
  const focusProps = (key: string) => ({ onFocus: () => setFocused(key), onBlur: () => setFocused('') });
  const move = (target: string | null) => {
    if (target && monthSelectable(target, minDate, maxDate)) setMonth(target);
  };
  const iconButton = (direction: 'left' | 'right', title: string, disabled: boolean, onPress: () => void) =>
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled}
      accessibilityState={{ disabled }} aria-disabled={disabled} onPress={onPress} {...focusProps(title)}
      style={({ pressed }) => [s.iconButton, disabled && s.disabled, pressed && s.pressed, focused === title && s.focus]}>
      <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
        <Path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke={c.green} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>;
  return <View style={s.root}>
    <Pressable ref={fieldRef} accessibilityRole="button" accessibilityLabel={`${label}：${selected ? formatCalendarDate(value, locale) : t('日付を選ぶ', 'Choose a date')}`}
      accessibilityState={{ expanded: open }} aria-expanded={open} onPress={toggle} {...focusProps('field')}
      style={({ pressed }) => [s.field, open && s.fieldOpen, pressed && s.pressed, focused === 'field' && s.focus]}>
      <View style={s.fieldCopy}>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.value, !selected && s.placeholder]}>{selected ? formatCalendarDate(value, locale) : value || t('日付を選んでください', 'Choose a date')}</Text>
      </View>
      <Svg width={23} height={23} viewBox="0 0 24 24" accessible={false}>
        <Rect x={3} y={5} width={18} height={16} rx={2} fill="none" stroke={c.green} strokeWidth={1.4} />
        <Path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M7 17h2" fill="none" stroke={c.green} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </Pressable>
    {open && <View style={s.panel}>
      {mode === 'calendar' ? <>
        <View style={s.monthBar}>
          {iconButton('left', choosingMonth ? t('前年', 'Previous year') : t('前の月', 'Previous month'), choosingMonth ? !validYear || Number(year) === 0 : !previous || !monthSelectable(previous, minDate, maxDate),
            () => choosingMonth ? setYear(String(Number(year) - 1).padStart(4, '0')) : move(previous))}
          <Pressable ref={monthRef} accessibilityRole="button" accessibilityLabel={t(`${monthTitle(month, locale)}、年と月を変更`, `${monthTitle(month, locale)}, change year and month`)}
            accessibilityState={{ expanded: choosingMonth }} aria-expanded={choosingMonth}
            onPress={() => { setChoosingMonth(!choosingMonth); setYear(month.slice(0, 4)); }} {...focusProps('month')}
            style={[s.monthHeading, focused === 'month' && s.focus]}>
            <Text style={s.monthTitle}>{choosingMonth ? t('年・月を選ぶ', 'Choose year & month') : monthTitle(month, locale)}</Text>
            <Text style={s.monthHint}>{choosingMonth ? t('カレンダーに戻る', 'Back to calendar') : t('タップして年月を変更', 'Change year & month')}</Text>
          </Pressable>
          {iconButton('right', choosingMonth ? t('翌年', 'Next year') : t('次の月', 'Next month'), choosingMonth ? !validYear || Number(year) === 9999 : !next || !monthSelectable(next, minDate, maxDate),
            () => choosingMonth ? setYear(String(Number(year) + 1).padStart(4, '0')) : move(next))}
        </View>
        {choosingMonth ? <>
          <View style={s.yearRow}>
            <Text style={s.label}>{t('西暦', 'Year')}</Text>
            <TextInput accessibilityLabel={t('表示する年（西暦4桁）', 'Display year, four digits')} value={year} onChangeText={setYear}
              style={s.yearInput} inputMode="numeric" maxLength={4} selectTextOnFocus />
          </View>
          {!validYear && <Text accessibilityRole="alert" style={s.error}>{t('西暦を4桁で入力してください。', 'Enter a four-digit year.')}</Text>}
          <View style={s.monthGrid}>{Array.from({ length: 12 }, (_, i) => {
            const target = `${year}-${String(i + 1).padStart(2, '0')}-01`;
            const enabled = validYear && monthSelectable(target, minDate, maxDate);
            const active = target === month;
            const name = locale === 'ja' ? `${i + 1}月` : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i];
            return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${year} ${name}${active ? t('、表示中', ', displayed') : ''}`} disabled={!enabled}
              accessibilityState={{ disabled: !enabled, selected: Platform.OS === 'web' ? undefined : active }} aria-disabled={!enabled} aria-pressed={active}
              onPress={() => { setMonth(target); setChoosingMonth(false); monthRef.current?.focus(); }} {...focusProps(target)}
              style={({ pressed }) => [s.monthCell, active && s.activeMonth, !enabled && s.disabled, pressed && s.pressed, focused === target && s.focus]}>
              <Text style={[s.monthCellText, active && s.activeText]}>{name}</Text>
            </Pressable>;
          })}</View>
        </> : <>
          <View style={s.weekRow}>{weekdays.map((day, i) => <View key={day} style={s.weekCell}>
            <Text style={[s.weekday, i === 0 && s.sunday]}>{day}</Text>
          </View>)}</View>
          {Array.from({ length: cells.length / 7 }, (_, week) => <View key={week} style={s.weekRow}>
            {cells.slice(week * 7, week * 7 + 7).map((date, day) => {
              if (!date) return <View key={`blank-${day}`} style={s.dayCell} />;
              const enabled = dateSelectable(date, minDate, maxDate);
              const active = date === value;
              const isToday = date === today;
              return <Pressable key={date} accessibilityRole="button"
                accessibilityLabel={`${formatCalendarDate(date, locale)}${isToday ? t('、今日', ', today') : ''}${active ? t('、選択中', ', selected') : ''}`}
                accessibilityState={{ selected: Platform.OS === 'web' ? undefined : active, disabled: !enabled }} aria-pressed={active} aria-disabled={!enabled} disabled={!enabled}
                onPress={() => onChange(date)} {...focusProps(date)}
                style={({ pressed }) => [s.dayCell, focused === date && s.focus, pressed && s.pressed]}>
                <View style={[s.dayCircle, isToday && s.today, active && s.activeDay, !enabled && s.disabled]}>
                  <Text style={[s.dayText, day === 0 && s.sunday, active && s.activeText]}>{Number(date.slice(-2))}</Text>
                  {active && <Text style={s.check} accessible={false}>✓</Text>}
                </View>
              </Pressable>;
            })}
          </View>)}
          <View style={s.legend}>
            <View style={s.todayDot} /><Text style={s.legendText}>{t('今日', 'Today')}</Text>
            <Text style={s.selection} accessibilityLiveRegion="polite">{selected ? t('✓ 日付を選択しました', '✓ Date selected') : t('日付をタップして選択', 'Tap a date to select')}</Text>
          </View>
        </>}
      </> : <View style={s.manual}>
        <Text style={s.label}>{t('年-月-日で入力', 'Enter year-month-day')}</Text>
        <TextInput accessibilityLabel={t(`${label}、年-月-日`, `${label}, year-month-day`)} value={value}
          onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted} style={s.input}
          autoCorrect={false} autoCapitalize="none" maxLength={10} />
        <Text style={s.monthHint}>{t('例：2026-09-01', 'For example: 2026-09-01')}</Text>
      </View>}
      <View style={s.toolbar}>
        <Pressable accessibilityRole="button" onPress={changeMode} {...focusProps('mode')} style={[s.textButton, focused === 'mode' && s.focus]}>
          <Text style={s.link}>{mode === 'calendar' ? t('日付を入力', 'Type a date') : t('カレンダーで選ぶ', 'Use calendar')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMonth(initialMonth('', today, minDate, maxDate)); setMode('calendar'); setChoosingMonth(false); }}
          {...focusProps('current')} style={[s.textButton, focused === 'current' && s.focus]}>
          <Text style={s.link}>{t('今月へ', 'This month')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setOpen(false); fieldRef.current?.focus(); }} {...focusProps('close')} style={[s.textButton, focused === 'close' && s.focus]}>
          <Text style={s.link}>{t('閉じる', 'Close')}</Text>
        </Pressable>
      </View>
    </View>}
    {clearLabel && !!value && <Pressable accessibilityRole="button" onPress={() => { onChange(''); fieldRef.current?.focus(); }} style={s.clear}>
      <Text style={s.link}>{clearLabel}</Text>
    </Pressable>}
  </View>;
}

const s = StyleSheet.create({
  root: { marginBottom: 16 },
  field: { minHeight: 82, paddingHorizontal: 18, paddingVertical: 14, borderWidth: 1, borderColor: c.line, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.white },
  fieldOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderColor: c.greenSoft },
  fieldCopy: { flex: 1, gap: 6 }, label: { fontFamily: fonts.regular, color: c.muted, fontSize: 12, lineHeight: 21 },
  value: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 28, color: c.ink }, placeholder: { fontFamily: fonts.regular, fontSize: 16, color: c.muted },
  panel: { borderWidth: 1, borderTopWidth: 0, borderColor: c.greenSoft, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: c.white, paddingHorizontal: 8, paddingTop: 8 },
  monthBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingTop: 4 },
  iconButton: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  monthHeading: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 4 },
  monthTitle: { fontFamily: fonts.medium, fontSize: 21, lineHeight: 30, color: c.ink, letterSpacing: 1, textAlign: 'center' },
  monthHint: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 19, color: c.muted, marginTop: 3 },
  weekRow: { flexDirection: 'row' }, weekCell: { flex: 1, alignItems: 'center', paddingBottom: 10 },
  weekday: { fontFamily: fonts.regular, color: c.muted, fontSize: 11, lineHeight: 20 }, sunday: { color: c.warm },
  dayCell: { flex: 1, minHeight: 48, paddingVertical: 4, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  dayCircle: { width: '96%', maxWidth: 40, minHeight: 40, paddingVertical: 7, borderRadius: 22, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, color: c.ink, fontVariant: ['tabular-nums'] },
  today: { borderColor: c.greenSoft }, activeDay: { backgroundColor: c.green, borderColor: c.green }, activeText: { color: c.white, fontFamily: fonts.medium },
  check: { position: 'absolute', top: -5, right: -2, fontFamily: fonts.medium, fontSize: 9, lineHeight: 14, width: 14, textAlign: 'center', borderRadius: 7, backgroundColor: c.paperDeep, color: c.green },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 10 },
  todayDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: c.greenSoft },
  legendText: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 20, color: c.muted },
  selection: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 20, color: c.green, flex: 1, textAlign: 'right' },
  toolbar: { borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  textButton: { minHeight: 46, paddingHorizontal: 9, paddingVertical: 12, justifyContent: 'center', borderRadius: 4 },
  link: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, color: c.green }, clear: { minHeight: 44, paddingVertical: 10, alignSelf: 'flex-start' },
  manual: { paddingHorizontal: 10, paddingVertical: 14 }, input: { borderBottomWidth: 1, borderColor: c.greenSoft, fontFamily: fonts.regular, fontSize: 19, color: c.ink, paddingVertical: 12, minHeight: 52 },
  yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 15, marginBottom: 12 },
  yearInput: { minWidth: 90, minHeight: 48, borderBottomWidth: 1, borderColor: c.greenSoft, color: c.ink, fontFamily: fonts.medium, fontSize: 22, textAlign: 'center', padding: 6 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 }, monthCell: { width: '25%', minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  monthCellText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, color: c.ink }, activeMonth: { backgroundColor: c.green },
  pressed: { backgroundColor: c.paperDeep }, disabled: { opacity: 0.28 }, focus: { outlineColor: c.green, outlineWidth: 2, outlineStyle: 'solid' },
  error: { color: '#8C3824', fontFamily: fonts.regular, fontSize: 12, lineHeight: 21, paddingVertical: 8 },
});

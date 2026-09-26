import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { allTasksMilestoneNote, selectMilestone, type MilestoneContext } from '../domain/milestones';
import { colors as c, fonts } from '../theme';

export function MilestoneSection({ locale, context, onDismiss }: {
  locale: Locale;
  context: MilestoneContext;
  onDismiss: (id: string) => void;
}) {
  const milestone = selectMilestone(context);
  if (!milestone) return null;
  return <View style={s.card}>
    <View style={s.heading}>
      <Text style={s.brand}>{locale === 'ja' ? 'Tomuraiからの言葉' : 'A word from Tomurai'}</Text>
      <Pressable accessibilityRole="button"
        accessibilityLabel={locale === 'ja' ? 'この言葉を閉じる' : 'Dismiss this message'}
        onPress={() => onDismiss(milestone.id)} style={s.close}>
        <Text accessible={false} aria-hidden style={s.closeIcon}>×</Text>
      </Pressable>
    </View>
    <Text accessibilityRole="header" style={s.title}>{milestone.title[locale]}</Text>
    <Text style={s.body}>{milestone.body[locale]}</Text>
    {milestone.id === 'all-tasks' && <Text style={s.note}>{allTasksMilestoneNote[locale]}</Text>}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: c.warmPaper, borderWidth: 1, borderColor: c.warmLine, borderRadius: 3, paddingHorizontal: 22, paddingVertical: 20, marginTop: 26 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  brand: { flex: 1, fontFamily: fonts.medium, color: c.warm, fontSize: 11, lineHeight: 16, letterSpacing: 1.1 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12, marginTop: -12, marginBottom: -8 },
  closeIcon: { fontFamily: fonts.light, color: c.muted, fontSize: 24, lineHeight: 32 },
  title: { fontFamily: fonts.medium, color: c.ink, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  body: { fontFamily: fonts.light, color: c.ink, fontSize: 14, lineHeight: 28 },
  note: { fontFamily: fonts.light, color: c.muted, fontSize: 11, lineHeight: 20, marginTop: 14 },
});

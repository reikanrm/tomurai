import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { colors as c, fonts } from '../theme';

// Same visual card anatomy as the PO mock. These are search categories, not
// fabricated professionals, recommendations, partnerships or request forms.
const categories = [
  { id: 'law', icon: '⚖️', role: ['相続・法律', 'INHERITANCE & LAW'], title: ['弁護士・司法書士', 'Lawyers & judicial scriveners'],
    tag: ['相続の相談 / Google Maps', 'Inheritance support / Google Maps'], query: '弁護士 司法書士 相続',
    copy: ['相続に関する確認や手続きについて、相談先を探せます。', 'Find someone to discuss inheritance questions and procedures.'],
    hint: ['対応分野・相談料・受付方法は、各窓口に確認してください。', 'Check each office’s services, fees and booking arrangements.'] },
  { id: 'tax', icon: '🧾', role: ['税金のこと', 'TAX QUESTIONS'], title: ['税理士', 'Tax accountants'],
    tag: ['相続税の相談 / Google Maps', 'Inheritance tax / Google Maps'], query: '税理士 相続',
    copy: ['税金についてわからないことがあるとき、相談先を探せます。', 'Find support for questions about tax.'],
    hint: ['申告の要否や個別の期限は、この画面では判断しません。専門家へご確認ください。', 'This screen does not determine filing obligations or individual deadlines. Ask a professional.'] },
  { id: 'care', icon: '🕊', role: ['こころのケア', 'GRIEF SUPPORT'], title: ['グリーフカウンセラー', 'Grief counsellors'],
    tag: ['死別後の相談 / Google Maps', 'Bereavement support / Google Maps'], query: 'グリーフケア カウンセリング',
    copy: ['話したくなったときに、相談先を探せます。今すぐ決める必要はありません。', 'Find someone to talk to when you want. You do not need to decide now.'],
    hint: ['資格・対応言語・相談料などを、ご自身に合うか確認してください。', 'Check qualifications, languages and fees to find what suits you.'] },
  { id: 'belongings', icon: '📦', role: ['遺品整理', 'SORTING BELONGINGS'], title: ['遺品整理の相談先', 'Help with belongings'],
    tag: ['片付け・整理 / Google Maps', 'Sorting & clearing / Google Maps'], query: '遺品整理',
    copy: ['片付けを進める前に、対応内容を確認できる窓口を探せます。', 'Find a service and check what it offers before arranging any work.'],
    hint: ['見積もり・作業内容を確認してください。相続放棄を検討する場合、売却・処分の前に専門家へ確認しましょう。', 'Check the quote and scope of work. If considering renunciation, seek professional advice before selling or disposing of property.'] },
];

export function SpecialistsScreen({ locale, onOpenMap, error }: {
  locale: Locale; onOpenMap: (query: string) => void; error: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const language = locale === 'ja' ? 0 : 1;
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  return <View>
    <Text style={s.eyebrow}>{t('専門家マッチング', 'PROFESSIONAL SUPPORT')}</Text>
    <Text accessibilityRole="header" style={s.title}>{t('専門家', 'Specialists')}</Text>
    <Text style={s.subtitle}>{t('相談したい分野から、Google Mapsで相談先を探せます。', 'Choose a field to find support in Google Maps.')}</Text>
    {categories.map(category => <View key={category.id} style={s.card}>
      <View style={s.top}><View style={s.avatar}><Text accessible={false} aria-hidden style={s.icon}>{category.icon}</Text></View>
        <View style={{ flex: 1 }}><Text style={s.role}>{category.role[language]}</Text>
          <Text style={s.name}>{category.title[language]}</Text><Text style={s.tag}>{category.tag[language]}</Text></View></View>
      <View style={s.match}><Text style={s.matchText}>{category.copy[language]}</Text></View>
      <View style={s.actions}>
        <Pressable accessibilityRole="link" accessibilityLabel={category.title[language] + t('、Google Mapsで探す', ', search Google Maps')}
          style={s.button} onPress={() => onOpenMap(category.query)}><Text style={s.buttonText}>{t('近くで探す', 'Find nearby')}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === category.id }} aria-expanded={expanded === category.id}
          style={[s.button, s.ghost]} onPress={() => setExpanded(expanded === category.id ? null : category.id)}>
          <Text style={[s.buttonText, s.ghostText]}>{t('相談の目安', 'Before contacting')}</Text></Pressable>
      </View>
      {expanded === category.id && <Text style={s.hint}>{category.hint[language]}</Text>}
    </View>)}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <Text style={s.footnote}>{t('相談内容や家族の情報は自動送信しません。現在地へのアクセスも行いません。', 'Your questions and family information are not automatically sent. This preview does not access your location.')}</Text>
    <Text style={s.footnote}>{t('Tomurai提携パートナーの地図は準備中です。上のカードは相談分野で、提携事業者の一覧ではありません。', 'The Tomurai partner map is being prepared. These cards are search categories, not partner listings.')}</Text>
  </View>;
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.light, fontSize: 11, lineHeight: 16, letterSpacing: 1.76, color: c.muted, marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: c.ink, marginBottom: 6 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, lineHeight: 25.9, marginBottom: 26 },
  card: { borderWidth: 1, borderColor: c.line, borderRadius: 3, padding: 20, marginBottom: 14 },
  top: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  avatar: { width: 42, height: 42, borderRadius: 3, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
  icon: { fontFamily: fonts.light, fontSize: 18, lineHeight: 26 },
  role: { fontFamily: fonts.light, fontSize: 10.5, lineHeight: 15, letterSpacing: .84, color: c.green, marginBottom: 3 },
  name: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: c.ink, marginBottom: 3 },
  tag: { fontFamily: fonts.light, fontSize: 11.5, lineHeight: 17, color: c.muted },
  match: { backgroundColor: c.paperDeep, borderLeftWidth: 3, borderLeftColor: c.greenSoft, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  matchText: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22.2, color: c.muted },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minHeight: 44, backgroundColor: c.green, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.regular, color: c.white, fontSize: 12.5, lineHeight: 18, letterSpacing: .75, textAlign: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.line }, ghostText: { color: c.muted },
  hint: { fontFamily: fonts.light, fontSize: 12, lineHeight: 22.2, color: c.muted, marginTop: 14 },
  footnote: { fontFamily: fonts.light, fontSize: 11.5, lineHeight: 21, color: c.muted, marginTop: 14 },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 24, color: '#8C3824' },
});

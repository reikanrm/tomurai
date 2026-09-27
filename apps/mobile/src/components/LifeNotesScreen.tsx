import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { lifeChapters } from '../data/life-notes';
import { colors as c, fonts } from '../theme';

export function LifeNotesScreen({locale, eligible, onBack, rehearsal}:{locale:Locale;eligible:boolean;onBack:()=>void;rehearsal?:ReactNode}) {
  const [expanded,setExpanded] = useState<string|null>(null);
  const t=(ja:string,en:string)=>locale==='ja'?ja:en;
  return <View>
    <Text style={s.eyebrow}>TOMURAI BEFORE</Text><Text accessibilityRole="header" style={s.title}>{t('わたしのノート','My notes')}</Text>
    {!eligible ? <Text style={s.copy}>{t('生前の準備は、法人の福利厚生を通じてご利用いただく機能です。','Preparation during life is available through corporate benefits.')}</Text>:<>
      <Text style={s.copy}>{t('大切なことを、今のうちに少しずつ。気になる章から確認できます。','Consider what matters, a little at a time. Start with any chapter.')}</Text>
      <View style={s.notice}><Text style={s.copy}>{t('ノートの保存・共有は準備中です。現在は項目を確認できます。個人情報やパスワードは入力しないでください。','Saving and sharing are being prepared. You can review the topics now. Do not enter personal information or passwords.')}</Text></View>
      {lifeChapters.map((chapter,index)=><View key={chapter.id}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded:expanded===chapter.id}} aria-expanded={expanded===chapter.id}
          onPress={()=>setExpanded(expanded===chapter.id?null:chapter.id)} style={s.chapter}>
          <Text style={s.chapterTitle}>{index+1}｜{chapter.title[locale]}</Text><Text accessible={false} aria-hidden style={s.more}>{expanded===chapter.id?'−':'+'}</Text>
        </Pressable>
        {expanded===chapter.id && chapter.items.map(entry=><View key={entry.ja} style={s.row}><Text style={s.copy}>{entry[locale]}</Text><Text style={s.meta}>{t('入力・保存の準備中','Entry and storage pending')}</Text></View>)}
      </View>)}
      <Text accessibilityRole="header" style={s.heading}>{t('大切な人とつなぐ','Sharing with people close to you')}</Text>
      <Text style={s.copy}>{t('初期状態は自分だけ。共有する項目と相手は、ご自身で選びます。勤務先には内容を共有しません。死亡の届け出だけでノートが公開されることはありません。','Private by default. You choose the items and recipients. Your employer cannot read the contents. A death report alone does not release your notes.')}</Text>
      <Pressable disabled accessibilityRole="button" accessibilityState={{disabled:true}} style={s.disabled}><Text style={s.copy}>{t('共有設定の準備中','Sharing settings pending')}</Text></Pressable>
    </>}
    {rehearsal}
    <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.link}>{t('ホームに戻る','Back to home')}</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({
  eyebrow:{fontFamily:fonts.light,fontSize:11,color:c.muted,letterSpacing:1.7},title:{fontFamily:fonts.bold,fontSize:22,lineHeight:34,color:c.ink,marginVertical:12},
  copy:{fontFamily:fonts.regular,fontSize:14,lineHeight:26,color:c.muted},notice:{padding:16,backgroundColor:c.paperDeep,marginVertical:24,borderLeftWidth:2,borderColor:c.greenSoft},
  chapter:{minHeight:60,paddingVertical:16,borderBottomWidth:1,borderColor:c.line,flexDirection:'row',gap:8,alignItems:'center'},
  chapterTitle:{fontFamily:fonts.medium,fontSize:15,lineHeight:25,color:c.ink,flex:1},more:{fontSize:18,color:c.green},row:{padding:14,borderBottomWidth:1,borderColor:c.line},
  meta:{fontFamily:fonts.light,fontSize:11,lineHeight:20,color:c.muted,marginTop:5},heading:{fontFamily:fonts.medium,fontSize:16,color:c.ink,marginTop:30,marginBottom:12},
  disabled:{padding:16,minHeight:48,alignItems:'center',backgroundColor:c.paperDeep,marginTop:16},back:{padding:16,minHeight:48,alignItems:'center',marginTop:24},link:{fontFamily:fonts.regular,fontSize:14,color:c.green},
});

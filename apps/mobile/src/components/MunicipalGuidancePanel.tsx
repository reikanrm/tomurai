import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { approvedMunicipalGuidance, municipalDirectories, selectMunicipalGuidance } from '../domain/municipal-guidance';
import { colors as c, fonts } from '../theme';

export function MunicipalGuidancePanel({locale, taskId, today}: {locale:Locale; taskId:string; today:string}) {
  const [municipalityId, setMunicipality] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const t = (ja:string,en:string) => locale === 'ja' ? ja : en;
  const directory = municipalDirectories.find(item => item.id === municipalityId);
  const guidance = selectMunicipalGuidance({municipalityId,taskId,locale,jurisdictionConfirmed:confirmed,today},approvedMunicipalGuidance);
  const open = async () => {
    setError('');
    if (!directory) return;
    try { await Linking.openURL(guidance?.officialUrl ?? directory.url); }
    catch { setError(t('公式ページを開けませんでした。通信環境をご確認ください。','Could not open the official page. Check your connection.')); }
  };
  return <View style={s.box}>
    <Text accessibilityRole="header" style={s.heading}>{t('自治体の案内', 'Municipal guidance')}</Text>
    <Text style={s.copy}>{t('この手続きの窓口となる自治体を確認してください。現在地やご家族の住所だけでは決まりません。', 'Check which municipality handles this procedure. Your current location or family address alone does not establish jurisdiction.')}</Text>
    <Text style={s.note}>{t('公式入口を確認済みの自治体から選べます。その他の地域・自治体別の詳細案内は準備中です。', 'Select an available official directory. Other areas and reviewed procedure details are being prepared.')}</Text>
    {[{id:'',label:{ja:'未確認・その他の自治体',en:'Not sure / another municipality'}},...municipalDirectories].map(item => <Pressable key={item.id}
      accessibilityRole="radio" accessibilityState={{checked:item.id===municipalityId}} aria-checked={item.id===municipalityId}
      style={[s.option,item.id===municipalityId && s.chosen]} onPress={() => {setMunicipality(item.id);setConfirmed(false);setError('');}}>
      <Text style={s.link}>{item.label[locale]}</Text></Pressable>)}
    {directory && <>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} aria-checked={confirmed} style={s.option} onPress={() => setConfirmed(value=>!value)}>
        <Text style={s.copy}>{confirmed?'☑':'□'} {t('この手続きの管轄を確認しました','I have checked jurisdiction for this procedure')}</Text>
      </Pressable>
      <Text style={s.copy}>{guidance?.body ?? t('自治体別の詳細案内は確認中です。公式の総合案内で該当する手続き・窓口をご確認ください。','Reviewed municipal details are pending. Check the relevant procedure and office in the official directory.')}</Text>
      <Pressable accessibilityRole="link" style={s.option} onPress={() => void open()}><Text style={s.link}>{t('公式案内を開く', 'Open official guidance')} ↗</Text></Pressable>
      <Text style={s.note}>{t('出典URL確認：','Source URL checked: ')}{guidance?.checkedOn ?? directory.checkedOn}{guidance ? ` · ${guidance.version}` : t('（詳細の監修完了ではありません）',' (not a procedure review approval)')}</Text>
    </>}
    {error ? <Text accessibilityRole="alert" style={s.copy}>{error}</Text>:null}
  </View>;
}
const s = StyleSheet.create({
  box:{borderTopWidth:1,borderColor:c.line,paddingTop:18,marginTop:18},heading:{fontFamily:fonts.medium,fontSize:15,color:c.ink,marginBottom:10},
  copy:{fontFamily:fonts.regular,fontSize:13,lineHeight:23,color:c.muted},note:{fontFamily:fonts.light,fontSize:11.5,lineHeight:21,color:c.muted,marginVertical:10},
  option:{minHeight:44,padding:12,borderWidth:1,borderColor:c.line,marginTop:8,borderRadius:3,justifyContent:'center'},
  chosen:{backgroundColor:c.paperDeep,borderColor:c.greenSoft},link:{fontFamily:fonts.regular,fontSize:13,color:c.green,lineHeight:23},
});

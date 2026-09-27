import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { approvedMunicipalGuidance, municipalDirectories, municipalDistricts, municipalDistrictIndexUrl,
  selectMunicipalGuidance, normalizeMunicipalJurisdiction, changeMunicipalJurisdiction,
  type MunicipalJurisdiction, type MunicipalJurisdictionChange } from '../domain/municipal-guidance';
import { colors as c, fonts } from '../theme';

export function MunicipalGuidancePanel({locale, taskId, today, value, onApply}: {
  locale:Locale; taskId:string; today:string; value:MunicipalJurisdiction; onApply:(value:MunicipalJurisdiction)=>void;
}) {
  // App keys this editor by task. Unapplied changes disappear when the modal closes.
  const [draft, setDraft] = useState(() => normalizeMunicipalJurisdiction(value));
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState(false);
  const requestVersion=useRef(0);
  useEffect(()=>()=>{requestVersion.current++;},[]);
  const t = (ja:string,en:string) => locale === 'ja' ? ja : en;
  const directory = municipalDirectories.find(item => item.id === draft.municipalityId);
  const districts=municipalDistricts.filter(item=>item.municipalityId===draft.municipalityId);
  const guidance = selectMunicipalGuidance({...draft,taskId,locale,today},approvedMunicipalGuidance);
  const change=(action:MunicipalJurisdictionChange)=>{
    requestVersion.current++;setError(false);setApplied(false);
    setDraft(current=>changeMunicipalJurisdiction(current,action));
  };
  const open = async (url:string) => {
    const version=++requestVersion.current;setError(false);
    try { await Linking.openURL(url); }
    catch { if(requestVersion.current===version)setError(true); }
  };
  return <View style={s.box}>
    <Text accessibilityRole="header" style={s.heading}>{t('自治体の案内', 'Municipal guidance')}</Text>
    <Text style={s.copy}>{t('この手続きの窓口となる自治体を確認してください。現在地やご家族の住所だけでは決まりません。', 'Check which municipality handles this procedure. Your current location or family address alone does not establish jurisdiction.')}</Text>
    <Text style={s.note}>{t('公式入口を確認済みの自治体から選べます。その他の地域・自治体別の詳細案内は準備中です。', 'Select an available official directory. Other areas and reviewed procedure details are being prepared.')}</Text>
    {[{id:'',label:{ja:'未確認・その他の自治体',en:'Not sure / another municipality'}},...municipalDirectories].map(item => <Pressable key={item.id}
      accessibilityRole="radio" accessibilityState={{checked:item.id===draft.municipalityId}} aria-checked={item.id===draft.municipalityId}
      style={[s.option,item.id===draft.municipalityId && s.chosen]} onPress={() => change({type:'municipality',value:item.id})}>
      <Text style={s.link}>{item.id===draft.municipalityId?'✓ ':''}{item.label[locale]}</Text></Pressable>)}
    {directory?.requiresDistrict && <>
      <Text accessibilityRole="header" style={[s.heading,s.subheading]}>{t('窓口となる区', 'Ward handling this procedure')}</Text>
      <View style={s.districts}>
        {[{id:'',label:{ja:'区は未確認',en:'Ward not confirmed'}},...districts].map(item=><Pressable key={item.id}
          accessibilityRole="radio" accessibilityState={{checked:item.id===(draft.districtId??'')}} aria-checked={item.id===(draft.districtId??'')}
          style={[s.option,s.district,item.id===(draft.districtId??'')&&s.chosen]} onPress={()=>change({type:'district',value:item.id})}>
          <Text style={s.link}>{item.id===(draft.districtId??'')?'✓ ':''}{item.label[locale]}</Text></Pressable>)}
      </View>
      <Pressable accessibilityRole="link" style={s.option} onPress={()=>void open(municipalDistrictIndexUrl)}>
        <Text style={s.link}>{t('公式の区役所一覧を開く','Open the official ward directory')} ↗</Text>
      </Pressable>
    </>}
    {directory && <>
      <Pressable accessibilityRole="checkbox" accessibilityState={{checked:draft.jurisdictionConfirmed}} aria-checked={draft.jurisdictionConfirmed}
        style={s.option} onPress={() => change({type:'confirm-municipality',value:!draft.jurisdictionConfirmed})}>
        <Text style={s.copy}>{draft.jurisdictionConfirmed?'☑':'□'} {t('この手続きの管轄自治体を確認しました','I have checked the municipality for this procedure')}</Text>
      </Pressable>
      {directory.requiresDistrict && draft.districtId && <Pressable accessibilityRole="checkbox"
        accessibilityState={{checked:draft.districtJurisdictionConfirmed,disabled:!draft.jurisdictionConfirmed}} aria-checked={draft.districtJurisdictionConfirmed}
        disabled={!draft.jurisdictionConfirmed} style={[s.option,!draft.jurisdictionConfirmed&&s.disabled]}
        onPress={()=>change({type:'confirm-district',value:!draft.districtJurisdictionConfirmed})}>
        <Text style={s.copy}>{draft.districtJurisdictionConfirmed?'☑':'□'} {t('この手続きの管轄区も確認しました','I have also checked the ward for this procedure')}</Text>
      </Pressable>}
    </>}
    <Pressable accessibilityRole="button" style={[s.option,s.apply]} onPress={()=>{onApply(normalizeMunicipalJurisdiction(draft));setApplied(true);}}>
      <Text style={s.link}>{t('この手続きに適用','Apply to this procedure')}</Text>
    </Pressable>
    {applied&&<Text accessibilityLiveRegion="polite" style={s.note}>{t('この手続きの選択に反映しました。','Applied to this procedure.')}</Text>}
    <Text style={s.note}>{t('適用した選択は、この起動中だけ保持します。再起動や回答の再確定で解除されます。家族への同期はまだ行いません。','Applied choices last only while this app is open. Restarting or reconfirming answers clears them. They are not yet synced with family.')}</Text>
    {directory && <>
      <Text style={s.copy}>{guidance?.body ?? t('自治体別の詳細案内は確認中です。公式の総合案内で該当する手続き・窓口をご確認ください。','Reviewed municipal details are pending. Check the relevant procedure and office in the official directory.')}</Text>
      <Pressable accessibilityRole="link" style={s.option} onPress={() => void open(guidance?.officialUrl ?? directory.url)}><Text style={s.link}>{t('公式案内を開く', 'Open official guidance')} ↗</Text></Pressable>
      <Text style={s.note}>{t('出典URL確認：','Source URL checked: ')}{guidance?.checkedOn ?? directory.checkedOn}{guidance ? ` · ${guidance.version}` : t('（詳細の監修完了ではありません）',' (not a procedure review approval)')}</Text>
    </>}
    {error ? <Text accessibilityRole="alert" style={s.copy}>{t('公式ページを開けませんでした。通信環境をご確認のうえ、もう一度お試しください。','Could not open the official page. Check your connection and try again.')}</Text>:null}
  </View>;
}
const s = StyleSheet.create({
  box:{borderTopWidth:1,borderColor:c.line,paddingTop:18,marginTop:18},heading:{fontFamily:fonts.medium,fontSize:15,color:c.ink,marginBottom:10},
  copy:{fontFamily:fonts.regular,fontSize:13,lineHeight:23,color:c.muted},note:{fontFamily:fonts.light,fontSize:11.5,lineHeight:21,color:c.muted,marginVertical:10},
  option:{minHeight:44,padding:12,borderWidth:1,borderColor:c.line,marginTop:8,borderRadius:3,justifyContent:'center'},
  chosen:{backgroundColor:c.paperDeep,borderColor:c.greenSoft},link:{fontFamily:fonts.regular,fontSize:13,color:c.green,lineHeight:23},
  subheading:{marginTop:20},districts:{flexDirection:'row',flexWrap:'wrap',gap:8},district:{flexBasis:100,flexGrow:1,marginTop:0},
  apply:{borderColor:c.greenSoft,marginTop:18},disabled:{opacity:0.5},
});

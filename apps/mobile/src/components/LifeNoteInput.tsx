import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Locale } from '../data/questions';
import { lifeField, type LifeValue } from '../data/life-note-fields';
import { colors as c, fonts } from '../theme';

/** Shared, controlled editor. It cannot save, grant access or upload files. */
export function LifeNoteInput({id,value,onChange,locale,disabled=false}:{id:string;value:LifeValue;onChange:(value:LifeValue)=>void;locale:Locale;disabled?:boolean}) {
  const def=lifeField(id);if(!def||def.kind==='blocked')return null;
  const t=(ja:string,en:string)=>locale==='ja'?ja:en;
  if(def.kind==='text'||def.kind==='short') {
    const text=typeof value==='string'?value:'', max=def.kind==='short'?200:2000;
    return <View><TextInput testID="notes-input" accessibilityLabel={t('ノートの内容','Note content')} multiline={def.kind==='text'} maxLength={max} value={text} onChangeText={onChange}
      editable={!disabled} style={[s.input,def.kind==='text'&&s.long]} placeholder={t('ここに記入する','Write here')} placeholderTextColor={c.muted} textAlignVertical="top" autoCorrect={false}/>
      <Text style={s.count}>{text.length} / {max}</Text></View>;
  }
  const rows:Array<Record<string,string>>=Array.isArray(value)?value:typeof value==='object'?[value]:[{}];
  const update=(i:number,key:string,next:string)=>{const changed=rows.map((row,n)=>n===i?{...row,[key]:next}:{...row});onChange(def.kind==='rows'?changed:changed[0]!);};
  return <View>
    {rows.map((row,i)=><View key={i} style={[s.record,def.kind==='rows'&&s.card]}>
      {def.kind==='rows'&&<Text style={s.label}>{t('記録','Entry')} {i+1}</Text>}
      {def.columns!.map(col=><View key={col.id} style={s.column}>
        <Text style={s.label}>{col.label[locale]}</Text>
        {col.options?<View style={s.choices}>
          {[{id:'',label:{ja:'未選択',en:'Not selected'}},...col.options].map(option=><Pressable key={option.id} testID={`notes-choice-${col.id}-${option.id||'empty'}-${i}`}
            accessibilityRole="radio" accessibilityLabel={`${i+1} ${col.label[locale]}：${option.label[locale]}`} accessibilityState={{checked:(row[col.id]??'')===option.id,disabled}} aria-checked={(row[col.id]??'')===option.id}
            disabled={disabled} onPress={()=>update(i,col.id,option.id)} style={[s.choice,(row[col.id]??'')===option.id&&s.selected,disabled&&s.disabled]}>
            <Text style={s.choiceText}>{(row[col.id]??'')===option.id?'✓ ':''}{option.label[locale]}</Text>
          </Pressable>)}
        </View>:<>
          <TextInput testID={`notes-input-${col.id}-${i}`} accessibilityLabel={`${i+1} ${col.label[locale]}`} value={row[col.id]??''} editable={!disabled}
            maxLength={col.maxLength??200} multiline={(col.maxLength??200)>200} onChangeText={text=>update(i,col.id,text)} style={s.input} autoCorrect={false}/>
          <Text style={s.count}>{(row[col.id]??'').length} / {col.maxLength??200}</Text>
        </>}
      </View>)}
      {def.kind==='rows'&&<Pressable testID={`notes-remove-row-${i}`} accessibilityRole="button" accessibilityLabel={t(`記録${i+1}を入力から外す`,`Remove entry ${i+1} from this edit`)} disabled={disabled}
        onPress={()=>onChange(rows.length===1?[{}]:rows.filter((_,n)=>n!==i))} style={s.action}><Text style={s.choiceText}>{t('この行を外す','Remove this row')}</Text></Pressable>}
    </View>)}
    {def.kind==='rows'&&<>
      <Pressable testID="notes-add-row" accessibilityRole="button" accessibilityState={{disabled:disabled||rows.length>=50}} disabled={disabled||rows.length>=50}
        onPress={()=>onChange([...rows,{}])} style={[s.action,(disabled||rows.length>=50)&&s.disabled]}><Text style={s.choiceText}>{t('＋ 行を追加','＋ Add a row')}</Text></Pressable>
      <Text style={s.count}>{rows.length} / 50 {t('行（家族の参加人数とは別です）','rows (not a family membership limit)')}</Text>
    </>}
  </View>;
}
const s=StyleSheet.create({
  input:{fontFamily:fonts.regular,fontSize:16,lineHeight:28,color:c.ink,borderWidth:1,borderColor:c.line,borderRadius:6,minHeight:48,padding:12,backgroundColor:c.white},
  long:{minHeight:180,marginTop:16},count:{fontFamily:fonts.regular,fontSize:11,lineHeight:21,color:c.muted,textAlign:'right',marginTop:4},
  record:{gap:16,marginTop:20},card:{padding:14,backgroundColor:c.paperDeep,borderRadius:8},column:{gap:8},label:{fontFamily:fonts.medium,fontSize:12,lineHeight:23,color:c.muted},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:48,justifyContent:'center',padding:10,borderRadius:6,borderWidth:1,borderColor:c.line},
  selected:{borderColor:c.green,backgroundColor:c.greenSoft},choiceText:{fontFamily:fonts.regular,fontSize:13,lineHeight:24,color:c.green},action:{minHeight:48,padding:10,justifyContent:'center'},disabled:{opacity:.45},
});

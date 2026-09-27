import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Locale } from '../data/questions';
import { lifeChapters } from '../data/life-notes';
import { type LifeEntry, type LifeProjection, type LifeTextField } from '../domain/life-notes-service';
import { lifeFields, lifeField, cloneLifeValue, editableLifeValue, formatLifeValue, normalizeLifeValue, type LifeValue } from '../data/life-note-fields';
import { LifeNoteInput } from './LifeNoteInput';
import type { LifeMutation, LifeNotesPort } from '../domain/life-notes-port';
import { colors as c, fonts } from '../theme';

type Editor = { field: LifeEntry; mode: 'edit' | 'review'; initial: LifeValue; grantId?: string };
const fieldTitle = (id: LifeTextField, locale: Locale) => {const def=lifeField(id)!;return lifeChapters.find(c=>c.id===def.chapter)!.items[def.index]![locale];};
let operationSequence = 0;

/** Production screen. The only development-specific branch is truthful storage status copy. */
export function LifeNotesWorkspace({ locale, port, home = false, onOpenNotes, onBack }: {
  locale: Locale; port: LifeNotesPort; home?: boolean; onOpenNotes: () => void; onBack: () => void;
}) {
  const [view, setView] = useState<LifeProjection | null>(null);
  const [readBlocked, setReadBlocked] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [chapter, setChapter] = useState<string | null>('future');
  const [editor, setEditor] = useState<Editor | null>(null), [value, setValue] = useState<LifeValue>(''), [discardPrompt, setDiscardPrompt] = useState(false);
  const [delegating, setDelegating] = useState(false), [fields, setFields] = useState<LifeTextField[]>([]), [operator, setOperator] = useState('');
  const [revokePrompt, setRevokePrompt] = useState<string | null>(null);
  const generation = useRef(0), inFlight = useRef(false), readSequence = useRef(0), refreshPending = useRef(false);
  const retry = useRef<LifeMutation | null>(null);
  const editorSnapshot = useRef<Editor | null>(null); editorSnapshot.current = editor;
  const t = (ja: string, en: string) => locale === 'ja' ? ja : en;
  const errorCopy = error === 'forbidden' ? t('このノートを開く権限がありません。本人の承認と利用資格を確認してください。', 'You do not have access to this note. Check owner approval and eligibility.')
    : error === 'conflict' ? t('内容が更新されています。最新の内容を確認してから、もう一度操作してください。', 'The content changed. Review the latest version before trying again.')
      : error === 'invalid' ? t('入力内容と対象項目を確認してください。', 'Check the text and selected items.')
        : t('ノートへの接続・保存完了を確認できません。接続後にもう一度お試しください。', 'Connection and saved status could not be confirmed. Please try again when connected.');
  const captureError = (e: unknown) => e instanceof Error && ['forbidden','conflict','invalid'].includes(e.message) ? e.message : 'unavailable';
  const acceptRead = (next: LifeProjection) => {
    const opened = editorSnapshot.current;
    if (opened && !next.owner && (!next.canEdit || next.delegation?.id !== opened.grantId || !next.fields.some(f=>f.id===opened.field.id))) {
      setEditor(null); setValue(''); setDiscardPrompt(false); retry.current = null;
    }
    setView(next); setReadBlocked(false);
  };
  const failRead = (e: unknown) => {
    const code = captureError(e); setError(code);
    if (code === 'unavailable') {
      // Keep unsaved text only in memory, but hide it until current authorization is verified again.
      setReadBlocked(true);
    } else { setView(null); setEditor(null); setValue(''); setDelegating(false); retry.current = null; }
  };
  const load = async (token = generation.current) => {
    if (inFlight.current) { refreshPending.current = true; return; }
    const sequence = ++readSequence.current;
    const current = () => token === generation.current && sequence === readSequence.current;
    try { const next = await port.read(); if (current()) { acceptRead(next); setError(''); } }
    catch (e) { if (current()) failRead(e); }
    finally { if (current()) setLoading(false); }
  };
  useEffect(() => {
    const token = ++generation.current;
    setView(null); setReadBlocked(false); setLoading(true); setEditor(null); setValue(''); setDelegating(false); setError(''); setNotice(''); setRevokePrompt(null); setDiscardPrompt(false); setFields([]); setOperator('');
    setBusy(false); inFlight.current = false; refreshPending.current = false; retry.current = null;
    void load(token);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void load(token); });
    return () => { generation.current++; sub.remove(); };
  }, [port]);
  useEffect(() => {
    const expiry = view?.delegation?.status === 'active' ? view.delegation.expiresAt : null;
    if (!expiry) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { timer = setTimeout(() => { if (Date.now() < expiry) schedule(); else void load(); }, Math.min(Math.max(0, expiry - Date.now()), 2_147_000_000)); };
    schedule();
    return () => clearTimeout(timer);
  }, [view?.delegation?.expiresAt, view?.delegation?.status, port]);
  const send = async (change: Omit<LifeMutation, 'operationId' | 'expectedRevision'>, repeat = false) => {
    if (!view || readBlocked || inFlight.current) return;
    const token = generation.current;
    const command = repeat && retry.current ? retry.current : { ...change, expectedRevision: view.revision, operationId: `life-${Date.now()}-${++operationSequence}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
    readSequence.current++;
    retry.current = command; inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const next = await port.execute(command);
      if (token !== generation.current) return;
      setView(next); setEditor(null); setValue(''); setDelegating(false); setRevokePrompt(null); setDiscardPrompt(false); retry.current = null;
      setNotice(port.mode === 'development' ? t('この起動中の開発データへ反映しました。', 'Updated the development data for this session.') : t('変更を保存しました。', 'Changes saved.'));
    } catch (e) {
      if (token !== generation.current) return;
      const code = captureError(e); setError(code);
      if (code === 'forbidden') { setView(null); setEditor(null); setValue(''); setDelegating(false); retry.current = null; }
      if (code === 'conflict') { retry.current = null; try { const next = await port.read(); if (token === generation.current) acceptRead(next); } catch (readError) { if (token === generation.current) failRead(readError); } }
    } finally { if (token === generation.current) { inFlight.current = false; setBusy(false); setLoading(false); if(refreshPending.current) {refreshPending.current=false;void load(token);} } }
  };
  const button = (id: string, ja: string, en: string, onPress: () => void, primary = false, disabled = false) =>
    <Pressable testID={id} accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress}
      style={[s.button, primary && s.primary, (disabled || busy) && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{t(ja, en)}</Text></Pressable>;
  const open = (field: LifeEntry, mode: 'edit' | 'review') => {
    const initial = editableLifeValue(field.id,view?.owner ? field.confirmed : field.draft?.text ?? field.confirmed);
    setEditor({ field: { ...field, confirmed:cloneLifeValue(field.confirmed), draft: field.draft ? { ...field.draft,text:cloneLifeValue(field.draft.text) } : null }, mode, initial, grantId:view?.delegation?.id }); setValue(cloneLifeValue(initial)); setDiscardPrompt(false); setError(''); setNotice(''); retry.current = null;
  };
  const close = () => { if (busy) return; if (editor?.mode === 'edit' && JSON.stringify(value) !== JSON.stringify(editor.initial)) setDiscardPrompt(true); else { setEditor(null); setValue(''); retry.current = null; } };
  const errorMessage = error && <Text accessibilityRole="alert" style={s.error}>{errorCopy}</Text>;
  return <View>
    <View accessibilityElementsHidden={!!editor && !readBlocked} importantForAccessibility={editor && !readBlocked ? 'no-hide-descendants' : 'auto'} aria-hidden={!!editor && !readBlocked}>
      <Text style={s.eyebrow}>TOMURAI BEFORE</Text>
      <Text accessibilityRole="header" style={s.title}>{home ? t('大切なことを、\n今のうちに少しずつ。', 'What matters,\na little at a time.') : view && !view.owner ? t('依頼されたノート', 'Notes entrusted to you') : t('わたしのノート', 'My notes')}</Text>
      <Text style={s.copy}>{t('全部書かなくても大丈夫です。気になることから、ご自身のペースで。', 'You do not need to fill in everything. Begin with what matters to you, at your own pace.')}</Text>
      {port.mode === 'development' && <Text style={s.connection}>{t('開発接続：この起動中だけ保持します。実際の個人情報は入力しないでください。', 'Development connection: kept for this session only. Do not enter real personal information.')}</Text>}
      {loading && <Text accessibilityLiveRegion="polite" style={s.copy}>{t('ノートを読み込んでいます…', 'Loading your notes…')}</Text>}
      {errorMessage}
      {!editor && error==='unavailable' && retry.current && button('notes-retry-action','同じ操作を再試行する','Retry the same operation',()=>void send(retry.current!,true))}
      {(!view || readBlocked) && !loading && button('notes-reload', 'もう一度読み込む', 'Try loading again', () => { setLoading(true); void load(); })}
      {notice && <Text accessibilityLiveRegion="polite" style={s.status}>{notice}</Text>}
      {view && !readBlocked && <>
        <View style={s.privacy}><Text style={s.label}>{view.owner ? t('自分だけのノート', 'Your private notes') : t('本人が選んだ項目のみ', 'Only items selected by the owner')}</Text>
          <Text style={s.small}>{t('勤務先には内容を共有しません。内容を確定しても、家族へ自動共有しません。', 'Contents are not shared with your employer. Confirmation does not automatically share them with family.')}</Text></View>
        {!view.canEdit && <Text style={s.status}>{t('現在は閲覧のみです。本人の承認と利用資格をご確認ください。', 'Read-only for now. Check owner approval and eligibility.')}</Text>}
        {home ? <>
          <Text style={s.section}>{t('これからを考える', 'Looking ahead')}</Text>
          {view.fields.filter(f=>lifeField(f.id)?.chapter==='future').slice(0, 3).map(f => <Pressable key={f.id} accessibilityRole="button" onPress={onOpenNotes} style={s.row}>
            <Text style={s.rowTitle}>{fieldTitle(f.id, locale)}</Text><Text style={s.small}>{f.draft ? t('確認待ち', 'Awaiting review') : f.confirmed ? t('記入済み', 'Written') : t('これから', 'Not started')} →</Text></Pressable>)}
          {button('notes-open', 'わたしのノートを開く', 'Open my notes', onOpenNotes, true)}
        </> : <>
          {lifeChapters.filter(section=>view.owner||view.fields.some(f=>lifeField(f.id)?.chapter===section.id)).map((section, i) => <View key={section.id}>
            <Pressable testID={`notes-chapter-${section.id}`} accessibilityRole="button" accessibilityState={{expanded:chapter===section.id}} aria-expanded={chapter===section.id}
              onPress={() => setChapter(chapter === section.id ? null : section.id)} style={s.chapter}>
              <Text style={s.rowTitle}>{view.owner ? `${i+1}｜` : ''}{section.title[locale]}</Text><Text style={s.buttonText}>{chapter===section.id?'−':'＋'}</Text>
            </Pressable>
            {chapter===section.id && lifeFields.filter(def=>def.chapter===section.id).sort((a,b)=>a.index-b.index).map(def => {
              const f=view.fields.find(field=>field.id===def.id);
              if (!f) return view.owner&&def.kind==='blocked' ? <View key={def.id} testID={`notes-blocked-${def.id}`} style={s.row}>
                <Text style={s.rowTitle}>{fieldTitle(def.id,locale)}</Text><Text style={s.small}>{def.reason![locale]}</Text></View> : null;
              return <View key={f.id} testID={`notes-field-${f.id}`} style={s.row}>
              <Text accessibilityRole="header" style={s.rowTitle}>{fieldTitle(f.id,locale)}</Text>
              <Text style={s.body}>{formatLifeValue(f.id,f.confirmed,locale) || t('まだ記入されていません。', 'Nothing written yet.')}</Text>
              {f.draft && <Text style={s.status}>{t('入力担当の下書きがあります。', 'A draft from your delegate is available.')}</Text>}
              <View style={s.actions}>{button(`notes-edit-${f.id}`, view.owner ? '記入・編集する' : '下書きを入力する', view.owner ? 'Write or edit' : 'Write a draft', () => open(f,'edit'), false, !view.canEdit)}
                {view.owner && f.draft && button(`notes-review-${f.id}`, '下書きを確認する', 'Review draft', () => open(f,'review'))}</View>
            </View>;})}
          </View>)}
          {view.owner && <View style={s.management}>
            <Text accessibilityRole="header" style={s.section}>{t('記入を手伝ってもらう', 'Get help writing')}</Text>
            <Text style={s.small}>{t('選んだ項目の閲覧と下書き入力だけを許可します。確定はご自身で行います。', 'Allow reading and drafting of selected items only. You confirm the content yourself.')}</Text>
            {view.delegation && <Text style={s.status}>{view.delegation.status === 'active' ? t('入力担当に委任中', 'Delegation active') : t('委任は終了しています', 'Delegation has ended')} · {new Date(view.delegation.expiresAt).toISOString().slice(0,10)}</Text>}
            {view.delegation?.status === 'active' ? button('notes-revoke-open','入力の依頼を取り消す','Cancel delegated entry',()=>setRevokePrompt(view.delegation!.id))
              : button('notes-delegate-open','入力担当と項目を選ぶ','Choose delegate and items',()=>{setDelegating(!delegating);setFields([]);setOperator(view.operators[0]?.id??'');},false,!view.canEdit || !view.operators.length)}
            {!view.operators.length && <Text style={s.small}>{t('依頼できる社員がいません。招待と参加確認後に選択できます。', 'No eligible employee is available. They must be invited and approved first.')}</Text>}
            {delegating && <View style={s.panel}>
              <Text style={s.label}>{t('入力担当', 'Delegate')}</Text>
              {view.operators.map((candidate,i)=><Pressable key={candidate.id} testID={`notes-operator-${i}`} accessibilityRole="radio" accessibilityState={{checked:operator===candidate.id}} aria-checked={operator===candidate.id}
                onPress={()=>setOperator(candidate.id)} style={s.choice}><Text style={s.body}>{operator===candidate.id?'✓ ':''}{candidate.displayName}</Text></Pressable>)}
              {view.fields.map(f=><Pressable key={f.id} testID={`notes-select-${f.id}`} accessibilityRole="checkbox" accessibilityState={{checked:fields.includes(f.id)}} aria-checked={fields.includes(f.id)}
                onPress={()=>setFields(current=>current.includes(f.id)?current.filter(id=>id!==f.id):[...current,f.id])} style={s.choice}><Text style={s.body}>{fields.includes(f.id)?'☑ ':'□ '}{fieldTitle(f.id,locale)}</Text></Pressable>)}
              <Text style={s.small}>{t('承認した時から30日間。自動更新せず、いつでも取り消せます。', 'Valid for thirty days from approval. No automatic renewal. Cancel at any time.')}</Text>
              {button('notes-delegate','この担当と項目を承認する','Approve this delegate and these items',()=>void send({type:'delegate',operatorId:operator,fieldIds:fields}),true,!fields.length || !operator)}
            </View>}
            {revokePrompt && <View style={s.panel}><Text style={s.body}>{t('入力担当の閲覧と入力を停止します。記入済みの内容と下書きは残ります。', 'Stop delegate reading and editing. Confirmed content and drafts will remain.')}</Text>
              {button('notes-revoke','依頼を取り消す','Confirm cancellation',()=>void send({type:'revoke',grantId:revokePrompt}),true)}
              {button('notes-revoke-close','戻る','Go back',()=>setRevokePrompt(null))}</View>}
          </View>}
        </>}
      </>}
      {button('notes-back',home?'死後の手続きへ':'ホームに戻る',home?'Bereavement tasks':'Back to home',onBack)}
    </View>
    <Modal visible={!!editor && !readBlocked} transparent animationType="slide" onRequestClose={close}>
      <View style={s.backdrop}><View style={s.sheet} accessibilityViewIsModal>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>
          <Text style={s.eyebrow}>{editor&&lifeChapters.find(ch=>ch.id===lifeField(editor.field.id)?.chapter)?.title[locale]}</Text>
          <Text accessibilityRole="header" style={s.editorTitle}>{editor && fieldTitle(editor.field.id,locale)}</Text>
          {editor?.mode==='edit' ? <>
            <Text style={s.small}>{view?.owner ? t('今わかることから、書いておけます。','Write what you know for now.') : t('下書きとして登録します。本人が確認するまで確定しません。','This remains a draft until the owner reviews and confirms it.')}</Text>
            <Text style={s.small}>{t('医療情報・口座番号・詳細資産・パスワードは記入しないでください。ここから連絡やファイル送信は行いません。','Do not enter medical details, account numbers, detailed assets or passwords. This form does not contact anyone or send files.')}</Text>
            <LifeNoteInput id={editor.field.id} value={value} locale={locale} disabled={busy} onChange={next=>{setValue(next);retry.current=null;}}/>
            {errorMessage}
            {button('notes-save',busy?'反映中…':view?.owner?'この内容を保存する':'下書きを登録する',busy?'Saving…':view?.owner?'Save this content':'Submit draft',()=>void send({type:view?.owner?'save':'draft',fieldId:editor.field.id,text:value,confirmedRevision:editor.field.confirmedRevision,...(!view?.owner?{grantId:editor.grantId,draftRevision:editor.field.draft?.revision??0}:{})}),true,normalizeLifeValue(editor.field.id,value)===undefined || !view?.canEdit)}
          </> : editor && <>
            <Text style={s.label}>{t('現在の確定内容','Current confirmed content')}</Text><Text style={s.body}>{formatLifeValue(editor.field.id,editor.field.confirmed,locale) || t('未記入','Not written')}</Text>
            <View style={s.panel}><Text style={s.label}>{t('入力担当からの下書き','Draft from your delegate')} · v{editor.field.draft?.revision}</Text><Text style={s.body}>{formatLifeValue(editor.field.id,editor.field.draft?.text??'',locale)}</Text></View>
            <Text style={s.small}>{t('この内容で確定しても、家族や勤務先へ自動共有しません。','Confirming does not automatically share with family or your employer.')}</Text>
            {errorMessage}
            {button('notes-confirm','確認した内容で確定する','Confirm the reviewed content',()=>void send({type:'confirm',fieldId:editor.field.id,draftRevision:editor.field.draft?.revision,confirmedRevision:editor.field.confirmedRevision}),true,!view?.canEdit)}
            {button('notes-discard','下書きを採用しない','Discard this draft',()=>setDiscardPrompt(true))}
          </>}
          {error==='unavailable' && retry.current && button('notes-retry','同じ操作を再試行する','Retry the same operation',()=>void send(retry.current!,true))}
          {discardPrompt && <View style={s.panel}><Text style={s.body}>{t('この変更を破棄しますか？確定済みの内容は残ります。','Discard this change? Confirmed content will remain.')}</Text>
            {button('notes-discard-confirm','破棄する','Discard',()=>{if(editor?.mode==='review') void send({type:'discard',fieldId:editor.field.id,draftRevision:editor.field.draft?.revision});else {setEditor(null);setValue('');setDiscardPrompt(false);retry.current=null;}})}
            {button('notes-continue','編集を続ける','Keep editing',()=>setDiscardPrompt(false))}</View>}
          {button('notes-close','閉じる','Close',close)}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const s=StyleSheet.create({
  eyebrow:{fontFamily:fonts.light,fontSize:11,color:c.muted,letterSpacing:1.7},title:{fontFamily:fonts.light,fontSize:26,lineHeight:42,color:c.ink,marginVertical:20},
  copy:{fontFamily:fonts.regular,fontSize:14,lineHeight:27,color:c.muted},body:{fontFamily:fonts.regular,fontSize:14,lineHeight:27,color:c.ink},
  small:{fontFamily:fonts.regular,fontSize:12,lineHeight:23,color:c.muted},connection:{fontFamily:fonts.regular,fontSize:11,lineHeight:21,color:c.muted,marginTop:16},
  privacy:{borderLeftWidth:2,borderColor:c.greenSoft,paddingLeft:16,marginVertical:26},label:{fontFamily:fonts.medium,fontSize:12,lineHeight:24,color:c.muted,marginBottom:8},
  row:{paddingVertical:18,borderBottomWidth:1,borderColor:c.line,gap:10},rowTitle:{fontFamily:fonts.medium,fontSize:15,lineHeight:27,color:c.ink,flex:1},
  chapter:{minHeight:60,paddingVertical:16,borderBottomWidth:1,borderColor:c.line,flexDirection:'row',alignItems:'center',gap:12},
  section:{fontFamily:fonts.medium,fontSize:17,lineHeight:29,color:c.ink,marginTop:20,marginBottom:12},management:{marginTop:24},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:12},button:{minHeight:48,justifyContent:'center',paddingVertical:12,paddingHorizontal:10,marginTop:6},
  buttonText:{fontFamily:fonts.medium,fontSize:14,lineHeight:25,color:c.green},primary:{backgroundColor:c.green,borderRadius:4,marginTop:18},primaryText:{color:c.white,textAlign:'center'},disabled:{opacity:0.45},
  status:{fontFamily:fonts.medium,fontSize:12,lineHeight:23,color:c.green,marginVertical:8},error:{fontFamily:fonts.medium,fontSize:13,lineHeight:25,color:c.warm,marginVertical:10},
  panel:{backgroundColor:c.paperDeep,padding:16,marginVertical:14,gap:8},choice:{minHeight:48,paddingVertical:12},
  backdrop:{flex:1,backgroundColor:'rgba(35,41,34,.38)',justifyContent:'flex-end',alignItems:'center'},sheet:{width:'100%',maxWidth:480,maxHeight:'90%',backgroundColor:c.paper,borderTopLeftRadius:16,borderTopRightRadius:16},
  sheetContent:{padding:24,paddingBottom:32},editorTitle:{fontFamily:fonts.medium,fontSize:21,lineHeight:34,color:c.ink,marginVertical:16},
});

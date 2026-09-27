import type { Locale, TextPair } from './questions';

export type LifeValue = string | Record<string, string> | Record<string, string>[];
export type LifeOption = { id: string; label: TextPair };
export type LifeColumn = { id: string; label: TextPair; options?: readonly LifeOption[]; maxLength?: number };
export type LifeField = { id: string; chapter: string; index: number; kind: 'text' | 'short' | 'fields' | 'rows' | 'blocked'; columns?: readonly LifeColumn[]; reason?: TextPair };
const pair = (ja:string,en:string):TextPair=>({ja,en});
const options = (ids:string[],ja:string[],en:string[]):LifeOption[]=>ids.map((id,i)=>({id,label:pair(ja[i]!,en[i]!)}));
const column = (id:string,ja:string,en:string,choices?:LifeOption[]):LifeColumn=>({id,label:pair(ja,en),...(choices?{options:choices}:{})});
const field = (id:string,chapter:string,index:number,kind:LifeField['kind'],columns?:LifeColumn[]):LifeField=>({id,chapter,index,kind,columns});
const blocked = (id:string,chapter:string,index:number,ja:string,en:string):LifeField=>({...field(id,chapter,index,'blocked'),reason:pair(ja,en)});
const relation=options(['spouse','child','father','mother','sibling','other'],['配偶者','子','父','母','兄弟姉妹','その他'],['Spouse','Child','Father','Mother','Sibling','Other']);
const contactColumns=(choices:LifeOption[])=>[column('relation','ご関係','Relationship',choices),column('name','お名前','Name'),column('contact','連絡先','Contact details')];
const choice=(choices:LifeOption[],note=false)=>[column('choice','選択','Choice',choices),...(note?[column('note','補足（任意）','Additional note (optional)')]:[])];
const health='医療情報の同意・監修・安全な保存を確認してから入力を開始します。';
const healthEn='Entry will open after medical review, consent and secure storage are confirmed.';
/** Audited PO form definitions. Restricted forms are never transformed into generic text inputs. */
export const lifeFields: readonly LifeField[] = [
  field('future-try','future',0,'text'),field('future-family','future',1,'text'),field('future-learn','future',2,'text'),
  field('future-value','future',3,'fields',choice(options(['family','health','work','friends','hobbies','nature','learning','other'],['家族','健康','仕事','友人','趣味','自然','学び','その他'],['Family','Health','Work','Friends','Hobbies','Nature','Learning','Other']),true).map(col=>col.id==='note'?{...col,maxLength:2000}:col)),
  field('future-change','future',4,'text'),
  blocked('me-basic','me',0,'血液型を含む収集範囲と安全な保存を確認中です。','The scope, including blood type, and secure storage need review.'),
  field('me-family','me',1,'rows',contactColumns(relation)),
  field('me-emergency','me',2,'rows',contactColumns(options(['family','friend','doctor','other'],['家族','友人','かかりつけ医','その他'],['Family','Friend','Usual doctor','Other']))),
  blocked('me-doctor','me',3,health,healthEn),
  field('me-contacts','me',4,'rows',contactColumns(options(['work','neighbour','friend','other'],['職場','近所','友人','その他'],['Work','Neighbour','Friend','Other']))),
  field('me-pets','me',5,'fields',[column('name','名前','Name'),column('kind','種類','Kind'),column('vet','かかりつけ動物病院','Veterinary clinic'),column('carer','託したい相手','Preferred carer')]),
  ...['disclosure','consult','treatment','place','care','donation','capacity'].map((id,index)=>blocked(`medical-${id}`,'medical',index,health,healthEn)),
  blocked('money-assets','money',0,'詳細資産を収集しない方針との整合を確認中です。','Asset collection scope is under review.'),
  blocked('digital-accounts','digital',0,'パスワード・ログイン情報は収集しません。安全な項目を確認中です。','Passwords and login secrets are not collected. Safe fields are under review.'),
  blocked('legal-will','legal',0,'遺言本文の収集範囲と法律案内を確認中です。','The scope of will text and legal guidance needs review.'),
  field('legal-guardian','legal',1,'fields',choice(options(['contracted','considering','not-considered'],['契約済み','検討中','まだ考えていない'],['Contract arranged','Considering','Not yet considered']))),
  field('legal-documents','legal',2,'short'),
  blocked('legal-property','legal',3,'不動産の収集範囲と確認状態の扱いを確認中です。','Property details and confirmation status need review.'),
  field('legal-affairs','legal',4,'fields',choice(options(['contracted','considering','not-planned'],['契約済み','検討中','利用しない予定'],['Contract arranged','Considering','Not planned']))),
  field('funeral-format','funeral',0,'fields',[column('format','形式','Format',options(['family','general','direct','no-preference','family-decides'],['家族葬','一般葬','直葬','特に希望なし','家族に任せる'],['Family funeral','General funeral','Direct cremation','No preference','Leave to family'])),column('tradition','宗派','Religious tradition')]),
  field('funeral-people','funeral',1,'rows',[column('name','お名前','Name'),column('relation','間柄','Relationship')]),
  blocked('funeral-photo','funeral',2,'写真の保存・削除・同意を確認中です。アップロードはできません。','Photo storage, deletion and consent need review. Uploads are unavailable.'),
  field('funeral-arrangements','funeral',3,'fields',[column('flowers','好きな花','Flowers'),column('music','流してほしい音楽','Music'),column('items','棺に入れてほしいもの','Items for the coffin')]),
  field('funeral-interment','funeral',4,'fields',choice(options(['arranged','to-find','natural','no-preference'],['すでにある','これから探す','樹木葬・散骨を希望','特にこだわりはない'],['Already arranged','To be found','Tree burial or scattering','No preference']),true)),
  field('funeral-gifts','funeral',5,'fields',choice(options(['usual','decline','no-preference'],['通常通り','香典・供花を辞退したい','特にこだわりはない'],['Usual arrangements','Decline condolence gifts and flowers','No preference']))),
  ...['thanks','family','memories','keepsakes','media'].map((id,index)=>field(`message-${id}`,'message',index,'text')),
];
export const activeLifeFieldIds = lifeFields.filter(f=>f.kind!=='blocked').map(f=>f.id);
export const lifeField = (id:string) => lifeFields.find(f=>f.id===id);
export const cloneLifeValue = (value:LifeValue):LifeValue => typeof value==='string'?value:Array.isArray(value)?value.map(row=>({...row})):{...value};
const safeString=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
/** Returns undefined for unrecognized or empty input; canonical copies prevent reference mutation. */
export function normalizeLifeValue(id:string,value:unknown):LifeValue|undefined {
  const def=lifeField(id);if(!def||def.kind==='blocked')return;
  if(def.kind==='text'||def.kind==='short')return safeString(value,def.kind==='short'?200:2000)&&value.trim()?value.trim():undefined;
  const record=(candidate:unknown):Record<string,string>|undefined=>{
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||Object.prototype.toString.call(candidate)!=='[object Object]')return;
    const row=candidate as Record<string,unknown>, keys=Object.keys(row);
    if(keys.some(key=>!def.columns!.some(c=>c.id===key)))return;
    const result:Record<string,string>={};
    for(const col of def.columns!) {
      const raw=Object.hasOwn(row,col.id)?row[col.id]:'';if(!safeString(raw,col.maxLength??200)||col.options&&raw!==''&&!col.options.some(o=>o.id===raw))return;
      result[col.id]=raw.trim();
    }
    return Object.values(result).some(Boolean)?result:undefined;
  };
  if(def.kind==='fields')return record(value);
  if(!Array.isArray(value)||!value.length||value.length>50)return;
  const rows=value.map(record);return rows.every(row=>row!==undefined)?rows as Record<string,string>[]:undefined;
}
export const emptyLifeValue=(id:string):LifeValue=>{const def=lifeField(id)!;return def.kind==='rows'?[{}]:def.kind==='fields'?{}:'';};
/** Keep legacy free text as an unselected note; never guess an answer during conversion. */
export const editableLifeValue=(id:string,value:LifeValue):LifeValue=>typeof value==='string'&&lifeField(id)?.kind==='fields'?value?{note:value}:{}:typeof value==='string'&&lifeField(id)?.kind==='rows'?[{}]:cloneLifeValue(value);
export function formatLifeValue(id:string,value:LifeValue,locale:Locale):string {
  if(typeof value==='string')return value;
  const def=lifeField(id);if(!def||def.kind==='blocked')return '';
  const row=(data:Record<string,string>)=>def.columns!.filter(col=>data[col.id]).map(col=>`${col.label[locale]}：${col.options?.find(o=>o.id===data[col.id])?.label[locale]??data[col.id]}`).join('\n');
  return Array.isArray(value)?value.map((item,i)=>`${i+1}. ${row(item)}`).join('\n\n'):row(value);
}

import type { TextPair } from './questions';
export type LifeChapter = { id:string; title:TextPair; items:readonly TextPair[] };
const item = (ja:string,en:string):TextPair => ({ja,en});
/** Labels observed in the PO mock. No example people, private records or invented fields. */
export const lifeChapters: readonly LifeChapter[] = [
  { id:'me',title:item('わたしについて','About me'),items:[
    item('基本情報','Basic information'),item('家族・親族の一覧','Family and relatives'),item('緊急連絡先・もしもの時に連絡してほしい人','Emergency contacts'),
    item('かかりつけ医','Usual doctor'),item('大切な人・お世話になった方への連絡リスト','Other people to contact'),item('ペットについて','Pets')] },
  { id:'medical',title:item('医療・介護について','Medical and care preferences'),items:[
    item('病気の告知についての希望','Preferences about being told of an illness'),item('判断できなくなった時に相談してほしい人','Who to consult if I cannot decide'),
    item('延命治療についての考え','Thoughts on life-sustaining treatment'),item('最期を過ごしたい場所','Where I would like to spend my final days'),
    item('介護が必要になった場合の希望','Care preferences'),item('臓器提供についての意志','Organ donation wishes'),item('認知症など判断能力が低下した場合の希望','Preferences if decision-making becomes difficult')] },
  { id:'money',title:item('お金・資産について','Money and assets'),items:[item('資産の一覧','Asset list')] },
  { id:'digital',title:item('デジタルの整理','Digital arrangements'),items:[item('デジタル資産・アカウントの一覧','Digital assets and accounts')] },
  { id:'legal',title:item('遺言・相続・重要書類','Wills, inheritance and documents'),items:[
    item('遺言書の有無・保管場所・種類','Will status, location and type'),item('任意後見についての準備','Voluntary guardianship preparations'),
    item('重要書類（印鑑・不動産関連書類・保険証券など）の保管場所','Location of important documents'),item('相続登記が必要な不動産の確認','Property requiring inheritance registration'),item('身の回りの事務を任せる契約について','Agreements for managing personal affairs')] },
  { id:'funeral',title:item('供養・お別れについて','Remembrance and farewell'),items:[
    item('お別れの形式・宗派についての希望','Farewell and tradition preferences'),item('お別れの場に来てほしい人','People to invite'),item('遺影に使ってほしい写真','Memorial photograph'),
    item('お別れの場での演出についての希望','Farewell arrangements'),item('お墓・納骨先についての希望','Grave and interment preferences'),item('法要・香典についての希望','Rituals and condolence gifts')] },
  { id:'message',title:item('大切な人へ','For people close to me'),items:[
    item('感謝や謝りたい気持ちを伝えるメッセージ','Messages of thanks or apology'),item('家族に知っておいてほしいこと','Things I want my family to know'),
    item('大切にしている思い出','Memories I value'),item('受け継いでほしいもの・形見分け','Things to pass on'),item('写真・動画・音声メッセージについて','Photos, videos and voice messages')] },
  { id:'future',title:item('これからのこと','Looking ahead'),items:[
    item('これからやってみたいこと','Things I would like to try'),item('家族としたいこと','Things to do with family'),item('学びたいこと・整理しておきたいこと','Things to learn or organise'),
    item('今、大切にしたいこと','What matters to me now'),item('もし時間に限りがあるとしたら、今の生活で変えたいこと','What I would change if time were limited')] },
];

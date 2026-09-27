import { validDate } from './calendar.ts';
import type { Locale, TextPair } from '../data/questions';
export type MunicipalDirectory = { id: string; label: TextPair; url: string; host: string; checkedOn: string; requiresDistrict: boolean };
/** Verified public entry links, NOT approved task guidance or complete Kanto coverage. */
export const municipalDirectories: readonly MunicipalDirectory[] = [
  { id:'shibuya', label:{ja:'東京都 渋谷区',en:'Shibuya, Tokyo'}, url:'https://www.city.shibuya.tokyo.jp/contents/case/okuyami.html', host:'www.city.shibuya.tokyo.jp', checkedOn:'2026-09-26', requiresDistrict:false },
  { id:'yokohama', label:{ja:'神奈川県 横浜市（区別案内へ）',en:'Yokohama, Kanagawa (ward guides)'}, url:'https://www.city.yokohama.lg.jp/life/gohukou.html', host:'www.city.yokohama.lg.jp', checkedOn:'2026-09-26', requiresDistrict:true },
];
/** Names checked against Yokohama's official ward index, 2026-09-27. Not procedure approval. */
export const municipalDistrictIndexUrl = 'https://www.city.yokohama.lg.jp/city-info/yokohamashi/ku-shokai/';
export const municipalDistricts: readonly { id:string; municipalityId:string; label:TextPair }[] = [
  ['aoba','青葉区','Aoba'], ['asahi','旭区','Asahi'], ['izumi','泉区','Izumi'], ['isogo','磯子区','Isogo'],
  ['kanagawa','神奈川区','Kanagawa'], ['kanazawa','金沢区','Kanazawa'], ['konan','港南区','Konan'], ['kohoku','港北区','Kohoku'],
  ['sakae','栄区','Sakae'], ['seya','瀬谷区','Seya'], ['tsuzuki','都筑区','Tsuzuki'], ['tsurumi','鶴見区','Tsurumi'],
  ['totsuka','戸塚区','Totsuka'], ['naka','中区','Naka'], ['nishi','西区','Nishi'], ['hodogaya','保土ケ谷区','Hodogaya'],
  ['midori','緑区','Midori'], ['minami','南区','Minami'],
].map(([id,ja,en]) => ({id:id!, municipalityId:'yokohama', label:{ja:ja!,en:`${en} Ward`}}));
export type MunicipalJurisdiction = { municipalityId:string; districtId:string|null; jurisdictionConfirmed:boolean; districtJurisdictionConfirmed:boolean };
export const emptyMunicipalJurisdiction: Readonly<MunicipalJurisdiction> = Object.freeze({municipalityId:'',districtId:null,jurisdictionConfirmed:false,districtJurisdictionConfirmed:false});
export function normalizeMunicipalJurisdiction(value: Partial<MunicipalJurisdiction> | null | undefined): MunicipalJurisdiction {
  const directory=municipalDirectories.find(item=>item.id===value?.municipalityId);
  if(!directory) return {...emptyMunicipalJurisdiction};
  const district=directory.requiresDistrict ? municipalDistricts.find(item=>item.municipalityId===directory.id && item.id===value?.districtId) : undefined;
  const invalidDistrict=value?.districtId != null && !district;
  const confirmed=value?.jurisdictionConfirmed===true && !invalidDistrict;
  return {municipalityId:directory.id,districtId:district?.id??null,jurisdictionConfirmed:confirmed,
    districtJurisdictionConfirmed:confirmed && !!district && value?.districtJurisdictionConfirmed===true};
}
export type MunicipalJurisdictionChange = { type:'municipality'|'district'; value:string } | { type:'confirm-municipality'|'confirm-district'; value:boolean };
export function changeMunicipalJurisdiction(value: MunicipalJurisdiction, change: MunicipalJurisdictionChange): MunicipalJurisdiction {
  const current=normalizeMunicipalJurisdiction(value);
  switch(change.type) {
    case 'municipality': return change.value===current.municipalityId ? current
      : normalizeMunicipalJurisdiction({...emptyMunicipalJurisdiction,municipalityId:change.value});
    case 'district': return change.value===current.districtId ? current
      : normalizeMunicipalJurisdiction({...current,districtId:change.value||null,jurisdictionConfirmed:false,districtJurisdictionConfirmed:false});
    case 'confirm-municipality': return normalizeMunicipalJurisdiction({...current,jurisdictionConfirmed:change.value});
    case 'confirm-district': return normalizeMunicipalJurisdiction({...current,districtJurisdictionConfirmed:change.value});
  }
}
export type MunicipalGuidance = {
  municipalityId:string; taskId:string; locale:Locale; version:string; body:string; officialUrl:string;
  checkedOn:string; approvedBy:string; validFrom:string; validUntil:string; districtId?:string | null;
};
export const approvedMunicipalGuidance: readonly MunicipalGuidance[] = [];
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function isGuidanceRecord(value: unknown): value is MunicipalGuidance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<MunicipalGuidance>;
  return [row.municipalityId, row.taskId, row.version, row.body, row.officialUrl, row.approvedBy].every(nonempty)
    && (row.locale === 'ja' || row.locale === 'en')
    && [row.checkedOn, row.validFrom, row.validUntil].every(date => typeof date === 'string' && validDate(date))
    && (row.districtId === undefined || row.districtId === null || nonempty(row.districtId));
}
export function selectMunicipalGuidance(input: {
  municipalityId:string; taskId:string; locale:Locale; jurisdictionConfirmed:boolean; today:string;
  districtId?:string | null; districtJurisdictionConfirmed?:boolean;
}, records: readonly unknown[]): MunicipalGuidance | null {
  if (!input || input.jurisdictionConfirmed !== true || typeof input.today !== 'string' || !validDate(input.today) || !Array.isArray(records)) return null;
  const directory = municipalDirectories.find(item => item.id === input.municipalityId);
  if (!directory) return null;
  if (directory.requiresDistrict) {
    if (!municipalDistricts.some(item=>item.municipalityId===directory.id && item.id===input.districtId) || input.districtJurisdictionConfirmed !== true) return null;
  } else if (input.districtId !== undefined && input.districtId !== null) return null;
  const matches = records.filter(isGuidanceRecord).filter(record => {
    if (record.municipalityId !== input.municipalityId || record.taskId !== input.taskId || record.locale !== input.locale
      || (record.districtId ?? null) !== (input.districtId ?? null) || record.checkedOn > input.today
      || input.today < record.validFrom || input.today > record.validUntil) return false;
    try { const url = new URL(record.officialUrl); return url.protocol === 'https:' && url.hostname === directory.host && !url.username && !url.password && !url.port; }
    catch { return false; }
  });
  return matches.length === 1 ? matches[0]! : null;
}

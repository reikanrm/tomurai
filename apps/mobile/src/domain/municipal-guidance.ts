import { validDate } from './calendar.ts';
import type { Locale, TextPair } from '../data/questions';
export type MunicipalDirectory = { id: string; label: TextPair; url: string; host: string; checkedOn: string; requiresDistrict: boolean };
/** Verified public entry links, NOT approved task guidance or complete Kanto coverage. */
export const municipalDirectories: readonly MunicipalDirectory[] = [
  { id:'shibuya', label:{ja:'東京都 渋谷区',en:'Shibuya, Tokyo'}, url:'https://www.city.shibuya.tokyo.jp/contents/case/okuyami.html', host:'www.city.shibuya.tokyo.jp', checkedOn:'2026-09-26', requiresDistrict:false },
  { id:'yokohama', label:{ja:'神奈川県 横浜市（区別案内へ）',en:'Yokohama, Kanagawa (ward guides)'}, url:'https://www.city.yokohama.lg.jp/life/gohukou.html', host:'www.city.yokohama.lg.jp', checkedOn:'2026-09-26', requiresDistrict:true },
];
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
    if (!nonempty(input.districtId) || input.districtJurisdictionConfirmed !== true) return null;
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

import { dayKey } from './weight';

export type Gender = 'male' | 'female' | 'diverse';

export interface Profile {
  name?: string;
  gender?: Gender;
  heightCm?: number;
  birthDate?: string;
  bodyFat?: number;
  bodyFatDate?: string;
}

export function isValidHeight(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 100 && n <= 250;
}

export function isValidBodyFat(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 3 && n <= 60;
}

/** YYYY-MM-DD, echtes Kalenderdatum. */
export function isDayKey(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Echtes Datum, streng vor dem lokalen Tag von `now`. */
export function isValidBirthDate(s: unknown, now: number): s is string {
  return isDayKey(s) && s < dayKey(now);
}

export function parseProfile(value: unknown, now: number): Profile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const p: Profile = {};
  if (typeof v.name === 'string' && v.name.trim()) p.name = v.name.trim();
  if (v.gender === 'male' || v.gender === 'female' || v.gender === 'diverse') p.gender = v.gender;
  if (isValidHeight(v.heightCm)) p.heightCm = v.heightCm;
  if (isValidBirthDate(v.birthDate, now)) p.birthDate = v.birthDate;
  if (isValidBodyFat(v.bodyFat)) p.bodyFat = v.bodyFat;
  if (isDayKey(v.bodyFatDate)) p.bodyFatDate = v.bodyFatDate;
  return p;
}

/** Volle Lebensjahre am lokalen Tag von `now`. */
export function ageOn(birthDate: string, now: number): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const t = new Date(now);
  let age = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) age--;
  return age;
}

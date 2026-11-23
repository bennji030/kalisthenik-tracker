import type { WeightEntry } from './db';

export interface WeightPoint {
  date: string;
  kg: number;
  avg: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokaler Kalendertag als YYYY-MM-DD (nicht toISOString, das ist UTC). */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Mitternacht (lokal) des Tages YYYY-MM-DD als Zeitstempel. */
export function dayTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function roundKg(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isValidKg(n: number | null): boolean {
  return n != null && Number.isFinite(n) && n >= 20 && n <= 300;
}

/** Je Eintrag der Schnitt aus ihm und bis zu 6 früheren Einträgen, aufsteigend nach Datum. */
export function rollingAverages(entries: WeightEntry[]): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return sorted.map((e, i) => {
    const win = sorted.slice(Math.max(0, i - 6), i + 1);
    return { date: e.date, kg: e.kg, avg: win.reduce((s, w) => s + w.kg, 0) / win.length };
  });
}

/** Aktueller Schnitt und Änderung zum Schnitt am letzten Eintrag, der mindestens 7 Tage älter ist. */
export function weightSummary(entries: WeightEntry[]): { avg: number; delta: number | null } | null {
  const rolling = rollingAverages(entries);
  const last = rolling[rolling.length - 1];
  if (!last) return null;
  const [y, m, d] = last.date.split('-').map(Number);
  const cutoff = dayKey(new Date(y, m - 1, d - 7).getTime());
  const ref = [...rolling].reverse().find((r) => r.date <= cutoff);
  return { avg: last.avg, delta: ref ? last.avg - ref.avg : null };
}

export function isWeightList(x: unknown): x is WeightEntry[] {
  if (!Array.isArray(x)) return false;
  const seen = new Set<string>();
  for (const e of x) {
    if (typeof e !== 'object' || e == null) return false;
    const { date, kg } = e as Record<string, unknown>;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) return false;
    if (typeof kg !== 'number' || !Number.isFinite(kg)) return false;
    seen.add(date);
  }
  return true;
}

/** z. B. "82,4" (immer eine Nachkommastelle) */
export function fmtWeight(n: number): string {
  return roundKg(n).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** z. B. "−0,4 kg", "+0,3 kg", "±0,0 kg" */
export function fmtDelta(n: number): string {
  const r = roundKg(n);
  if (r === 0) return '±0,0 kg';
  return `${r < 0 ? '−' : '+'}${fmtWeight(Math.abs(r))} kg`;
}

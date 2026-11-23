import type { ExType, SetLog } from './db';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function fmtKg(n: number | null | undefined): string {
  if (n == null) return '–';
  return (Math.round(n * 100) / 100).toLocaleString('de-DE');
}

export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function fmtDate(ts: number, withWeekday = false): string {
  const d = new Date(ts);
  const s = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return withWeekday ? `${WEEKDAYS[d.getDay()]} ${s}` : s;
}

export function fmtShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

/** z. B. "4×4 @ 25 kg", "5, 4, 4, 4 @ 25 kg", "3×10", "20, 18 s" */
export function summarizeSets(sets: Pick<SetLog, 'reps' | 'weight' | 'sec'>[], type: ExType): string {
  if (!sets.length) return '–';
  if (type === 'hold') {
    const secs = sets.map((s) => s.sec ?? 0);
    const reps = sets.map((s) => s.reps ?? 0);
    const base = allSame(secs) ? `${secs.length}×${secs[0]} s` : `${secs.join(', ')} s`;
    return reps.some((r) => r > 0) ? `${base} (${reps.join(', ')} Wdh.)` : base;
  }
  const reps = sets.map((s) => s.reps ?? 0);
  const repStr = allSame(reps) ? `${reps.length}×${reps[0]}` : reps.join(', ');
  if (type === 'reps') return repStr;
  const weights = sets.map((s) => s.weight ?? 0);
  if (allSame(weights)) return weights[0] ? `${repStr} @ ${fmtKg(weights[0])} kg` : repStr;
  return sets.map((s) => `${s.reps ?? 0}@${fmtKg(s.weight ?? 0)}`).join(', ') + ' kg';
}

function allSame<T>(a: T[]): boolean {
  return a.every((x) => x === a[0]);
}

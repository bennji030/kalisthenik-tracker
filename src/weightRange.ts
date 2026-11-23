import type { WeightEntry } from './db';
import { dayKey, rollingAverages } from './weight';
import type { WeightPoint } from './weight';

export type WeightRange = 30 | 90 | 'all';

/** Punkte im Zeitraum (heute plus die Tage davor); Schnitte über alle Einträge gerechnet. */
export function weightRangePoints(entries: WeightEntry[], range: WeightRange, now: number): WeightPoint[] {
  const all = rollingAverages(entries);
  if (range === 'all') return all;
  const t = new Date(now);
  const first = dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - (range - 1)).getTime());
  return all.filter((p) => p.date >= first);
}

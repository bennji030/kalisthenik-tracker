import type { Exercise, Session, Template } from './db';
import { isCardioSession } from './cardio';

export type Group = 'pull' | 'push' | 'skills' | 'other';

export const GROUPS: readonly (readonly [Group, string])[] = [['pull', 'Pull'], ['push', 'Push'], ['skills', 'Skills'], ['other', 'Sonstiges']];

export const WINDOW = 7;

export interface StatPoint {
  ts: number;
  value: number;
}

function hasDone(s: Session, exerciseId: string): boolean {
  return s.entries.some((e) => e.exerciseId === exerciseId && e.sets.some((x) => x.done));
}

function dayGroup(templateName: string): 'pull' | 'push' | null {
  const n = templateName.trim().toLowerCase();
  return n.startsWith('pull') ? 'pull' : n.startsWith('push') ? 'push' : null;
}

/** Skills: nur freie Slots im aktuellen Plan. Sonst Pull/Push nach Häufigkeit der Trainingstage, Gleichstand: jüngstes. */
export function exerciseGroup(exerciseId: string, sessions: Session[], templates: Template[]): Group {
  const slots = templates.flatMap((t) => t.slots.filter((s) => s.exerciseId === exerciseId));
  if (slots.length > 0 && slots.every((s) => !s.progression)) return 'skills';
  const count = { pull: 0, push: 0 };
  let latest: { ts: number; group: 'pull' | 'push' } | null = null;
  for (const s of sessions) {
    if (!s.finishedAt || isCardioSession(s) || !hasDone(s, exerciseId)) continue;
    const g = dayGroup(s.templateName);
    if (!g) continue;
    count[g]++;
    if (!latest || s.startedAt > latest.ts) latest = { ts: s.startedAt, group: g };
  }
  if (!latest) return 'other';
  if (count.pull !== count.push) return count.pull > count.push ? 'pull' : 'push';
  return latest.group;
}

/** Ø Zusatzgewicht / Wdh. / Sekunden der erledigten Sätze; null ohne erledigten Satz. */
export function sessionMetric(s: Session, ex: Pick<Exercise, 'id' | 'type'>): number | null {
  const sets = s.entries.filter((e) => e.exerciseId === ex.id).flatMap((e) => e.sets.filter((x) => x.done));
  if (sets.length === 0) return null;
  const v = (x: (typeof sets)[number]) => (ex.type === 'weighted' ? x.weight : ex.type === 'hold' ? x.sec : x.reps) ?? 0;
  return sets.reduce((n, x) => n + v(x), 0) / sets.length;
}

/** Letzte 7 Punkte in zeitlicher Reihenfolge, nur fertige Krafttrainings. */
export function exerciseWindow(sessions: Session[], ex: Pick<Exercise, 'id' | 'type'>): StatPoint[] {
  const points: StatPoint[] = [];
  for (const s of sessions) {
    if (!s.finishedAt || isCardioSession(s)) continue;
    const value = sessionMetric(s, ex);
    if (value !== null) points.push({ ts: s.startedAt, value });
  }
  return points.sort((a, b) => a.ts - b.ts).slice(-WINDOW);
}

/** Letzter minus erster Wert, eine Nachkommastelle; null unter 2 Punkten. */
export function windowChange(points: StatPoint[]): number | null {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].value - points[0].value) * 10) / 10;
}

const UNITS = { weighted: 'kg', reps: 'Wdh', hold: 's' } as const;

/** z. B. "+6,7 kg", "−1,4 kg", "±0 s" */
export function fmtChange(change: number, type: Exercise['type']): string {
  const unit = UNITS[type];
  if (change === 0) return `±0 ${unit}`;
  return `${change < 0 ? '−' : '+'}${Math.abs(change).toLocaleString('de-DE')} ${unit}`;
}

/** Reihenfolge im Plan, Rest nach Name. */
export function exerciseOrder(exercises: Exercise[], templates: Template[]): Exercise[] {
  const planIds = [...templates].sort((a, b) => a.order - b.order).flatMap((t) => t.slots.map((s) => s.exerciseId));
  const rank = (id: string) => { const i = planIds.indexOf(id); return i < 0 ? Infinity : i; };
  return [...exercises].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, 'de'));
}

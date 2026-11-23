import type { Session } from './db';

export function weekStart(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Trainings in Folge: laufende Woche plus alle vollen Vorwochen (Mo–So) am Stück. */
export function streak(
  sessions: Pick<Session, 'startedAt' | 'finishedAt'>[],
  target: number,
  now: number,
): number {
  const goal = Math.max(1, target);
  const counts = new Map<number, number>();
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const key = weekStart(s.startedAt).getTime();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const week = weekStart(now);
  let total = counts.get(week.getTime()) ?? 0;
  for (;;) {
    week.setDate(week.getDate() - 7);
    const n = counts.get(week.getTime()) ?? 0;
    if (n < goal) return total;
    total += n;
  }
}

import type { Session } from './db';
import { entrySucceeded } from './progression';
import { streak } from './streak';
import { fmtShortDate, WEEKDAYS } from './util';

const isFinishedStrength = (s: Session) => s.finishedAt != null && s.kind !== 'cardio';

/** Training Nr.: fertige Krafttrainings inklusive des gerade beendeten. */
export function trainingNumber(sessions: Session[]): number {
  return sessions.filter(isFinishedStrength).length;
}

/** Flammen ohne und mit dem beendeten Training, Gewinn nie negativ. */
export function flameGain(sessions: Session[], doneId: string, strengthTemplates: number, now: number) {
  const all = sessions.filter(isFinishedStrength);
  const before = streak(all.filter((s) => s.id !== doneId), strengthTemplates, now);
  const after = streak(all, strengthTemplates, now);
  return { before, after, gain: Math.max(0, after - before) };
}

export interface FinishStats {
  sets: number;
  reps: number;
  minutes: number;
  hits: number;
  judged: number;
}

export function sessionStats(s: Session): FinishStats {
  const done = s.entries.flatMap((e) => e.sets).filter((st) => st.done);
  const judged = s.entries.filter((e) => e.kind !== 'free');
  return {
    sets: done.length,
    reps: done.reduce((n, st) => n + (st.reps ?? 0), 0),
    minutes: Math.round(((s.finishedAt ?? s.startedAt) - s.startedAt) / 60000),
    hits: judged.filter((e) => entrySucceeded(e)).length,
    judged: judged.length,
  };
}

/** "Mo 23.11." */
export function backdatedLabel(ts: number): string {
  return `${WEEKDAYS[new Date(ts).getDay()]} ${fmtShortDate(ts)}`;
}

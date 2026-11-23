import type { EntryLog, Exercise } from '../db';
import { entrySucceeded } from '../progression';
import { summarizeSets } from '../util';

export function SessionLog({ entries, exMap }: { entries: EntryLog[]; exMap: Map<string, Exercise> }) {
  return (
    <ul className="log">
      {entries.filter((e) => e.sets.some((x) => x.done)).map((e) => {
        const ex = exMap.get(e.exerciseId);
        const judged = e.kind !== 'free';
        return (
          <li key={e.slotId}>
            <span>{judged ? (entrySucceeded(e) ? '✅' : '⚠️') : '·'} {ex?.name ?? '?'}</span>
            <span className="muted">{summarizeSets(e.sets.filter((x) => x.done), ex?.type ?? 'reps')}</span>
          </li>
        );
      })}
    </ul>
  );
}

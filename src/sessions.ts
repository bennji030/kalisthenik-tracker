import { db, type EntryLog, type Exercise, type Session, type Slot, type Template } from './db';
import { suggest, type Suggestion } from './progression';
import { summarizeSets, uid, fmtShortDate } from './util';

/** Frühere Einträge eines Slots (neuester zuerst), nur abgeschlossene Trainings mit mind. einem erledigten Satz. */
export async function slotHistory(templateId: string, slot: Slot): Promise<{ entry: EntryLog; at: number }[]> {
  const sessions = await db.sessions.where('templateId').equals(templateId).toArray();
  return sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => ({ entry: s.entries.find((e) => e.slotId === slot.id), at: s.startedAt }))
    .filter((x): x is { entry: EntryLog; at: number } => !!x.entry && x.entry.sets.some((st) => st.done));
}

export interface Plan {
  slot: Slot;
  exercise: Exercise;
  suggestion: Suggestion;
  lastSummary: string | null;
}

export async function planTemplate(t: Template): Promise<Plan[]> {
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const out: Plan[] = [];
  for (const slot of t.slots) {
    const exercise = exercises.get(slot.exerciseId);
    if (!exercise) continue;
    const hist = await slotHistory(t.id, slot);
    const suggestion = suggest(slot, exercise.type, hist.map((h) => h.entry));
    const last = hist[0];
    const lastSummary = last
      ? `${summarizeSets(last.entry.sets.filter((s) => s.done), exercise.type)} · ${fmtShortDate(last.at)}`
      : null;
    out.push({ slot, exercise, suggestion, lastSummary });
  }
  return out;
}

export async function startSession(t: Template): Promise<string> {
  const plans = await planTemplate(t);
  const entries: EntryLog[] = plans.map(({ slot, exercise, suggestion: s, lastSummary }) => {
    const judged = s.kind !== 'free';
    return {
      slotId: slot.id,
      exerciseId: exercise.id,
      restSec: slot.restSec,
      kind: s.kind,
      label: s.label,
      lastSummary,
      sets: Array.from({ length: slot.sets }, (_, i) => ({
        targetReps: judged ? s.reps[i] : null,
        targetWeight: judged && exercise.type === 'weighted' ? s.weight : null,
        targetSec: null,
        reps: s.reps[i] ?? null,
        weight: exercise.type === 'weighted' ? s.weight : null,
        sec: s.sec[i] ?? null,
        done: false,
      })),
    };
  });
  const session: Session = {
    id: uid(),
    templateId: t.id,
    templateName: t.name,
    startedAt: Date.now(),
    finishedAt: null,
    entries,
  };
  await db.sessions.add(session);
  return session.id;
}

export async function activeSession(): Promise<Session | undefined> {
  return (await db.sessions.toArray()).find((s) => s.finishedAt == null);
}

import type { EntryLog, Exercise, ExType, Session, Slot, Template } from './db';

/** Standardwerte einer neuen Übung im Trainingstag (Plan-Editor und „künftig auch“). */
export const DEFAULT_SLOT: Omit<Slot, 'id' | 'exerciseId'> = {
  sets: 3, repMin: 6, repMax: 10, increment: 2.5, startWeight: 0, restSec: 120, progression: true,
};

/** Eintrag für eine Übung, die während des Trainings hinzugefügt wird: frei, 3 leere Sätze. */
export function addedEntry(exercise: Exercise, slotId: string): EntryLog {
  return {
    slotId,
    exerciseId: exercise.id,
    restSec: DEFAULT_SLOT.restSec,
    kind: 'free',
    label: 'Hinzugefügt – trag ein, was du machst',
    lastSummary: null,
    sets: Array.from({ length: 3 }, () => ({
      targetReps: null, targetWeight: null, targetSec: null, reps: null, weight: null, sec: null, done: false,
    })),
  };
}

/** Gehört der Eintrag nicht zu einem Slot des Trainingstags? */
export function isAdded(entry: EntryLog, template: Template | undefined): boolean {
  return !template || !template.slots.some((s) => s.id === entry.slotId);
}

/** Hinzugefügte Übungen, für die nach dem Speichern gefragt wird (eine pro Übung, in Reihenfolge). */
export function planQuestions(session: Session, template: Template | undefined): EntryLog[] {
  if (!template || template.kind === 'cardio') return [];
  const seen = new Set(template.slots.map((s) => s.exerciseId));
  const out: EntryLog[] = [];
  for (const e of session.entries) {
    if (!isAdded(e, template) || !e.sets.some((s) => s.done) || seen.has(e.exerciseId)) continue;
    seen.add(e.exerciseId);
    out.push(e);
  }
  return out;
}

/** Neuer Slot aus einem hinzugefügten Eintrag; gleiche id, damit das Training als „letztes Mal“ zählt. */
export function slotFromEntry(entry: EntryLog, type: ExType): Slot {
  const firstDone = entry.sets.find((s) => s.done);
  return {
    id: entry.slotId,
    exerciseId: entry.exerciseId,
    ...DEFAULT_SLOT,
    startWeight: type === 'weighted' ? (firstDone?.weight ?? 0) : DEFAULT_SLOT.startWeight,
  };
}

/** Slot ans Ende des Trainingstags; unverändert, wenn id oder Übung schon drin sind. */
export function appendSlot(template: Template, slot: Slot): Template {
  if (template.slots.some((s) => s.id === slot.id || s.exerciseId === slot.exerciseId)) return template;
  return { ...template, slots: [...template.slots, slot] };
}

import type { EntryLog, ExType, Slot, SuggestKind } from './db';
import { fmtKg } from './util';

export interface Suggestion {
  kind: SuggestKind;
  weight: number | null;
  reps: (number | null)[];
  sec: (number | null)[];
  label: string;
}

const EPS = 1e-9;

/** Wurde jedes Satz-Ziel erreicht (Wdh. und Gewicht)? */
export function entrySucceeded(e: EntryLog): boolean {
  const withTarget = e.sets.filter((s) => s.targetReps != null);
  if (!withTarget.length) return false;
  return withTarget.every(
    (s) => s.done && (s.reps ?? 0) >= (s.targetReps ?? 0) && (s.weight ?? 0) >= (s.targetWeight ?? 0) - EPS,
  );
}

function roundTo(x: number, step: number): number {
  const r = step > 0 ? Math.round(x / step) * step : x;
  return Math.round(r * 100) / 100;
}

/**
 * Doppelte Progression, Wiederholung für Wiederholung:
 *  4,4,4,4 → 5,4,4,4 → 5,5,4,4 → … → 5,5,5,5 → 6,5,5,5 → … → 6,6,6,6 → +Gewicht, zurück auf 4,4,4,4.
 *  Nicht geschafft → gleiches Ziel. 3× in Folge auf demselben Gewicht nicht geschafft → −10 %.
 *
 * @param history Einträge dieser Übung (dieses Trainingstags), neuester zuerst, nur abgeschlossene Trainings.
 */
export function suggest(slot: Slot, type: ExType, history: EntryLog[]): Suggestion {
  const n = slot.sets;
  const fill = <T,>(v: T): T[] => Array.from({ length: n }, () => v);
  const weighted = type === 'weighted';
  const last = history[0];

  // Freie Übungen (Skills, Haltezeiten): Werte vom letzten Mal vorschlagen, nichts bewerten.
  if (type === 'hold' || !slot.progression) {
    if (!last) {
      return {
        kind: 'free',
        weight: weighted ? slot.startWeight : null,
        reps: fill(type === 'hold' ? null : slot.repMin),
        sec: fill(null),
        label: 'Frei – trag ein, was du machst',
      };
    }
    const done = last.sets.filter((s) => s.done);
    const src = done.length ? done : last.sets;
    const pick = (i: number) => src[Math.min(i, src.length - 1)];
    return {
      kind: 'free',
      weight: weighted ? (pick(0)?.weight ?? slot.startWeight) : null,
      reps: Array.from({ length: n }, (_, i) => pick(i)?.reps ?? null),
      sec: Array.from({ length: n }, (_, i) => pick(i)?.sec ?? null),
      label: 'Frei – Werte vom letzten Mal',
    };
  }

  if (!last) {
    return {
      kind: 'first',
      weight: weighted ? slot.startWeight : null,
      reps: fill(slot.repMin),
      sec: fill(null),
      label: weighted ? 'Erstes Mal – Gewicht prüfen und anpassen' : 'Erstes Mal – Startwerte',
    };
  }

  const lastTargetW = last.sets[0]?.targetWeight ?? null;

  if (entrySucceeded(last)) {
    const firstDone = last.sets.find((s) => s.done);
    const baseW = weighted ? (firstDone?.weight ?? lastTargetW ?? slot.startWeight) : null;
    const reps = Array.from({ length: n }, (_, i) => {
      const s = last.sets[i];
      if (!s) return slot.repMin;
      return Math.min(slot.repMax, Math.max(s.targetReps ?? 0, s.reps ?? 0, slot.repMin));
    });

    if (reps.every((r) => r >= slot.repMax)) {
      if (weighted) {
        const w = Math.round(((baseW ?? 0) + slot.increment) * 100) / 100;
        return {
          kind: 'up-weight',
          weight: w,
          reps: fill(slot.repMin),
          sec: fill(null),
          label: `Alles geschafft → +${fmtKg(slot.increment)} kg, zurück auf ${slot.repMin} Wdh.`,
        };
      }
      return {
        kind: 'maxed',
        weight: null,
        reps,
        sec: fill(null),
        label: 'Obergrenze erreicht – schwerere Variante oder Gewicht dazu',
      };
    }

    // +1 beim ersten Satz mit den wenigsten Wdh. → 5,4,4,4 → 5,5,4,4 → 5,5,5,4 …
    const min = Math.min(...reps);
    const idx = reps.indexOf(min);
    reps[idx]++;
    return { kind: 'up-reps', weight: baseW, reps, sec: fill(null), label: `+1 Wdh. in Satz ${idx + 1}` };
  }

  // Nicht geschafft: Fehlversuche in Folge auf demselben Zielgewicht zählen.
  let fails = 0;
  for (const e of history) {
    if (entrySucceeded(e)) break;
    if (weighted && (e.sets[0]?.targetWeight ?? null) !== lastTargetW) break;
    fails++;
  }

  if (weighted && fails >= 3) {
    const w = Math.max(0, roundTo((lastTargetW ?? slot.startWeight) * 0.9, slot.increment));
    return {
      kind: 'deload',
      weight: w,
      reps: fill(slot.repMin),
      sec: fill(null),
      label: `3× in Folge nicht geschafft → ${fmtKg(w)} kg (≈ −10 %), neu aufbauen`,
    };
  }

  return {
    kind: 'repeat',
    weight: weighted ? (lastTargetW ?? slot.startWeight) : null,
    reps: Array.from({ length: n }, (_, i) => last.sets[i]?.targetReps ?? slot.repMin),
    sec: fill(null),
    label: fails >= 2 ? `Gleiches Ziel, ${fails + 1}. Versuch` : 'Letztes Mal knapp verpasst – gleiches Ziel',
  };
}

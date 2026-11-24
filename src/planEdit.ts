import type { Exercise, ExType, Slot } from './db';
import type { Suggestion } from './progression';
import { DEFAULT_SLOT } from './addedExercise';
import { fmtAddedKg, fmtKg } from './util';

/** Neue Liste mit dem Eintrag von `from` an Stelle `to`; ungültige Indizes ergeben eine Kopie. */
export function moveSlot(slots: Slot[], from: number, to: number): Slot[] {
  const out = [...slots];
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < slots.length;
  if (!valid(from) || !valid(to) || from === to) return out;
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}

/** Zielindex einer um `dy` px gezogenen Zeile: Sie rückt weiter, sobald ihre Mitte die Mitte des Nachbarn kreuzt. */
export function dropIndex(from: number, dy: number, heights: number[]): number {
  const mids: number[] = [];
  let top = 0;
  for (const h of heights) {
    mids.push(top + h / 2);
    top += h;
  }
  const centre = mids[from] + dy;
  let to = from;
  while (to < heights.length - 1 && centre > mids[to + 1]) to++;
  while (to > 0 && centre < mids[to - 1]) to--;
  return to;
}

/** Kurzinfo einer Übung im Plan, z. B. "4 × 4–8 · +2,5 kg · 3 min". */
export function slotSummary(slot: Slot, ex?: Exercise): string {
  if (!ex) return '';
  const judged = slot.progression && ex.type !== 'hold';
  const main = judged
    ? `${slot.sets} × ${slot.repMin}–${slot.repMax}${ex.type === 'weighted' ? ` · +${fmtKg(slot.increment)} kg` : ''}`
    : `${slot.sets} Sätze · frei`;
  return slot.restSec > 0 ? `${main} · ${fmtKg(slot.restSec / 60)} min` : main;
}

/** Vorschau-Zeile für das nächste Training, z. B. "Nächstes Mal: 5, 4, 4, 4 · +25 kg". */
export function previewText(s: Suggestion, type: ExType): string {
  const nums = (type === 'hold' ? s.sec : s.reps).filter((v): v is number => v != null);
  const values = nums.length ? nums.join(', ') + (type === 'hold' ? ' s' : '') : '';
  const weight = type === 'weighted' ? fmtAddedKg(s.weight) : '';
  if (s.kind !== 'free') return `Nächstes Mal: ${values}${weight ? ` · ${weight}` : ''}`;
  if (!values) return 'Nächstes Mal: frei';
  return `Nächstes Mal: frei · zuletzt ${values}${weight ? ` ${weight}` : ''}`;
}

/** Werte vor dem Speichern begrenzen; Unsinn (NaN) wird zum Standardwert. */
export function cleanSlot(slot: Slot): Slot {
  const num = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const repMin = Math.max(1, Math.round(num(slot.repMin, DEFAULT_SLOT.repMin)));
  return {
    ...slot,
    sets: Math.max(1, Math.round(num(slot.sets, DEFAULT_SLOT.sets))),
    repMin,
    repMax: Math.max(repMin, Math.round(num(slot.repMax, DEFAULT_SLOT.repMax))),
    increment: Math.max(0, num(slot.increment, DEFAULT_SLOT.increment)),
    startWeight: Math.max(0, num(slot.startWeight, DEFAULT_SLOT.startWeight)),
    restSec: Math.max(0, Math.round(num(slot.restSec, DEFAULT_SLOT.restSec))),
  };
}

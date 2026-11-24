/** Wischen zwischen den Tabs: reine Entscheidungen ohne DOM. Schwellen wie beim Kalender. */
import { touchSettle } from './calendarGesture';

export const RUBBER_FRACTION = 0.12;

/** Nachbar von current in order (dir 1 = rechts in der Leiste, -1 = links) oder null am Rand. */
export function adjacentTab<T>(order: readonly T[], current: T, dir: 1 | -1): T | null {
  const i = order.indexOf(current);
  if (i < 0) return null;
  return order[i + dir] ?? null;
}

/** 1 = nächster Tab (Wischen nach links), -1 = vorheriger (nach rechts), 0 = zurückfedern. vx in px/ms. */
export function swipeStep(dx: number, vx: number, width: number): 1 | -1 | 0 {
  if (dx === 0) return 0;
  const s = touchSettle(dx, vx, width);
  return s === 0 ? 0 : s > 0 ? -1 : 1;
}

/** Gedämpfter Versatz ohne Nachbar-Tab: gleiches Vorzeichen, betrag < |dx|, höchstens RUBBER_FRACTION der Breite. */
export function rubberBand(dx: number, width: number): number {
  if (dx === 0) return 0;
  const max = RUBBER_FRACTION * width;
  return Math.sign(dx) * max * (1 - Math.exp(-Math.abs(dx) / max));
}

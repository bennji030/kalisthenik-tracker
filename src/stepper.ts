export const REPS_STEP = 1;
export const SEC_STEP = 5;
const DEFAULT_WEIGHT_STEP = 2.5;

/** Wert um delta ändern: null zählt als 0, nie unter 0, ohne Float-Rauschen. */
export function stepValue(value: number | null, delta: number): number {
  return Math.max(0, Math.round(((value ?? 0) + delta) * 100) / 100);
}

/** kg-Schritt aus dem Slot-Increment; 2,5 kg bei fehlendem oder ungültigem Wert. */
export function weightStep(increment: number | null | undefined): number {
  return typeof increment === 'number' && Number.isFinite(increment) && increment > 0 ? increment : DEFAULT_WEIGHT_STEP;
}

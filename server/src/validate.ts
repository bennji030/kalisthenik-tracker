import type { DayValues } from './store';

export const MAX_BODY_BYTES = 1024;

/** A real calendar date in the form YYYY-MM-DD. */
export function isDate(value: string | null | undefined): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const LIMITS: Record<keyof DayValues, { max: number; integer: boolean }> = {
  steps: { max: 200000, integer: true },
  kcal: { max: 20000, integer: false },
  proteinG: { max: 1000, integer: false },
};

function isValue(value: unknown, max: number, integer: boolean): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}

/** Parses a PUT body. Returns the values or null when anything is wrong. */
export function parseDayValues(text: string): DayValues | null {
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  const values: DayValues = {};
  for (const key of keys) {
    if (!Object.hasOwn(LIMITS, key)) return null;
    const field = key as keyof DayValues;
    const { max, integer } = LIMITS[field];
    const value = record[key];
    if (!isValue(value, max, integer)) return null;
    values[field] = value;
  }
  return values;
}

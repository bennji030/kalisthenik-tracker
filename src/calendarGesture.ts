/** Wischgesten des Trainingskalenders: reine Entscheidungen ohne DOM. */

export const SLOP = 10;
export const AXIS_RATIO = 1.5;
export const EDGE = 24;
export const COMMIT_FRACTION = 0.3;
export const COMMIT_VELOCITY = 0.4;

// Feinere Werte für Touch (px bzw. px/ms); TOP_SLACK: so weit darf die Kalender-Oberkante über dem Viewport liegen.
export const TOUCH_SLOP = 7;
export const TOUCH_AXIS_RATIO = 1.2;
export const TOUCH_COMMIT_FRACTION = 0.2;
export const TOUCH_COMMIT_VELOCITY = 0.3;
export const TOP_SLACK = 40;

/** null = noch unentschieden, 'none' = diagonal (keine Geste). */
export function gestureAxis(dx: number, dy: number): 'x' | 'y' | 'none' | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < SLOP && ay < SLOP) return null;
  if (ax > AXIS_RATIO * ay) return 'x';
  if (ay > AXIS_RATIO * ax) return 'y';
  return 'none';
}

/** Am linken Rand beginnt die iOS-Zurück-Geste. */
export function startAllowed(startX: number): boolean {
  return startX >= EDGE;
}

/** Nur auf ungescrollter Seite: eingeklappt runterziehen, aufgeklappt hochziehen. */
export function verticalAllowed(expanded: boolean, dy: number, scrollY: number): boolean {
  if (scrollY > 0) return false;
  return expanded ? dy < 0 : dy > 0;
}

/** 1 / -1 = in Richtung von delta einrasten, 0 = zurückfedern. velocity in px/ms. */
export function settle(delta: number, velocity: number, range: number): 1 | -1 | 0 {
  const dir = delta > 0 ? 1 : -1;
  if (Math.abs(delta) >= COMMIT_FRACTION * range) return dir;
  if (Math.abs(velocity) >= COMMIT_VELOCITY && Math.sign(velocity) === Math.sign(delta) && Math.abs(delta) >= SLOP) return dir;
  return 0;
}

/** Wie gestureAxis, mit den Touch-Werten. */
export function touchAxis(dx: number, dy: number): 'x' | 'y' | 'none' | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < TOUCH_SLOP && ay < TOUCH_SLOP) return null;
  if (ax > TOUCH_AXIS_RATIO * ay) return 'x';
  if (ay > TOUCH_AXIS_RATIO * ax) return 'y';
  return 'none';
}

/** calTop = getBoundingClientRect().top des Kalenders; eingeklappt runterziehen, aufgeklappt hochziehen. */
export function verticalAllowedAt(expanded: boolean, dy: number, calTop: number): boolean {
  if (calTop < -TOP_SLACK) return false;
  return expanded ? dy < 0 : dy > 0;
}

/** Wie settle, mit den Touch-Werten. */
export function touchSettle(delta: number, velocity: number, range: number): 1 | -1 | 0 {
  const dir = delta > 0 ? 1 : -1;
  if (Math.abs(delta) >= TOUCH_COMMIT_FRACTION * range) return dir;
  if (Math.abs(velocity) >= TOUCH_COMMIT_VELOCITY && Math.sign(velocity) === Math.sign(delta) && Math.abs(delta) >= TOUCH_SLOP) return dir;
  return 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Tages-Key (YYYY-MM-DD) n Wochen später (negativ: früher), gleicher Wochentag. */
export function shiftWeek(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const r = new Date(y, m - 1, d + 7 * n);
  return `${r.getFullYear()}-${pad(r.getMonth() + 1)}-${pad(r.getDate())}`;
}

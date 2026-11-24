import { describe, expect, it } from 'vitest';
import { gestureAxis, settle, shiftWeek, startAllowed, verticalAllowed } from './calendarGesture';

describe('gestureAxis', () => {
  it('is undecided below the slop', () => {
    expect(gestureAxis(0, 0)).toBeNull();
    expect(gestureAxis(9, -9)).toBeNull();
  });
  it('detects x and y', () => {
    expect(gestureAxis(20, 5)).toBe('x');
    expect(gestureAxis(-30, 10)).toBe('x');
    expect(gestureAxis(4, 20)).toBe('y');
    expect(gestureAxis(-4, -40)).toBe('y');
    expect(gestureAxis(0, 10)).toBe('y');
  });
  it('treats diagonals as none', () => {
    expect(gestureAxis(20, 20)).toBe('none');
    expect(gestureAxis(30, 20)).toBe('none');
    expect(gestureAxis(-20, 30)).toBe('none');
  });
});

describe('startAllowed', () => {
  it('rejects the left edge', () => {
    expect(startAllowed(0)).toBe(false);
    expect(startAllowed(23)).toBe(false);
    expect(startAllowed(24)).toBe(true);
    expect(startAllowed(200)).toBe(true);
  });
});

describe('verticalAllowed', () => {
  it('collapsed allows only pulling down', () => {
    expect(verticalAllowed(false, 30, 0)).toBe(true);
    expect(verticalAllowed(false, -30, 0)).toBe(false);
  });
  it('expanded allows only pulling up', () => {
    expect(verticalAllowed(true, -30, 0)).toBe(true);
    expect(verticalAllowed(true, 30, 0)).toBe(false);
  });
  it('is false when the page is scrolled', () => {
    expect(verticalAllowed(false, 30, 1)).toBe(false);
    expect(verticalAllowed(true, -30, 120)).toBe(false);
  });
});

describe('settle', () => {
  it('commits by distance', () => {
    expect(settle(60, 0, 200)).toBe(1);
    expect(settle(-60, 0, 200)).toBe(-1);
  });
  it('commits by velocity', () => {
    expect(settle(20, 0.5, 200)).toBe(1);
    expect(settle(-20, -0.5, 200)).toBe(-1);
  });
  it('ignores velocity against the drag direction', () => {
    expect(settle(20, -0.9, 200)).toBe(0);
    expect(settle(-20, 0.9, 200)).toBe(0);
  });
  it('springs back when too short or slow', () => {
    expect(settle(59, 0.1, 200)).toBe(0);
    expect(settle(5, 2, 200)).toBe(0);
  });
});

describe('shiftWeek', () => {
  it('moves across a month end', () => {
    expect(shiftWeek('2026-05-27', 1)).toBe('2026-06-03');
    expect(shiftWeek('2026-06-03', -1)).toBe('2026-05-27');
  });
  it('moves across a year end', () => {
    expect(shiftWeek('2026-12-30', 1)).toBe('2027-01-06');
    expect(shiftWeek('2027-01-02', -1)).toBe('2026-12-26');
  });
  it('is stable across DST changes', () => {
    expect(shiftWeek('2026-03-26', 1)).toBe('2026-04-02');
    expect(shiftWeek('2026-04-02', -1)).toBe('2026-03-26');
    expect(shiftWeek('2026-10-22', 1)).toBe('2026-10-29');
    expect(shiftWeek('2026-10-29', -1)).toBe('2026-10-22');
  });
  it('moves several weeks', () => {
    expect(shiftWeek('2026-03-01', 4)).toBe('2026-03-29');
  });
});

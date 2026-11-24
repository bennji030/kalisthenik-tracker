import { describe, expect, it } from 'vitest';
import { touchAxis, touchSettle, verticalAllowedAt } from './calendarGesture';

describe('touchAxis', () => {
  it('is undecided below 7 px', () => {
    expect(touchAxis(6, 6)).toBeNull();
    expect(touchAxis(0, -6)).toBeNull();
  });
  it('decides by ratio 1.2, strictly greater', () => {
    expect(touchAxis(10, -11)).toBe('none');
    expect(touchAxis(13, -10)).toBe('x');
    expect(touchAxis(12, -10)).toBe('none');
    expect(touchAxis(3, 8)).toBe('y');
  });
});

describe('verticalAllowedAt', () => {
  it('allows pulling up when expanded while the top is visible', () => {
    for (const top of [0, -20, -40]) expect(verticalAllowedAt(true, -10, top)).toBe(true);
  });
  it('rejects when the calendar is scrolled too far away', () => {
    expect(verticalAllowedAt(true, -10, -41)).toBe(false);
    expect(verticalAllowedAt(false, 10, -41)).toBe(false);
  });
  it('rejects the wrong direction', () => {
    expect(verticalAllowedAt(true, 10, 0)).toBe(false);
    expect(verticalAllowedAt(false, -10, 0)).toBe(false);
  });
  it('allows pulling down when collapsed', () => {
    expect(verticalAllowedAt(false, 10, 0)).toBe(true);
  });
});

describe('touchSettle', () => {
  it('commits at 20 % of the range', () => {
    expect(touchSettle(20, 0, 100)).toBe(1);
    expect(touchSettle(-20, 0, 100)).toBe(-1);
  });
  it('springs back just below', () => {
    expect(touchSettle(19, 0, 100)).toBe(0);
  });
  it('commits by velocity in the drag direction', () => {
    expect(touchSettle(8, 0.3, 100)).toBe(1);
    expect(touchSettle(-8, -0.3, 100)).toBe(-1);
  });
  it('needs 7 px for the velocity rule', () => {
    expect(touchSettle(6, 0.5, 100)).toBe(0);
  });
  it('ignores velocity against the drag', () => {
    expect(touchSettle(10, -0.5, 100)).toBe(0);
  });
});

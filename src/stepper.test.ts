import { describe, expect, it } from 'vitest';
import { REPS_STEP, SEC_STEP, stepValue, weightStep } from './stepper';

describe('stepValue', () => {
  it('steps reps', () => {
    expect(stepValue(8, REPS_STEP)).toBe(9);
    expect(stepValue(9, -REPS_STEP)).toBe(8);
  });
  it('never goes below 0', () => {
    expect(stepValue(0, -1)).toBe(0);
    expect(stepValue(null, -1)).toBe(0);
    expect(stepValue(1.25, -2.5)).toBe(0);
    expect(stepValue(3, -SEC_STEP)).toBe(0);
  });
  it('counts null as 0', () => {
    expect(stepValue(null, 1)).toBe(1);
  });
  it('steps weight without float noise', () => {
    expect(stepValue(20, 2.5)).toBe(22.5);
    let w: number | null = 0;
    for (let i = 0; i < 3; i++) w = stepValue(w, 1.25);
    expect(w).toBe(3.75);
    expect(stepValue(0.1, 0.2)).toBe(0.3);
  });
  it('steps seconds', () => {
    expect(stepValue(30, SEC_STEP)).toBe(35);
    expect(stepValue(35, -SEC_STEP)).toBe(30);
  });
});

describe('weightStep', () => {
  it('uses a valid increment', () => {
    expect(weightStep(2.5)).toBe(2.5);
    expect(weightStep(1.25)).toBe(1.25);
  });
  it('falls back to 2.5', () => {
    expect(weightStep(0)).toBe(2.5);
    expect(weightStep(-1)).toBe(2.5);
    expect(weightStep(undefined)).toBe(2.5);
    expect(weightStep(null)).toBe(2.5);
    expect(weightStep(NaN)).toBe(2.5);
  });
});

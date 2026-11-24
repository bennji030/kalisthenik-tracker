import { describe, expect, it } from 'vitest';
import { adjacentTab, rubberBand, swipeStep } from './tabSwipe';

const order = ['home', 'training', 'history', 'plan'] as const;

describe('adjacentTab', () => {
  it('middle tab has both neighbours', () => {
    expect(adjacentTab(order, 'training', 1)).toBe('history');
    expect(adjacentTab(order, 'training', -1)).toBe('home');
  });
  it('first tab has no previous', () => {
    expect(adjacentTab(order, 'home', -1)).toBeNull();
    expect(adjacentTab(order, 'home', 1)).toBe('training');
  });
  it('last tab has no next', () => {
    expect(adjacentTab(order, 'plan', 1)).toBeNull();
    expect(adjacentTab(order, 'plan', -1)).toBe('history');
  });
});

describe('swipeStep', () => {
  it('commits by distance', () => {
    expect(swipeStep(-100, 0, 375)).toBe(1);
    expect(swipeStep(100, 0, 375)).toBe(-1);
  });
  it('commits by velocity', () => {
    expect(swipeStep(-30, -0.5, 375)).toBe(1);
    expect(swipeStep(30, 0.5, 375)).toBe(-1);
  });
  it('ignores velocity against the drag', () => {
    expect(swipeStep(-30, 0.5, 375)).toBe(0);
  });
  it('springs back when too short', () => {
    expect(swipeStep(-30, -0.1, 375)).toBe(0);
    expect(swipeStep(0, 0, 375)).toBe(0);
  });
});

describe('rubberBand', () => {
  it('keeps the sign and is 0 for 0', () => {
    expect(rubberBand(50, 375)).toBeGreaterThan(0);
    expect(rubberBand(-50, 375)).toBeLessThan(0);
    expect(rubberBand(0, 375)).toBe(0);
  });
  it('damps', () => {
    for (const dx of [1, 20, 100, -300]) expect(Math.abs(rubberBand(dx, 375))).toBeLessThan(Math.abs(dx));
  });
  it('stays within 15 % of the width', () => {
    for (const dx of [10, 200, 5000, -5000]) expect(Math.abs(rubberBand(dx, 375))).toBeLessThanOrEqual(0.15 * 375);
  });
});

import { describe, expect, it } from 'vitest';
import { weightRangePoints } from './weightRange';
import { dayKey } from './weight';

const now = new Date(2025, 5, 15, 12).getTime();
const ago = (n: number) => dayKey(new Date(2025, 5, 15 - n).getTime());
const e = (n: number, kg = 80) => ({ date: ago(n), kg });

describe('weightRangePoints', () => {
  it('30 days: day 29 in, day 30 out', () => {
    const r = weightRangePoints([e(30), e(29), e(0)], 30, now);
    expect(r.map((p) => p.date)).toEqual([ago(29), ago(0)]);
  });
  it('90 days boundary', () => {
    const r = weightRangePoints([e(90), e(89), e(0)], 90, now);
    expect(r.map((p) => p.date)).toEqual([ago(89), ago(0)]);
  });
  it('all returns every entry', () => {
    expect(weightRangePoints([e(500), e(100), e(0)], 'all', now)).toHaveLength(3);
  });
  it('first average includes older entries', () => {
    const r = weightRangePoints([e(31, 70), e(29, 80)], 30, now);
    expect(r).toHaveLength(1);
    expect(r[0].avg).toBe(75);
  });
  it('empty input', () => {
    expect(weightRangePoints([], 30, now)).toEqual([]);
  });
  it('sorts unsorted input', () => {
    const r = weightRangePoints([e(0), e(10), e(5)], 30, now);
    expect(r.map((p) => p.date)).toEqual([ago(10), ago(5), ago(0)]);
  });
  it('boundary across a year change', () => {
    const jan = new Date(2025, 0, 10, 12).getTime();
    const r = weightRangePoints([{ date: '2024-12-11', kg: 80 }, { date: '2024-12-12', kg: 80 }], 30, jan);
    expect(r.map((p) => p.date)).toEqual(['2024-12-12']);
  });
});

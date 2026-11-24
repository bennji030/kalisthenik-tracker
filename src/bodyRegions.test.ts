import { describe, expect, it } from 'vitest';
import { BODY_REGIONS, muscleOfRegion } from './bodyRegions';
import { MUSCLES } from './muscles';
import { FRONT_MUSCLES } from './vendor/bodyMuscles/muscles.front';
import { BACK_MUSCLES } from './vendor/bodyMuscles/muscles.back';

describe('bodyRegions', () => {
  it('every muscle has at least one region', () => {
    for (const m of MUSCLES) expect(BODY_REGIONS[m.id].length).toBeGreaterThan(0);
  });

  it('every mapped id exists upstream', () => {
    const known = new Set([...FRONT_MUSCLES, ...BACK_MUSCLES].map((r) => r.id));
    for (const ids of Object.values(BODY_REGIONS)) for (const id of ids) expect(known.has(id), id).toBe(true);
  });

  it('no id belongs to two groups', () => {
    const all = Object.values(BODY_REGIONS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('looks up the owning group', () => {
    expect(muscleOfRegion('biceps-left')).toBe('biceps');
    expect(muscleOfRegion('traps-mid-right')).toBe('lats');
    expect(muscleOfRegion('head')).toBeUndefined();
  });
});

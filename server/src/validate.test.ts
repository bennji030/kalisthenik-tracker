import { describe, expect, it } from 'vitest';
import { isDate, parseDayValues } from './validate';

describe('isDate', () => {
  it('accepts real calendar dates', () => {
    expect(isDate('2026-11-24')).toBe(true);
    expect(isDate('2028-02-29')).toBe(true);
  });
  it('rejects the wrong format', () => {
    for (const v of ['2026-1-24', '26-11-24', '2026/11/24', '2026-11-24T00:00', ' 2026-11-24', '', null, undefined]) {
      expect(isDate(v)).toBe(false);
    }
  });
  it('rejects impossible dates', () => {
    for (const v of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00']) {
      expect(isDate(v)).toBe(false);
    }
  });
});

describe('parseDayValues', () => {
  it('accepts all three fields and subsets', () => {
    expect(parseDayValues('{"steps":8123,"kcal":2010.5,"proteinG":150}')).toEqual({ steps: 8123, kcal: 2010.5, proteinG: 150 });
    expect(parseDayValues('{"kcal":0}')).toEqual({ kcal: 0 });
    expect(parseDayValues('{"steps":200000,"kcal":20000,"proteinG":1000}')).toEqual({ steps: 200000, kcal: 20000, proteinG: 1000 });
  });
  it('checks steps: integer 0 to 200000', () => {
    expect(parseDayValues('{"steps":-1}')).toBeNull();
    expect(parseDayValues('{"steps":1.5}')).toBeNull();
    expect(parseDayValues('{"steps":200001}')).toBeNull();
    expect(parseDayValues('{"steps":"100"}')).toBeNull();
    expect(parseDayValues('{"steps":null}')).toBeNull();
  });
  it('checks kcal: number 0 to 20000', () => {
    expect(parseDayValues('{"kcal":12.25}')).toEqual({ kcal: 12.25 });
    expect(parseDayValues('{"kcal":-0.1}')).toBeNull();
    expect(parseDayValues('{"kcal":20000.1}')).toBeNull();
    expect(parseDayValues('{"kcal":"2000"}')).toBeNull();
    expect(parseDayValues('{"kcal":[2000]}')).toBeNull();
    expect(parseDayValues('{"kcal":1e999}')).toBeNull();
  });
  it('checks proteinG: number 0 to 1000', () => {
    expect(parseDayValues('{"proteinG":99.9}')).toEqual({ proteinG: 99.9 });
    expect(parseDayValues('{"proteinG":-5}')).toBeNull();
    expect(parseDayValues('{"proteinG":1001}')).toBeNull();
    expect(parseDayValues('{"proteinG":NaN}')).toBeNull();
    expect(parseDayValues('{"proteinG":true}')).toBeNull();
  });
  it('rejects unknown keys and empty objects', () => {
    expect(parseDayValues('{"foo":1}')).toBeNull();
    expect(parseDayValues('{"steps":1,"foo":1}')).toBeNull();
    expect(parseDayValues('{"__proto__":{"steps":1}}')).toBeNull();
    expect(parseDayValues('{}')).toBeNull();
  });
  it('rejects non-objects and invalid JSON', () => {
    for (const v of ['[]', '[{"steps":1}]', 'null', '5', '"steps"', '', '{steps:1}', '{"steps":1']) {
      expect(parseDayValues(v)).toBeNull();
    }
  });
  it('rejects bodies over 1024 bytes', () => {
    const padded = `{"steps":1${' '.repeat(1100)}}`;
    expect(parseDayValues(padded)).toBeNull();
    const exact = `{"steps":1${' '.repeat(1024 - 11)}}`;
    expect(new TextEncoder().encode(exact).length).toBe(1024);
    expect(parseDayValues(exact)).toEqual({ steps: 1 });
  });
});

import { describe, expect, it } from 'vitest';
import { parseThemePref, resolveTheme } from './theme';

describe('parseThemePref', () => {
  it('keeps valid values', () => {
    expect(parseThemePref('dark')).toBe('dark');
    expect(parseThemePref('light')).toBe('light');
    expect(parseThemePref('system')).toBe('system');
  });
  it('falls back to dark', () => {
    for (const v of [undefined, null, 'blue', '', 1, {}, ['light'], '"><script>']) expect(parseThemePref(v)).toBe('dark');
  });
});

describe('resolveTheme', () => {
  it('resolves every combination', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('light');
  });
});

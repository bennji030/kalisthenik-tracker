export type ThemePref = 'dark' | 'light' | 'system';

export const THEME_BG = { dark: '#0e0f12', light: '#f2f2f7' } as const;

export function parseThemePref(value: unknown): ThemePref {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'dark';
}

export function resolveTheme(pref: ThemePref, systemLight: boolean): 'dark' | 'light' {
  if (pref === 'system') return systemLight ? 'light' : 'dark';
  return pref;
}

export function applyTheme(resolved: 'dark' | 'light') {
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[resolved]);
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', resolved === 'dark' ? 'black-translucent' : 'default');
}

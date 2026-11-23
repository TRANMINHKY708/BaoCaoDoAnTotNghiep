import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'mkeai-theme';
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null; // private mode / blocked storage: fall back to the system preference
  }
}

function preferred(): Theme {
  return (
    stored() ??
    (typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light')
  );
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* the choice still applies for this page view */
    }
  }
  listeners.forEach((listener) => listener());
}

/** Call once before the first render so the page never flashes the wrong theme. */
export function initTheme() {
  applyTheme(preferred());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme);
  const toggle = useCallback(
    () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true),
    [],
  );
  return { theme, toggle };
}

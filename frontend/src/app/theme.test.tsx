import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, currentTheme, initTheme, useTheme } from './theme';

function Toggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" aria-pressed={theme === 'dark'} onClick={toggle}>
      {theme}
    </button>
  );
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
});

describe('night mode', () => {
  it('toggles the root theme attribute and remembers the choice', async () => {
    applyTheme('light');
    render(<Toggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('light');
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('mkeai-theme')).toBe('dark');
    await userEvent.click(button);
    expect(currentTheme()).toBe('light');
    expect(window.localStorage.getItem('mkeai-theme')).toBe('light');
  });

  it('uses a stored choice first, then the system preference', () => {
    window.localStorage.setItem('mkeai-theme', 'dark');
    initTheme();
    expect(currentTheme()).toBe('dark');
    window.localStorage.clear();
    // jsdom has no matchMedia: install a stub for the system preference.
    const media = vi.fn(() => ({ matches: true }) as MediaQueryList);
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: media });
    try {
      initTheme();
      expect(media).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(currentTheme()).toBe('dark');
      media.mockReturnValue({ matches: false } as MediaQueryList);
      initTheme();
      expect(currentTheme()).toBe('light');
    } finally {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  it('still switches when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    act(() => applyTheme('dark', true));
    expect(currentTheme()).toBe('dark');
    expect(() => initTheme()).not.toThrow();
  });
});

/**
 * ThemeContext.jsx — Global theme state provider
 *
 * Manages the app-wide light/dark/system theme preference.
 * Applies the 'dark' class to the <html> element so Tailwind's
 * dark: variant utilities take effect across the entire app.
 *
 * Usage:
 *   Wrap <App /> with <ThemeProvider>
 *   Access via useTheme() → { theme, setTheme, isDark }
 *
 * Persistence: Saves preference to localStorage so it survives refresh.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/** Returns the effective mode ('light' | 'dark') given a preference */
function resolveTheme(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('ai-interview-theme') || 'light';
  });

  const isDark = resolveTheme(theme) === 'dark';

  /** Apply/remove the 'dark' class on <html> whenever theme changes */
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  /** Listen for OS preference changes when "system" is selected */
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Re-trigger the effect by forcing a re-render
      setThemeState('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('ai-interview-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

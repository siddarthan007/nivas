import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  toggleTheme: () => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'nivas-theme';
const ACCENT_STORAGE_KEY = 'nivas-accent';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'dark';
}

function getInitialAccent(): Accent {
  if (typeof window === 'undefined') return 'blue';
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY) as Accent | null;
    if (stored && ['blue', 'indigo', 'emerald', 'amber', 'rose', 'violet'].includes(stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'blue';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [accent, setAccentState] = useState<Accent>(getInitialAccent);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(
    getInitialTheme() === 'system' ? getSystemTheme() : (getInitialTheme() as 'light' | 'dark')
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  const applyTheme = useCallback((newTheme: Theme, newAccent: Accent) => {
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;

    // Enable transitions
    document.documentElement.setAttribute('data-theme-transition', 'true');
    setIsTransitioning(true);

    // Apply theme
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-accent', newAccent);

    // Disable transitions after animation completes
    const timeout = setTimeout(() => {
      document.documentElement.removeAttribute('data-theme-transition');
      setIsTransitioning(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, []);

  // Initial application
  useEffect(() => {
    applyTheme(theme, accent);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        applyTheme('system', accent);
      }
    };
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme, accent, applyTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch { /* storage unavailable */ }
    applyTheme(newTheme, accent);
  }, [accent, applyTheme]);

  const setAccent = useCallback((newAccent: Accent) => {
    setAccentState(newAccent);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, newAccent);
    } catch { /* storage unavailable */ }
    applyTheme(theme, newAccent);
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        accent,
        setTheme,
        setAccent,
        toggleTheme,
        isTransitioning,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

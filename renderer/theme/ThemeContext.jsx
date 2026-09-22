import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    // Load persisted theme and global appearance from backend
    async function loadTheme() {
      if (window.arcadiaAPI && window.arcadiaAPI.settings) {
        try {
          const all = await window.arcadiaAPI.settings.getAll();
          if (all.success && all.data) {
            const t = all.data.theme || 'dark';
            setThemeState(t);
            document.documentElement.setAttribute('data-theme', t);
            
            const scale = all.data.ui_scale || '100%';
            const zoomMap = { '90%': '0.9', '100%': '1', '110%': '1.1' };
            document.body.style.zoom = zoomMap[scale] || '1';
            
            const accent = all.data.accent_color || 'blue';
            document.documentElement.setAttribute('data-accent', accent);
          } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.style.zoom = '1';
            document.documentElement.setAttribute('data-accent', 'blue');
          }
        } catch {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
    loadTheme();
  }, []);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (window.arcadiaAPI && window.arcadiaAPI.settings) {
      try {
        await window.arcadiaAPI.settings.set('theme', newTheme);
      } catch (e) {
        console.warn('Failed to persist theme:', e);
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('vxp_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'dark'; // Dark por defecto según instrucciones
  });

  useEffect(() => {
    try {
      localStorage.setItem('vxp_theme', theme);
    } catch {
      // ignore
    }

    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light', 'light');
      root.classList.remove('theme-dark', 'dark');
      document.body.classList.add('theme-light', 'light');
      document.body.classList.remove('theme-dark', 'dark');
    } else {
      root.classList.add('theme-dark', 'dark');
      root.classList.remove('theme-light', 'light');
      document.body.classList.add('theme-dark', 'dark');
      document.body.classList.remove('theme-light', 'light');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

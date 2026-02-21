import { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  {
    id: 'magical',
    name: 'Magical Glow',
    emoji: '✨',
    desc: 'Dreamy soft gradients',
    swatches: ['#818CF8', '#C084FC', '#FCA5A5'],
    type: 'light',
  },
  {
    id: 'bedtime',
    name: 'Bedtime',
    emoji: '🌙',
    desc: 'Cozy night reading',
    swatches: ['#1E3A5F', '#1E293B', '#F59E0B'],
    type: 'dark',
  },
  {
    id: 'pixar',
    name: 'Pixar Bright',
    emoji: '🎨',
    desc: 'Vibrant & playful',
    swatches: ['#0EA5E9', '#EC4899', '#84CC16'],
    type: 'light',
  },
  {
    id: 'parchment',
    name: 'Parchment',
    emoji: '📖',
    desc: 'Classic storybook',
    swatches: ['#D4A96A', '#8B5E3C', '#F5EDD6'],
    type: 'light',
  },
];

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('storycraft_theme') || 'magical'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('storycraft_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
};

/**
 * AfrHub PWA - Theme Manager Hook
 * Manages theme selection, persistence, and CSS variable injection
 */

import { useState, useEffect, useCallback } from 'react';
import { ThemeName, getPalette, generateCSSVariables, ColorPalette } from './colorPalettes';
import { animationPresets, generateKeyframes, AnimationType } from './animations';

const THEME_STORAGE_KEY = 'afrhub_theme';
const ANIMATION_STORAGE_KEY = 'afrhub_animations_enabled';

interface ThemeManagerReturn {
  currentTheme: ThemeName;
  palette: ColorPalette;
  setTheme: (theme: ThemeName) => void;
  animationsEnabled: boolean;
  toggleAnimations: () => void;
  availableThemes: ThemeName[];
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeManager = (): ThemeManagerReturn => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('savanna');
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    const savedAnimations = localStorage.getItem(ANIMATION_STORAGE_KEY);
    
    if (savedTheme && getPalette(savedTheme)) {
      setCurrentTheme(savedTheme);
    }
    
    if (savedAnimations !== null) {
      setAnimationsEnabled(savedAnimations === 'true');
    }
    
    setIsInitialized(true);
  }, []);

  // Inject CSS variables when theme changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const palette = getPalette(currentTheme);
    const cssVariables = generateCSSVariables(palette);
    
    let styleElement = document.getElementById('theme-variables') as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'theme-variables';
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = cssVariables;
    
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme, isInitialized]);

  // Inject animation keyframes
  useEffect(() => {
    if (!isInitialized || !animationsEnabled) return;
    
    let animationStyleElement = document.getElementById('animation-keyframes') as HTMLStyleElement;
    
    if (!animationStyleElement) {
      animationStyleElement = document.createElement('style');
      animationStyleElement.id = 'animation-keyframes';
      document.head.appendChild(animationStyleElement);
    }
    
    const keyframes = Object.keys(animationPresets).map(type => 
      generateKeyframes(type as AnimationType)
    ).join('\n');
    
    animationStyleElement.textContent = keyframes;
    
    localStorage.setItem(ANIMATION_STORAGE_KEY, String(animationsEnabled));
  }, [animationsEnabled, isInitialized]);

  const setTheme = useCallback((theme: ThemeName) => {
    setCurrentTheme(theme);
  }, []);

  const toggleAnimations = useCallback(() => {
    setAnimationsEnabled(prev => !prev);
  }, []);

  const availableThemes: ThemeName[] = [
    'savanna', 'ocean', 'sunset', 'forest', 'market',
    'midnight', 'harmattan', 'carnival', 'royal', 'minimal'
  ];

  const palette = getPalette(currentTheme);

  const isDarkMode = currentTheme === 'midnight' || 
    (palette.background.dark === palette.background.light);

  const toggleDarkMode = useCallback(() => {
    if (isDarkMode) {
      setCurrentTheme('savanna');
    } else {
      setCurrentTheme('midnight');
    }
  }, [isDarkMode]);

  return {
    currentTheme,
    palette,
    setTheme,
    animationsEnabled,
    toggleAnimations,
    availableThemes,
    isDarkMode,
    toggleDarkMode
  };
};

// Theme Provider Component
import React from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}

export const ThemeContext = React.createContext<ReturnType<typeof useThemeManager> | null>(null);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultTheme = 'savanna' 
}) => {
  const themeManager = useThemeManager();
  
  return (
    <ThemeContext.Provider value={themeManager}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

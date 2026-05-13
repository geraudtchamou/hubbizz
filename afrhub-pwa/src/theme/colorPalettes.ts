/**
 * AfrHub PWA - Comprehensive Theme System
 * African-inspired color palettes, animations, and interaction patterns
 */

export type ThemeName = 
  | 'savanna'      // Warm earth tones (Default)
  | 'ocean'        // Coastal blues and teals
  | 'sunset'       // Vibrant oranges and purples
  | 'forest'       // Deep greens and browns
  | 'market'       // Bold, vibrant market colors
  | 'midnight'     // Dark mode optimized
  | 'harmattan'    // Soft, dusty neutrals
  | 'carnival'     // Festive, high-energy colors
  | 'royal'        // Rich purples and golds
  | 'minimal';     // Clean, professional grays

export interface ColorPalette {
  primary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string; // Main primary
    600: string;
    700: string;
    800: string;
    900: string;
  };
  secondary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string; // Main secondary
    600: string;
    700: string;
    800: string;
    900: string;
  };
  accent: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string; // Main accent
    600: string;
    700: string;
    800: string;
    900: string;
  };
  success: string;
  warning: string;
  error: string;
  info: string;
  background: {
    light: string;
    dark: string;
    paper: string;
    surface: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    inverse: string;
  };
  border: {
    light: string;
    medium: string;
    dark: string;
  };
}

export const palettes: Record<ThemeName, ColorPalette> = {
  savanna: {
    primary: {
      50: '#fef9f3', 100: '#fdf3e6', 200: '#fae7cd', 300: '#f7dbb4',
      400: '#f5cf9b', 500: '#f2c382', 600: '#efa75a', 700: '#ec8b32',
      800: '#e96f0a', 900: '#c95a06'
    },
    secondary: {
      50: '#f5f9f4', 100: '#ebf3e9', 200: '#d7e7d3', 300: '#c3dbc3',
      400: '#afcfa3', 500: '#9bc383', 600: '#7ba363', 700: '#5b8343',
      800: '#3b6323', 900: '#2b531b'
    },
    accent: {
      50: '#fff9f5', 100: '#fff3eb', 200: '#ffe7d7', 300: '#ffdcc3',
      400: '#ffd1af', 500: '#ffc59b', 600: '#ff9f6f', 700: '#ff7943',
      800: '#ff5317', 900: '#e6430d'
    },
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: { light: '#faf8f5', dark: '#1a1816', paper: '#ffffff', surface: '#f5f3f0' },
    text: { primary: '#1c1917', secondary: '#57534e', disabled: '#a8a29e', inverse: '#ffffff' },
    border: { light: '#e7e5e4', medium: '#d6d3d1', dark: '#a8a29e' }
  },
  
  ocean: {
    primary: {
      50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
      400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
      800: '#075985', 900: '#0c4a6e'
    },
    secondary: {
      50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
      400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
      800: '#115e59', 900: '#134e4a'
    },
    accent: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
      400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
      800: '#5b21b6', 900: '#4c1d95'
    },
    success: '#10b981',
    warning: '#fbbf24',
    error: '#f43f5e',
    info: '#0ea5e9',
    background: { light: '#f8fafc', dark: '#0f172a', paper: '#ffffff', surface: '#f1f5f9' },
    text: { primary: '#0f172a', secondary: '#475569', disabled: '#94a3b8', inverse: '#ffffff' },
    border: { light: '#e2e8f0', medium: '#cbd5e1', dark: '#94a3b8' }
  },
  
  sunset: {
    primary: {
      50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
      400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
      800: '#9a3412', 900: '#7c2d12'
    },
    secondary: {
      50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc',
      400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf',
      800: '#86198f', 900: '#701a75'
    },
    accent: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
      400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
      800: '#854d0e', 900: '#713f12'
    },
    success: '#84cc16',
    warning: '#f59e0b',
    error: '#f43f5e',
    info: '#8b5cf6',
    background: { light: '#fffbeb', dark: '#1e1b4b', paper: '#ffffff', surface: '#fef3c7' },
    text: { primary: '#1e1b4b', secondary: '#4c1d95', disabled: '#a78bfa', inverse: '#ffffff' },
    border: { light: '#fde68a', medium: '#fcd34d', dark: '#fbbf24' }
  },
  
  forest: {
    primary: {
      50: '#f6f9f6', 100: '#ecf3ec', 200: '#d9e7d9', 300: '#c2d6c2',
      400: '#abc5ab', 500: '#94b494', 600: '#739673', 700: '#527852',
      800: '#315a31', 900: '#103c10'
    },
    secondary: {
      50: '#f9f9f4', 100: '#f3f3e9', 200: '#e7e7d3', 300: '#dbdbbd',
      400: '#cfcfa7', 500: '#c3c391', 600: '#9e9e74', 700: '#797957',
      800: '#54543a', 900: '#2f2f1d'
    },
    accent: {
      50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
      400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
      800: '#991b1b', 900: '#7f1d1d'
    },
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#059669',
    background: { light: '#f9fafb', dark: '#1a1f1a', paper: '#ffffff', surface: '#f0f4f0' },
    text: { primary: '#1a1f1a', secondary: '#4b5563', disabled: '#9ca3af', inverse: '#ffffff' },
    border: { light: '#e5e7eb', medium: '#d1d5db', dark: '#9ca3af' }
  },
  
  market: {
    primary: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
      400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
      800: '#9f1239', 900: '#881337'
    },
    secondary: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a'
    },
    accent: {
      50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc',
      400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf',
      800: '#86198f', 900: '#701a75'
    },
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: { light: '#fafafa', dark: '#18181b', paper: '#ffffff', surface: '#f4f4f5' },
    text: { primary: '#18181b', secondary: '#52525b', disabled: '#a1a1aa', inverse: '#ffffff' },
    border: { light: '#e4e4e7', medium: '#d4d4d8', dark: '#a1a1aa' }
  },
  
  midnight: {
    primary: {
      50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
      400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
      800: '#5b21b6', 900: '#4c1d95'
    },
    secondary: {
      50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
      400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
      800: '#075985', 900: '#0c4a6e'
    },
    accent: {
      50: '#fef3c7', 100: '#fde68a', 200: '#fcd34d', 300: '#fbbf24',
      400: '#f59e0b', 500: '#d97706', 600: '#b45309', 700: '#92400e',
      800: '#78350f', 900: '#451a03'
    },
    success: '#10b981',
    warning: '#fbbf24',
    error: '#f43f5e',
    info: '#38bdf8',
    background: { light: '#0f172a', dark: '#020617', paper: '#1e293b', surface: '#1e293b' },
    text: { primary: '#f8fafc', secondary: '#cbd5e1', disabled: '#64748b', inverse: '#0f172a' },
    border: { light: '#334155', medium: '#475569', dark: '#64748b' }
  },
  
  harmattan: {
    primary: {
      50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1',
      400: '#a8a29e', 500: '#78716c', 600: '#57534e', 700: '#44403c',
      800: '#292524', 900: '#1c1917'
    },
    secondary: {
      50: '#f7f7f5', 100: '#efefeb', 200: '#dfdfd7', 300: '#cfcfbe',
      400: '#bfbfa5', 500: '#afaf8c', 600: '#8f8f71', 700: '#6f6f56',
      800: '#4f4f3b', 900: '#2f2f20'
    },
    accent: {
      50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
      400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
      800: '#92400e', 900: '#78350f'
    },
    success: '#65a30d',
    warning: '#d97706',
    error: '#b91c1c',
    info: '#78716c',
    background: { light: '#fafaf9', dark: '#1c1917', paper: '#ffffff', surface: '#f5f5f4' },
    text: { primary: '#1c1917', secondary: '#57534e', disabled: '#a8a29e', inverse: '#fafaf9' },
    border: { light: '#e7e5e4', medium: '#d6d3d1', dark: '#a8a29e' }
  },
  
  carnival: {
    primary: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
      400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
      800: '#9f1239', 900: '#881337'
    },
    secondary: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
      400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
      800: '#854d0e', 900: '#713f12'
    },
    accent: {
      50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
      400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
      800: '#166534', 900: '#14532d'
    },
    success: '#22c55e',
    warning: '#eab308',
    error: '#f43f5e',
    info: '#8b5cf6',
    background: { light: '#fefefe', dark: '#18181b', paper: '#ffffff', surface: '#f4f4f5' },
    text: { primary: '#18181b', secondary: '#52525b', disabled: '#a1a1aa', inverse: '#ffffff' },
    border: { light: '#e4e4e7', medium: '#d4d4d8', dark: '#a1a1aa' }
  },
  
  royal: {
    primary: {
      50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
      400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
      800: '#6b21a8', 900: '#581c87'
    },
    secondary: {
      50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047',
      400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207',
      800: '#854d0e', 900: '#713f12'
    },
    accent: {
      50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
      400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
      800: '#9f1239', 900: '#881337'
    },
    success: '#10b981',
    warning: '#fbbf24',
    error: '#f43f5e',
    info: '#a855f7',
    background: { light: '#fafafa', dark: '#18181b', paper: '#ffffff', surface: '#f4f4f5' },
    text: { primary: '#18181b', secondary: '#52525b', disabled: '#a1a1aa', inverse: '#ffffff' },
    border: { light: '#e4e4e7', medium: '#d4d4d8', dark: '#a1a1aa' }
  },
  
  minimal: {
    primary: {
      50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
      400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
      800: '#1f2937', 900: '#111827'
    },
    secondary: {
      50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
      400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
      800: '#1f2937', 900: '#111827'
    },
    accent: {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a'
    },
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    background: { light: '#ffffff', dark: '#111827', paper: '#ffffff', surface: '#f9fafb' },
    text: { primary: '#111827', secondary: '#6b7280', disabled: '#9ca3af', inverse: '#ffffff' },
    border: { light: '#e5e7eb', medium: '#d1d5db', dark: '#9ca3af' }
  }
};

export const getPalette = (themeName: ThemeName): ColorPalette => {
  return palettes[themeName] || palettes.savanna;
};

export const generateCSSVariables = (palette: ColorPalette): string => {
  return `
    :root {
      /* Primary */
      --color-primary-50: ${palette.primary[50]};
      --color-primary-100: ${palette.primary[100]};
      --color-primary-200: ${palette.primary[200]};
      --color-primary-300: ${palette.primary[300]};
      --color-primary-400: ${palette.primary[400]};
      --color-primary-500: ${palette.primary[500]};
      --color-primary-600: ${palette.primary[600]};
      --color-primary-700: ${palette.primary[700]};
      --color-primary-800: ${palette.primary[800]};
      --color-primary-900: ${palette.primary[900]};
      
      /* Secondary */
      --color-secondary-50: ${palette.secondary[50]};
      --color-secondary-100: ${palette.secondary[100]};
      --color-secondary-200: ${palette.secondary[200]};
      --color-secondary-300: ${palette.secondary[300]};
      --color-secondary-400: ${palette.secondary[400]};
      --color-secondary-500: ${palette.secondary[500]};
      --color-secondary-600: ${palette.secondary[600]};
      --color-secondary-700: ${palette.secondary[700]};
      --color-secondary-800: ${palette.secondary[800]};
      --color-secondary-900: ${palette.secondary[900]};
      
      /* Accent */
      --color-accent-50: ${palette.accent[50]};
      --color-accent-100: ${palette.accent[100]};
      --color-accent-200: ${palette.accent[200]};
      --color-accent-300: ${palette.accent[300]};
      --color-accent-400: ${palette.accent[400]};
      --color-accent-500: ${palette.accent[500]};
      --color-accent-600: ${palette.accent[600]};
      --color-accent-700: ${palette.accent[700]};
      --color-accent-800: ${palette.accent[800]};
      --color-accent-900: ${palette.accent[900]};
      
      /* Semantic Colors */
      --color-success: ${palette.success};
      --color-warning: ${palette.warning};
      --color-error: ${palette.error};
      --color-info: ${palette.info};
      
      /* Background */
      --bg-light: ${palette.background.light};
      --bg-dark: ${palette.background.dark};
      --bg-paper: ${palette.background.paper};
      --bg-surface: ${palette.background.surface};
      
      /* Text */
      --text-primary: ${palette.text.primary};
      --text-secondary: ${palette.text.secondary};
      --text-disabled: ${palette.text.disabled};
      --text-inverse: ${palette.text.inverse};
      
      /* Border */
      --border-light: ${palette.border.light};
      --border-medium: ${palette.border.medium};
      --border-dark: ${palette.border.dark};
    }
  `;
};

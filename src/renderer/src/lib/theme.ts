// Shared browser theme variables used by chrome and internal pages.

export type ColorTheme = 'ember' | 'ocean' | 'forest' | 'violet' | 'rose';

export const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string; description: string }[] = [
  { id: 'ember', label: 'Ember', swatch: '#e8b86a', description: 'Warm brown' },
  { id: 'ocean', label: 'Ocean', swatch: '#67c7e8', description: 'Cool blue' },
  { id: 'forest', label: 'Forest', swatch: '#7bc79a', description: 'Muted green' },
  { id: 'violet', label: 'Violet', swatch: '#b9a2ee', description: 'Soft purple' },
  { id: 'rose', label: 'Rose', swatch: '#ee9aa7', description: 'Dusty pink' },
];

export interface CustomizationSettings {
  theme?: 'light' | 'dark' | 'system';
  colorTheme?: ColorTheme;
  glassOpacity?: number;
  glassBlur?: number;
  cornerRadius?: number;
}

export const DEFAULT_CUSTOMIZATION = {
  theme: 'dark' as const,
  colorTheme: 'ember' as ColorTheme,
  glassOpacity: 65,
  glassBlur: 16,
  cornerRadius: 14,
};

export function applyCustomizationStyles(settings: CustomizationSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = settings.theme ?? DEFAULT_CUSTOMIZATION.theme;
  root.dataset.colorTheme = settings.colorTheme ?? DEFAULT_CUSTOMIZATION.colorTheme;
  applyAppearanceMode(theme);
  const opacity = (settings.glassOpacity ?? DEFAULT_CUSTOMIZATION.glassOpacity) / 100;
  const blur = settings.glassBlur ?? DEFAULT_CUSTOMIZATION.glassBlur;
  const radius = settings.cornerRadius ?? DEFAULT_CUSTOMIZATION.cornerRadius;

  root.style.setProperty('--glass-opacity', opacity.toFixed(2));
  root.style.setProperty('--glass-blur', `${blur}px`);
  root.style.setProperty('--glass-blur-sm', `${Math.max(0, Math.round(blur * 0.5))}px`);
  root.style.setProperty('--radius-glass', `${radius}px`);
  root.style.setProperty('--radius-glass-sm', `${Math.max(0, radius - 4)}px`);
  root.style.setProperty('--radius-tab', `${radius}px`);
  root.style.setProperty('--radius-omnibox', `${Math.min(radius * 2, 9999)}px`);
}

export function applyAppearanceMode(theme: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  const appearance = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.classList.toggle('dark', appearance === 'dark');
}

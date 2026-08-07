// Theme & Customization — Glassmorphic Edition

export interface CustomizationSettings {
  theme?: 'light' | 'dark' | 'system';
  accentColor?: string;
  surfaceColor?: string;
  glassOpacity?: number;
  glassBlur?: number;
  cornerRadius?: number;
  tintGlow?: boolean;
}

export const DEFAULT_CUSTOMIZATION = {
  theme: 'dark' as const,
  accentColor: '#e8c06a',
  surfaceColor: '#1e1914',
  glassOpacity: 65,
  glassBlur: 16,
  cornerRadius: 14,
  tintGlow: true,
};

export const SURFACE_PRESETS: AccentPreset[] = [
  { id: 'dark-brown',    label: 'Dark Brown',    color: '#1e1914', gradient: 'from-amber-900 to-stone-900',  description: 'Warm dark brown (default)' },
  { id: 'carbon',        label: 'Carbon',        color: '#161616', gradient: 'from-zinc-800 to-zinc-950',     description: 'Pure dark gray' },
  { id: 'midnight',      label: 'Midnight Blue', color: '#0f1622', gradient: 'from-slate-800 to-slate-950',   description: 'Deep blue-black' },
  { id: 'forest',        label: 'Forest',        color: '#0f1c14', gradient: 'from-green-900 to-emerald-950', description: 'Deep green tint' },
  { id: 'plum',          label: 'Plum',          color: '#1a0f1a', gradient: 'from-purple-900 to-fuchsia-950', description: 'Dark purple hue' },
  { id: 'graphite',      label: 'Graphite',      color: '#1a1a1f', gradient: 'from-gray-700 to-gray-900',     description: 'Neutral dark' },
];

export interface AccentPreset {
  id: string;
  label: string;
  color: string;
  gradient: string;
  description: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'warm-gold', label: 'Warm Gold', color: '#e8c06a', gradient: 'from-amber-400 to-amber-600', description: 'Warm amber accent' },
  { id: 'sunset-coral', label: 'Sunset Coral', color: '#f0896b', gradient: 'from-orange-400 to-rose-500', description: 'Warm coral tone' },
  { id: 'arctic-blue', label: 'Arctic Blue', color: '#6bb5f0', gradient: 'from-sky-400 to-blue-500', description: 'Cool blue accent' },
  { id: 'mint-green', label: 'Mint', color: '#6bf0a8', gradient: 'from-emerald-400 to-teal-500', description: 'Fresh mint green' },
  { id: 'lavender', label: 'Lavender', color: '#a78bfa', gradient: 'from-violet-400 to-purple-500', description: 'Soft purple' },
  { id: 'pure-white', label: 'Pure White', color: '#ffffff', gradient: 'from-white to-gray-200', description: 'Clean monochrome' },
];

export const OPACITY_PRESETS = [
  { value: 45, label: 'Ethereal', sublabel: '45% · Very translucent' },
  { value: 65, label: 'Balanced', sublabel: '65% · Default glass' },
  { value: 80, label: 'Frosted', sublabel: '80% · More opaque' },
  { value: 100, label: 'Solid', sublabel: '100% · Fully opaque' },
];

export const BLUR_PRESETS = [
  { value: 0, label: 'None', sublabel: '0px · Ultra-fast, no blur' },
  { value: 12, label: 'Light', sublabel: '12px · Fast frosted glass' },
  { value: 16, label: 'Standard', sublabel: '16px · Default glass blur' },
  { value: 28, label: 'Heavy', sublabel: '28px · Deep frosting' },
];

export const RADIUS_PRESETS = [
  { value: 0, label: 'Sharp', sublabel: '0px · Square edges' },
  { value: 8, label: 'Subtle', sublabel: '8px · Slight rounding' },
  { value: 14, label: 'Standard', sublabel: '14px · Default glass radius' },
  { value: 20, label: 'Rounded', sublabel: '20px · Very rounded' },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  if (cleaned.length !== 6) {
    return { r: 232, g: 192, b: 106 };
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 232, g: 192, b: 106 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function applyCustomizationStyles(settings: CustomizationSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const color = settings.accentColor || DEFAULT_CUSTOMIZATION.accentColor;
  const rgb = hexToRgb(color);

  root.style.setProperty('--accent-color', color);
  root.style.setProperty('--color-accent', color);
  root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--color-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty('--accent-subtle', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);
  root.style.setProperty('--accent-surface', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
  root.style.setProperty('--accent-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
  root.style.setProperty('--accent-glow', `0 0 20px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);

  const surface = settings.surfaceColor || DEFAULT_CUSTOMIZATION.surfaceColor;
  const surfaceRgb = hexToRgb(surface);
  root.style.setProperty('--color-surface-solid', surface);
  root.style.setProperty('--glass-bar-bg', `rgba(${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}, 0.72)`);
  root.style.setProperty('--app-bg', surface);

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
  root.style.setProperty('--tint-glow-opacity', settings.tintGlow ? '1' : '0');
}

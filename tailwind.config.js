/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', 'SF Pro Text', '-apple-system', 'BlinkMacSystemFont', 'SF Pro',
          'San Francisco', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif',
        ],
        display: [
          'Space Grotesk', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'SF Pro',
          'San Francisco', 'Inter', 'sans-serif',
        ],
        doodle: ['Gaegu', 'Patrick Hand', 'Caveat', 'cursive', 'sans-serif'],
        sketch: ['Caveat', 'Architects Daughter', 'cursive'],
        hand: ['Patrick Hand', 'Gaegu', 'cursive'],
        sketchDisplay: ['Architects Daughter', 'cursive'],
        heading: ['Space Grotesk', 'Gaegu', 'sans-serif'],
      },
      borderRadius: {
        glass: 'var(--radius-glass, 14px)',
        'glass-sm': 'var(--radius-glass-sm, 10px)',
        'glass-tab': 'var(--radius-tab, 9px)',
        'glass-omnibox': 'var(--radius-omnibox, 9999px)',
        'doodle-sm': '255px 15px 225px 15px/15px 225px 15px 255px',
        'doodle-md': '255px 25px 225px 25px/25px 225px 25px 255px',
        'doodle-lg': '20px 255px 20px 255px/255px 20px 255px 20px',
      },
      transitionDuration: {
        glass: '240ms',
        snap: '150ms',
        spring: '280ms',
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        snap: 'cubic-bezier(0.22, 0.68, 0, 1)',
        smooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'tab-enter': 'animate-tab-enter 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'tab-close': 'animate-tab-close 220ms cubic-bezier(0.22, 0.68, 0, 1) forwards',
        'menu-in': 'animate-menu-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'menu-out': 'animate-menu-out 140ms cubic-bezier(0.22, 0.68, 0, 1) forwards',
        'page-enter': 'page-enter 380ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'sidebar-enter': 'sidebar-enter 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        'animate-tab-enter': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(4px)', filter: 'blur(2px)' },
          '60%': { opacity: '1', transform: 'scale(1.015) translateY(-1px)', filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)', filter: 'blur(0)' },
        },
        'animate-tab-close': {
          '0%': { opacity: '1', transform: 'scale(1)', maxWidth: '200px' },
          '50%': { opacity: '0', transform: 'scale(0.85) translateY(8px)' },
          '100%': { opacity: '0', transform: 'scale(0.8) translateY(12px)', maxWidth: '0', padding: '0', margin: '0', overflow: 'hidden' },
        },
        'animate-menu-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.96)', filter: 'blur(4px)' },
          '70%': { opacity: '1', filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        },
        'animate-menu-out': {
          to: { opacity: '0', transform: 'translateY(-4px) scale(0.97)', filter: 'blur(2px)' },
        },
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'sidebar-enter': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.12)',
        'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        'accent-glow': 'var(--accent-glow, 0 0 20px rgba(59, 130, 246, 0.35))',
        'doodle': '2.5px 2.5px 0px currentColor',
        'doodle-solid': '3px 3px 0px #1e293b',
        'doodle-solid-dark': '3px 3px 0px #090a0f',
        'doodle-pop': '4px 4px 0px rgba(0,0,0,0.85)',
        'doodle-yellow': '3px 3px 0px #ca8a04',
        'doodle-pink': '3px 3px 0px #db2777',
      },
      backdropBlur: {
        glass: 'var(--glass-blur, 28px)',
        'glass-sm': 'var(--glass-blur-sm, 16px)',
      },
      colors: {
        accent: {
          DEFAULT: 'var(--accent-color, #3b82f6)',
          subtle: 'var(--accent-subtle, rgba(59, 130, 246, 0.14))',
        },
        glass: {
          stroke: 'rgba(255, 255, 255, 0.22)',
          'stroke-dark': 'rgba(255, 255, 255, 0.08)',
        },
        doodle: {
          ink: '#18181b',
          chalk: '#fafaf9',
          pencil: '#71717a',
          yellow: '#fef08a',
          'yellow-ink': '#854d0e',
          mint: '#a7f3d0',
          'mint-ink': '#065f46',
          pink: '#fbcfe8',
          'pink-ink': '#9d174d',
          sky: '#bae6fd',
          'sky-ink': '#075985',
          paper: '#faf8f5',
          'paper-dark': '#13141c',
        },
      },
    },
  },
  plugins: [],
};

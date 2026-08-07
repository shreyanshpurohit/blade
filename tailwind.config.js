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
      },
      transitionTimingFunction: {
        glass: 'cubic-bezier(0.32, 0.72, 0, 1)', // macOS spring-ish ease
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

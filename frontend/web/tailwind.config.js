/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* Design tokens from design.md & PRD */
      colors: {
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',   /* Main orange accent */
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        dark: {
          900: '#0f172a',   /* Deep dark blue — primary dark bg */
          800: '#1e293b',   /* Secondary dark bg */
          700: '#334155',   /* Dark grey surfaces */
          600: '#475569',
        },
        surface: {
          50:  '#fafaf9',   /* Light page bg */
          100: '#f5f5f4',   /* Card bg */
          200: '#e7e5e4',
        },
        ink: {
          900: '#1c1917',   /* Primary text */
          700: '#44403c',
          500: '#78716c',   /* Muted text */
          300: '#d6d3d1',
        },
        success: '#22c55e',
        warning: '#eab308',
        danger:  '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        elevated: '0 4px 20px rgba(0,0,0,0.08)',
        glass: '0 8px 32px rgba(0,0,0,0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 6s ease-in-out infinite',
        'waveform':   'waveform 1.2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-10px)' },
        },
        waveform: {
          '0%, 100%': { height: '12px' },
          '50%':      { height: '28px' },
        },
      },
    },
  },
  plugins: [],
};

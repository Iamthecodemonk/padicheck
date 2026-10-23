const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: v('ink'), soft: v('ink-soft') },
        brand: { DEFAULT: v('brand'), dark: v('brand-dark'), soft: v('brand-soft'), bright: v('brand-bright') },
        canvas: v('canvas'),
        surface: v('surface'),
        line: v('line'),
        muted: v('muted'),
        caution: { DEFAULT: v('caution'), soft: v('caution-soft') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
        sky: { DEFAULT: v('sky'), soft: v('sky-soft') },
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        amber: { DEFAULT: v('amber'), soft: v('amber-soft') },
        rose: { DEFAULT: v('rose'), soft: v('rose-soft') },
        teal: { DEFAULT: v('teal'), soft: v('teal-soft') },
        navy: { DEFAULT: '#0B1A33', light: '#16294A', line: '#243A5E', text: '#B9C4D6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,26,51,0.05)',
        sheet: '0 -10px 40px rgba(11,26,51,0.14)',
        float: '0 8px 24px rgba(11,26,51,0.18)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
};

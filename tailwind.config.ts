import type { Config } from 'tailwindcss';
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: {
    bg: v('bg'), panel: v('panel'), ink: v('ink'), muted: v('muted'),
    line: v('line'), brand: v('brand'), onbrand: v('onbrand'), now: v('now'),
  } } },
  plugins: [],
};
export default config;

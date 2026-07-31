import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#17152a',
        violet: '#6d3ce8',
        mist: '#f6f3ff',
        emerald: '#13795b',
        muted: '#777287',
        line: '#e8e5ef',
        // The one error tone. Contrast 5.5:1 on white, so it carries body-sized
        // text on its own; kept in the same weight class as `emerald` rather
        // than a brighter alarm red, which would not belong next to `violet`.
        danger: '#c62448',
      },
      boxShadow: {
        soft: '0 20px 60px rgba(38, 30, 72, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;

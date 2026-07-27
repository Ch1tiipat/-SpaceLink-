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
      },
      boxShadow: {
        soft: '0 20px 60px rgba(38, 30, 72, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;

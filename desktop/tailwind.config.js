/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface:  '#0a0a12',
        surface2: '#12121e',
        surface3: '#1a1a2e',
        border:   '#2a2a40',
        accent:   '#6366f1',
      },
    },
  },
  plugins: [],
};

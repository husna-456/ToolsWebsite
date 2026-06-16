/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand gradient colors (blue family only)
        brand: {
          DEFAULT: '#2563EB',
          from:    '#2563EB',   // blue-600
          mid:     '#3B82F6',   // blue-500
          to:      '#60A5FA',   // blue-400
          hover:   '#1D4ED8',   // blue-700
          light:   '#EFF6FF',   // blue-50
          dark:    '#1E3A8A',   // blue-900
        },
        // Accent = interactive blue
        accent: {
          DEFAULT: '#2563EB',   // blue-600
          hover:   '#1D4ED8',   // blue-700
          subtle:  '#EFF6FF',   // blue-50
          muted:   '#BFDBFE',   // blue-200
        },
        // Neutral surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          2:       '#F8FAFC',
          3:       '#EFF6FF',   // blue-50 tint
        },
        border: {
          DEFAULT: '#E2E8F0',
          strong:  '#CBD5E1',
          brand:   '#BFDBFE',   // blue-200
        },
        text: {
          primary:   '#0F172A',
          secondary: '#475569',
          muted:     '#94A3B8',
          light:     '#CBD5E1',
        },
        // Semantic
        primary: { DEFAULT: '#0F172A', hover: '#1E293B' },
        success: '#10B981',
        warning: '#F59E0B',
        error:   '#EF4444',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      backgroundImage: {
        'brand-gradient':       'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
        'brand-gradient-dark':  'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)',
        'brand-gradient-light': 'linear-gradient(135deg, #3B82F6 0%, #93C5FD 100%)',
        'card-gradient':        'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(15,23,42,0.05)',
        sm:    '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
        card:  '0 4px 20px rgba(37,99,235,0.10)',
        'card-hover': '0 8px 30px rgba(37,99,235,0.18)',
        tool:  '0 0 0 1px rgba(37,99,235,0.08), 0 4px 20px rgba(37,99,235,0.10)',
        brand: '0 8px 32px rgba(37,99,235,0.25)',
        glow:  '0 0 0 3px rgba(37,99,235,0.20)',
        lg:    '0 8px 32px rgba(15,23,42,0.12)',
        xl:    '0 20px 60px rgba(15,23,42,0.14)',
      },
      animation: {
        shimmer:  'shimmer 1.5s infinite',
        slideIn:  'slideIn 0.3s ease',
        fadeUp:   'fadeUp 0.35s ease',
        fadeIn:   'fadeIn 0.2s ease',
        float:    'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer:  { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        slideIn:  { from: { transform: 'translateX(100%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        fadeUp:   { from: { transform: 'translateY(14px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        float:    { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
    }
  },
  plugins: []
};

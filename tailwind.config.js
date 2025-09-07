/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        sidebar: {
          background: '#1e293b',
          border: '#334155',
          text: '#cbd5e1',
          textActive: '#f1f5f9',
          hover: '#374151',
        }
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'fade-in-down': 'fadeInDown 0.3s ease-out',
        'fade-out-up': 'fadeOutUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.2s ease-out',
        'slide-out-up': 'slideOutUp 0.3s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-10px)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%': { 
            opacity: '0',
            transform: 'translate3d(0, -10px, 0)'
          },
          '100%': { 
            opacity: '1',
            transform: 'translate3d(0, 0, 0)'
          },
        },
        fadeOutUp: {
          '0%': { 
            opacity: '1',
            transform: 'translate3d(0, 0, 0)'
          },
          '100%': { 
            opacity: '0',
            transform: 'translate3d(0, -10px, 0)'
          },
        },
      },
    },
    keyframes: {
      slideIn: {
        '0%': { transform: 'translateX(-100%)' },
        '100%': { transform: 'translateX(0)' },
      },
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      fadeInDown: {
        '0%': {
          opacity: '0',
          transform: 'translate3d(0, -10px, 0)'
        },
        '100%': {
          opacity: '1',
          transform: 'translate3d(0, 0, 0)'
        },
      },
      fadeOutUp: {
        '0%': {
          opacity: '1',
          transform: 'translate3d(0, 0, 0)'
        },
        '100%': {
          opacity: '0',
          transform: 'translate3d(0, -10px, 0)'
        },
      },
      slideOutUp: {
        '0%': {
          opacity: '1',
          transform: 'translate3d(0, 0, 0)'
        },
        '100%': {
          opacity: '0',
          transform: 'translate3d(0, -20px, 0)'
        },
      },
    },
  },
  plugins: [],
}


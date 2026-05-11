/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
        danger:  { 400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c' },
        success: { 400:'#4ade80',500:'#22c55e',600:'#16a34a' },
        warning: { 400:'#fbbf24',500:'#f59e0b',600:'#d97706' },
        dark:    { 800:'#1e293b',850:'#172033',900:'#0f172a',950:'#080e1a' },
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4,0,0.6,1) infinite',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'flash':      'flash 0.5s ease-in-out infinite alternate',
        'slide-in':   'slideIn 0.3s ease-out',
        'fade-in':    'fadeIn 0.4s ease-out',
      },
      keyframes: {
        flash:   { '0%':{ opacity:1 }, '100%':{ opacity:0.3 } },
        slideIn: { '0%':{ transform:'translateX(-20px)', opacity:0 }, '100%':{ transform:'translateX(0)', opacity:1 } },
        fadeIn:  { '0%':{ opacity:0, transform:'translateY(10px)' }, '100%':{ opacity:1, transform:'translateY(0)' } },
      },
      backdropBlur: { xs: '2px' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};

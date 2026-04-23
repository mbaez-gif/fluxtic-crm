import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Fluxtic brand palette — dark slate base, electric teal accent
        flux: {
          bg:       '#0D0F14',
          surface:  '#13161E',
          card:     '#191D28',
          border:   '#252A38',
          muted:    '#2E3548',
          subtle:   '#3D4560',
          text3:    '#6B7599',
          text2:    '#9AA3C2',
          text1:    '#E2E6F3',
          white:    '#F5F7FF',
          // Accent
          teal:     '#00D4A8',
          tealDim:  '#00A884',
          tealGlow: 'rgba(0,212,168,0.12)',
          // Status
          success:  '#22D3A0',
          warning:  '#F59E0B',
          danger:   '#F43F5E',
          info:     '#60A5FA',
        },
      },
      fontFamily: {
        sans:    ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'teal-sm': '0 0 0 1px rgba(0,212,168,0.3)',
        'teal-md': '0 0 20px rgba(0,212,168,0.15)',
        'card':    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-in':     'slideIn 0.3s ease-out',
        'pulse-teal':   'pulseTeal 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseTeal: { '0%,100%': { boxShadow: '0 0 0 0 rgba(0,212,168,0.4)' }, '50%': { boxShadow: '0 0 0 6px rgba(0,212,168,0)' } },
      },
    },
  },
  plugins: [],
}

export default config

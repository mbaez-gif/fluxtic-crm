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
        bg: { DEFAULT: '#FAF8F5', alt: '#F4F1EC', surface: '#FFFFFF', surface2: '#F9F7F4' },
        noir: { DEFAULT: '#1A1612', 2: '#2E2A25', muted: '#6B6560', ink: '#3D3530' },
        blush: { DEFAULT: '#C9A98A', light: '#EFE5D8', dark: '#A8845F' },
        rose: { DEFAULT: '#D4A5A5', light: '#F5EDED' },
        gold: { DEFAULT: '#B8956A', light: '#F0E6D6' },
        sage: { DEFAULT: '#8A9E8C', light: '#E8EDE8' },
        border: { DEFAULT: '#E8E2DA', 2: '#F0EBE3' },
      },
      fontFamily: {
        display: ['Cormorant', 'Georgia', 'serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      spacing: { nav: '240px', topbar: '56px' },
      borderRadius: { sm: '6px', md: '12px', lg: '20px', pill: '9999px' },
      boxShadow: {
        sm: '0 1px 3px rgba(26,22,18,0.05)',
        md: '0 4px 16px rgba(26,22,18,0.07)',
        lg: '0 12px 40px rgba(26,22,18,0.10)',
        focus: '0 0 0 2px #FAF8F5, 0 0 0 4px #C9A98A',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { transform: 'translateX(-12px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease both',
        'slide-in': 'slide-in 0.25s ease both',
      },
    },
  },
  plugins: [],
}
export default config

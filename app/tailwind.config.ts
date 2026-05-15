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
        // Superficies — claras, clínicas
        bg:      { DEFAULT: '#F8FAFC', alt: '#F1F5F9', surface: '#FFFFFF', surface2: '#F8FAFC' },
        // Tinta — gris azulado profundo (no marrón)
        noir:    { DEFAULT: '#0F172A', 2: '#1E293B', muted: '#64748B', ink: '#334155' },
        // Primary clínico — teal/azul petróleo
        teal:    { DEFAULT: '#0F766E', light: '#CCFBF1', dark: '#115E59', soft: '#5EEAD4' },
        // Acentos secundarios
        clinical:{ DEFAULT: '#2563EB', light: '#DBEAFE', dark: '#1D4ED8' },
        salud:   { DEFAULT: '#16A34A', light: '#DCFCE7', dark: '#15803D' },
        // Estados (alertas, validaciones)
        danger:  { DEFAULT: '#DC2626', light: '#FEE2E2', dark: '#991B1B' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', dark: '#92400E' },
        info:    { DEFAULT: '#0284C7', light: '#E0F2FE', dark: '#075985' },
        // Bordes
        border:  { DEFAULT: '#E2E8F0', 2: '#CBD5E1' },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: { nav: '240px', topbar: '56px' },
      borderRadius: { sm: '6px', md: '10px', lg: '16px', pill: '9999px' },
      boxShadow: {
        sm:    '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        md:    '0 4px 12px rgba(15,23,42,0.06), 0 2px 4px rgba(15,23,42,0.04)',
        lg:    '0 12px 32px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)',
        focus: '0 0 0 2px #F8FAFC, 0 0 0 4px #0F766E',
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { transform: 'translateX(-12px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
      },
      animation: {
        'fade-in':  'fade-in 0.3s ease both',
        'slide-in': 'slide-in 0.25s ease both',
      },
    },
  },
  plugins: [],
}
export default config

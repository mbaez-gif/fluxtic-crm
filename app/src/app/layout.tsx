// app/src/app/layout.tsx
import type { Metadata } from 'next'
import SessionProvider from '@/components/providers/SessionProvider'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'Fluxtic Salud · CRM Clínico',
  description: 'CRM clínico para clínicas, consultorios y centros médicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}

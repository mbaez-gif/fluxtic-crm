import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title:       'Fluxtic CRM',
  description: 'Plataforma de gestión comercial para Fluxtic',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-flux-bg text-flux-text1 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

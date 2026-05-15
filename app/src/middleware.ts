// app/src/middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path  = req.nextUrl.pathname

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const rol = token.rol as string

    // Rutas solo para OWNER y ADMIN
    const soloOwner = [
      '/admin/reportes',
      '/admin/configuracion',
      '/admin/automatizaciones',
      '/admin/instagram',
      '/admin/tiendanube',
      '/admin/whatsapp',
    ]

    const esRestringida = soloOwner.some((r) => path.startsWith(r))

    if (esRestringida && rol === 'EMPLEADA') {
      return NextResponse.redirect(new URL('/admin/turnos', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/admin/:path*'],
}

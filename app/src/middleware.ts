// app/src/middleware.ts
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const rol = token.rol as string

    // Pacientes solo pueden acceder al portal
    if (path.startsWith('/admin') && rol === 'PACIENTE') {
      return NextResponse.redirect(new URL('/portal/turnos', req.url))
    }
    if (path.startsWith('/portal') && rol !== 'PACIENTE') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
)

export const config = {
  matcher: ['/admin/:path*', '/portal/:path*'],
}

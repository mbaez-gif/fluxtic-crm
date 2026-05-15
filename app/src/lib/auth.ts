// app/src/lib/auth.ts
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const API_URL = process.env.INTERNAL_API_URL || 'http://api-salud:3001'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          })

          if (!res.ok) return null

          const data = await res.json()

          if (!data.user) return null

          return {
            id:       data.user.id,
            email:    data.user.email,
            name:     `${data.user.nombre} ${data.user.apellido ?? ''}`.trim(),
            rol:      data.user.rol,
            nombre:   data.user.nombre,
            permisos: data.user.permisos ?? {},
          }
        } catch {
          return null
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id      = user.id
        token.rol     = (user as any).rol
        token.nombre  = (user as any).nombre
        token.permisos = (user as any).permisos ?? {}
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id      = token.id
        ;(session.user as any).rol    = token.rol
        ;(session.user as any).nombre = token.nombre
        ;(session.user as any).permisos = token.permisos ?? {}
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   8 * 60 * 60, // 8 horas
  },

  secret: process.env.NEXTAUTH_SECRET,
}

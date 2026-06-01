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
          if (!data?.id || !data?.token) return null

          return {
            id:       data.id,
            email:    data.email,
            name:     `${data.nombre} ${data.apellido ?? ''}`.trim(),
            rol:      data.rol,
            nombre:   data.nombre,
            permisos: data.permisos ?? [],
            perfil_profesional_id: data.perfil_profesional_id ?? null,
            paciente_id:           data.paciente_id ?? null,
            apiToken:              data.token,   // ← JWT firmado por el backend
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
        token.id        = user.id
        token.rol       = (user as any).rol
        token.nombre    = (user as any).nombre
        token.permisos  = (user as any).permisos ?? []
        token.perfil_profesional_id = (user as any).perfil_profesional_id ?? null
        token.paciente_id           = (user as any).paciente_id ?? null
        token.apiToken  = (user as any).apiToken   // ← persistir JWT del backend
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = token.id
        ;(session.user as any).rol      = token.rol
        ;(session.user as any).nombre   = token.nombre
        ;(session.user as any).permisos = token.permisos ?? []
        ;(session.user as any).perfil_profesional_id = (token as any).perfil_profesional_id ?? null
        ;(session.user as any).paciente_id           = (token as any).paciente_id ?? null
      }
      // Exponer apiToken en el top-level de session para que apiFetch lo consuma
      ;(session as any).apiToken = (token as any).apiToken ?? null
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

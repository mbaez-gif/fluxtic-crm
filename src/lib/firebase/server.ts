import 'server-only'
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth }                                 from 'firebase-admin/auth'
import { getFirestore }                            from 'firebase-admin/firestore'

let adminApp: App | null = null

function init(): App {
  if (adminApp) return adminApp
  if (getApps().length) {
    adminApp = getApps()[0]!
    return adminApp
  }

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID   ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[firebase-admin] Faltan credenciales: FIREBASE_ADMIN_PROJECT_ID / ' +
      'FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY'
    )
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  })
  return adminApp
}

export function adminAuth() {
  return getAuth(init())
}

export function adminDb() {
  return getFirestore(init())
}

// ── Verifica un Bearer token y devuelve uid + rol del usuario ──
export interface AuthedUser {
  uid:    string
  email:  string | null
  nombre: string | null
  rol:    'super_admin' | 'admin' | 'consultor'
}

export async function verifyBearer(authorizationHeader: string | null): Promise<AuthedUser> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    const err = new Error('NO_TOKEN') as Error & { statusCode?: number }
    err.statusCode = 401
    throw err
  }
  const token = authorizationHeader.slice(7).trim()

  let decoded
  try {
    decoded = await adminAuth().verifyIdToken(token)
  } catch (e) {
    const err = new Error('INVALID_TOKEN') as Error & { statusCode?: number }
    err.statusCode = 401
    throw err
  }

  const snap = await adminDb().collection('users').doc(decoded.uid).get()
  if (!snap.exists) {
    const err = new Error('USER_NOT_FOUND') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
  const data = snap.data() as { email?: string; nombre?: string; rol?: AuthedUser['rol'] }
  return {
    uid:    decoded.uid,
    email:  data.email  ?? decoded.email ?? null,
    nombre: data.nombre ?? null,
    rol:    data.rol    ?? 'consultor',
  }
}

export async function requireSuperAdmin(authorizationHeader: string | null): Promise<AuthedUser> {
  const user = await verifyBearer(authorizationHeader)
  if (user.rol !== 'super_admin') {
    const err = new Error('FORBIDDEN_NOT_SUPER_ADMIN') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
  return user
}

// Helper para route handlers — devuelve la respuesta o lanza
import { NextResponse } from 'next/server'
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const e = err as Error & { statusCode?: number }
    if (e.statusCode === 401 || e.statusCode === 403) {
      return NextResponse.json(
        { ok: false, error: e.message },
        { status: e.statusCode }
      )
    }
  }
  return null
}

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'
import type { FluxticUser } from '@/types'

// ── Sign in ──────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

// ── Sign out ─────────────────────────────────────────────
export async function signOut() {
  await firebaseSignOut(auth)
}

// ── Password reset ───────────────────────────────────────
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

// ── Auth state observer ──────────────────────────────────
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

// ── Get or create user profile in Firestore ──────────────
export async function getOrCreateUserProfile(user: User): Promise<FluxticUser> {
  const ref  = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    return snap.data() as FluxticUser
  }

  // First login — create profile
  const profile: FluxticUser = {
    uid:       user.uid,
    email:     user.email ?? '',
    nombre:    user.displayName ?? user.email?.split('@')[0] ?? 'Usuario',
    rol:       'consultor',
    avatarUrl: user.photoURL ?? null,
    creadoEn:  new Date(),
  }

  await setDoc(ref, { ...profile, creadoEn: serverTimestamp() })
  return profile
}

// ── Get user profile ─────────────────────────────────────
export async function getUserProfile(uid: string): Promise<FluxticUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as FluxticUser) : null
}

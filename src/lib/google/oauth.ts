import { google } from 'googleapis'
import { db }     from '@/lib/firebase/config'
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'

// ── OAuth2 client singleton ───────────────────────────────
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// ── Generate auth URL for user consent ───────────────────
export function getAuthUrl(): string {
  const oauth2 = getOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  })
}

// ── Save tokens to Firestore ──────────────────────────────
export async function saveTokens(
  uid:    string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }
) {
  await setDoc(doc(db, 'googleTokens', uid), {
    ...tokens,
    actualizadoEn: serverTimestamp(),
  }, { merge: true })
}

// ── Load tokens from Firestore and inject into client ─────
export async function getAuthenticatedClient(uid: string) {
  const snap = await getDoc(doc(db, 'googleTokens', uid))
  if (!snap.exists()) throw new Error('Usuario no tiene Google conectado')

  const tokens = snap.data()
  const oauth2 = getOAuth2Client()
  oauth2.setCredentials(tokens)

  // Auto-refresh if expired
  oauth2.on('tokens', async newTokens => {
    await saveTokens(uid, newTokens)
  })

  return oauth2
}

// ── Check if user has Google connected ───────────────────
export async function isGoogleConnected(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'googleTokens', uid))
    return snap.exists() && !!snap.data()?.access_token
  } catch {
    return false
  }
}

import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, limit,
  serverTimestamp, writeBatch, getDocs,
} from 'firebase/firestore'
import { db }  from '@/lib/firebase/config'
import type { NotificationType } from '@/types/notifications'
import { buildNotification, NOTIF_CONFIG } from '@/types/notifications'
import { SOCIOS } from '@/types/admin'

// Create a notification for one user
export async function createNotification(
  tipo:            NotificationType,
  descripcion:     string,
  destinatarioUid: string,
  opts?: { href?: string; metadata?: Record<string, string>; creadoPorUid?: string }
) {
  const data = buildNotification(tipo, descripcion, destinatarioUid, opts)
  await addDoc(collection(db, 'notifications'), {
    ...data,
    creadoEn: serverTimestamp(),
  })
}

// Create notification for ALL socios
export async function notifyAllSocios(
  tipo:        NotificationType,
  descripcion: string,
  opts?:       { href?: string; metadata?: Record<string, string>; creadoPorUid?: string }
) {
  const batch = writeBatch(db)
  for (const socio of SOCIOS) {
    if (socio.uid.includes('_UID')) continue  // skip placeholder UIDs
    const data = buildNotification(tipo, descripcion, socio.uid, opts)
    const ref  = doc(collection(db, 'notifications'))
    batch.set(ref, { ...data, creadoEn: serverTimestamp() })
  }
  await batch.commit()
}

// Mark one notification as read
export async function markAsRead(id: string) {
  await updateDoc(doc(db, 'notifications', id), { leida: true })
}

// Mark ALL unread as read for a user
export async function markAllAsRead(uid: string) {
  const q    = query(
    collection(db, 'notifications'),
    where('destinatarioUid', '==', uid),
    where('leida', '==', false)
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { leida: true }))
  await batch.commit()
}

// Archive a notification
export async function archiveNotification(id: string) {
  await updateDoc(doc(db, 'notifications', id), { archivada: true })
}

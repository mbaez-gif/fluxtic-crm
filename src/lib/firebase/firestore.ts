import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  type Query,
  type DocumentData,
  type QueryConstraint,
  type WhereFilterOp,
} from 'firebase/firestore'
import { db } from './config'

// ── Types ────────────────────────────────────────────────
export type FirestoreFilter = {
  field:    string
  op:       WhereFilterOp
  value:    unknown
}

// ── Create ───────────────────────────────────────────────
export async function createDoc<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, 'id' | 'creadoEn' | 'actualizadoEn'>
) {
  const ref = await addDoc(collection(db, collectionName), {
    ...data,
    creadoEn:      serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  })
  return ref.id
}

// ── Read one ─────────────────────────────────────────────
export async function readDoc<T>(collectionName: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as T
}

// ── Read many ────────────────────────────────────────────
export async function readDocs<T>(
  collectionName: string,
  filters:  FirestoreFilter[]  = [],
  orderField = 'creadoEn',
  orderDir:  'asc' | 'desc' = 'desc'
): Promise<T[]> {
  const constraints: QueryConstraint[] = [
    ...filters.map(f => where(f.field, f.op, f.value)),
    orderBy(orderField, orderDir),
  ]
  const q    = query(collection(db, collectionName), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)
}

// ── Update ───────────────────────────────────────────────
export async function updateDocById<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: Partial<T>
) {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    actualizadoEn: serverTimestamp(),
  })
}

// ── Delete ───────────────────────────────────────────────
export async function deleteDocById(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id))
}

// ── Realtime listener (single doc) ───────────────────────
export function subscribeDoc<T>(
  collectionName: string,
  id: string,
  callback: (data: T | null) => void
) {
  return onSnapshot(doc(db, collectionName, id), snap => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null)
  })
}

// ── Realtime listener (collection) ───────────────────────
export function subscribeCollection<T>(
  collectionName: string,
  callback: (data: T[]) => void,
  filters:    FirestoreFilter[] = [],
  orderField  = 'creadoEn',
  orderDir:   'asc' | 'desc' = 'desc'
) {
  const constraints: QueryConstraint[] = [
    ...filters.map(f => where(f.field, f.op, f.value)),
    orderBy(orderField, orderDir),
  ]
  const q = query(collection(db, collectionName), ...constraints)
  return onSnapshot(q as Query<DocumentData>, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as T))
  })
}

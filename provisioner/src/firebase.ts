import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { config } from './config.js'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey:  config.firebase.privateKey,
    }),
    projectId: config.firebase.projectId,
  })
}

export const db = getFirestore()
export { FieldValue, Timestamp }

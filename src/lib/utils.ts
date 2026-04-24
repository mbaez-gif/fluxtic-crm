import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Timestamp } from 'firebase/firestore'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Handles all date formats: Firestore Timestamp, Date, ISO string, seconds object
export function toDate(ts: Timestamp | Date | string | number | { seconds: number } | undefined | null): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (typeof ts === 'number') return new Date(ts)
  if (typeof ts === 'object' && 'toDate' in ts && typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate()
  }
  if (typeof ts === 'object' && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000)
  }
  return new Date()
}

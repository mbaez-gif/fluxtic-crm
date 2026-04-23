'use client'

import { useEffect, useState } from 'react'
import { subscribeDoc } from '@/lib/firebase/firestore'

export function useDocument<T>(collectionName: string, id: string | null) {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<Error | null>(null)

  useEffect(() => {
    if (!id) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeDoc<T>(collectionName, id, item => {
      setData(item)
      setLoading(false)
      setError(null)
    })

    return unsubscribe
  }, [collectionName, id])

  return { data, loading, error }
}

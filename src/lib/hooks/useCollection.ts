'use client'

import { useEffect, useState } from 'react'
import { subscribeCollection, type FirestoreFilter } from '@/lib/firebase/firestore'

interface UseCollectionOptions {
  filters?:    FirestoreFilter[]
  orderField?: string
  orderDir?:   'asc' | 'desc'
  enabled?:    boolean
}

export function useCollection<T>(
  collectionName: string,
  options: UseCollectionOptions = {}
) {
  const {
    filters    = [],
    orderField = 'creadoEn',
    orderDir   = 'desc',
    enabled    = true,
  } = options

  const [data,    setData]    = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeCollection<T>(
      collectionName,
      items => {
        setData(items)
        setLoading(false)
        setError(null)
      },
      filters,
      orderField,
      orderDir
    )

    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, enabled, JSON.stringify(filters), orderField, orderDir])

  return { data, loading, error }
}

import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from '../services/firebase'

// Keys isolate old snapshots immediately when navigating between activities.
export function useLive(kind, id, child) {
  const key = `${kind}:${id || ''}:${child || ''}`
  const [result, setResult] = useState({
    key: '',
    data: null,
    loading: true,
    error: '',
    cached: false,
  })
  useEffect(() => {
    if (!db || !id) return
    const target =
      kind === 'owned'
        ? query(
            collection(db, 'activities'),
            where('ownerUid', '==', id),
            orderBy('createdAt', 'desc'),
          )
        : child
          ? query(
              collection(db, 'publicActivities', id, child),
              orderBy(
                child === 'decorations'
                  ? 'createdAt'
                  : child === 'participants'
                    ? 'joinedAt'
                    : 'turnNumber',
                child === 'turns' || child === 'hits' ? 'desc' : 'asc',
              ),
              limit(child === 'turns' || child === 'hits' ? 100 : 3000),
            )
          : doc(db, kind === 'private' ? 'activities' : 'publicActivities', id)
    return onSnapshot(
      target,
      { includeMetadataChanges: true },
      (snapshot) => {
        const data =
          'docs' in snapshot
            ? snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
            : snapshot.exists()
              ? { ...snapshot.data(), id: snapshot.id }
              : null
        setResult({ key, data, loading: false, error: '', cached: snapshot.metadata.fromCache })
      },
      (error) =>
        setResult({ key, data: null, loading: false, error: error.message, cached: false }),
    )
  }, [kind, id, child, key])
  if (!db) return { data: null, loading: false, error: 'Falta configurar Firebase.', cached: false }
  return result.key === key
    ? result
    : { data: null, loading: Boolean(id), error: '', cached: false }
}

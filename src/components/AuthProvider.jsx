import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { ensureUserProfile } from '../services/userProfile'
import { AuthContext } from '../hooks/useAuth'

const signedOut = { user: null, admin: false, loading: false, error: '' }
export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ ...signedOut, loading: Boolean(auth) })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((count) => count + 1), [])
  useEffect(() => {
    if (!auth) return
    let generation = 0
    let unsubscribeProfile = null
    const stopProfile = () => {
      unsubscribeProfile?.()
      unsubscribeProfile = null
    }
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (user) => {
        // Every identity change discards listeners, privileges and pending results of the
        // previous one, so a late response can never publish a stale role.
        const current = ++generation
        stopProfile()
        if (!user) {
          setSession(signedOut)
          return
        }
        setSession({ user, admin: false, loading: true, error: '' })
        try {
          await ensureUserProfile(user)
        } catch (error) {
          if (current === generation)
            setSession({
              user,
              admin: false,
              loading: false,
              error: `No pudimos preparar tu perfil. ${error.message || ''}`.trim(),
            })
          return
        }
        if (current !== generation) return
        // The role lives in users/{uid}.isAdmin and is edited from Firebase Console; this
        // listener applies grants and revocations while the session stays open.
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (current !== generation) return
            setSession({
              user,
              admin: !snapshot.metadata.fromCache && snapshot.data()?.isAdmin === true,
              loading: snapshot.metadata.fromCache,
              error: '',
            })
          },
          (error) => {
            if (current === generation)
              setSession({ user, admin: false, loading: false, error: error.message })
          },
        )
      },
      (error) => setSession({ ...signedOut, error: error.message }),
    )
    return () => {
      generation++
      stopProfile()
      unsubscribeAuth()
    }
  }, [attempt])
  return <AuthContext.Provider value={{ ...session, retry }}>{children}</AuthContext.Provider>
}

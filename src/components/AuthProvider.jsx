import { useEffect, useState } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import { AuthContext } from '../hooks/useAuth'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({
    user: null,
    admin: false,
    loading: Boolean(auth),
    error: '',
  })
  useEffect(() => {
    if (!auth) return
    return onIdTokenChanged(
      auth,
      async (user) => {
        try {
          const token = user ? await user.getIdTokenResult() : null
          // Token refresh can finish after sign-out: only publish the current identity.
          if (auth.currentUser?.uid !== user?.uid) return
          setSession({ user, admin: token?.claims.admin === true, loading: false, error: '' })
        } catch (error) {
          setSession({ user: null, admin: false, loading: false, error: error.message })
        }
      },
      (error) => setSession({ user: null, admin: false, loading: false, error: error.message }),
    )
  }, [])
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}

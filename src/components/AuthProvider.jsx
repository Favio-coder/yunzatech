import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { ensureUserProfile } from '../services/userProfile'
import { AuthContext } from '../hooks/useAuth'

function roleErrorMessage(error) {
  if (error.code === 'permission-denied')
    return 'Firebase denegó el acceso al perfil. Despliega las reglas actualizadas de firestore.rules en el mismo proyecto configurado en la aplicación.'
  return error.message
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({
    user: null,
    admin: false,
    authLoading: Boolean(auth),
    roleLoading: false,
    roleError: '',
    error: '',
  })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!auth) return
    let stopRole = () => {}
    let generation = 0
    const stopAuth = onAuthStateChanged(
      auth,
      async (user) => {
        stopRole()
        const current = ++generation
        setSession({
          user,
          admin: false,
          authLoading: false,
          roleLoading: Boolean(user),
          roleError: '',
          error: '',
        })
        if (!user) return
        try {
          const ref = await ensureUserProfile(db, user)
          if (current !== generation || auth.currentUser?.uid !== user.uid) return
          stopRole = onSnapshot(
            ref,
            { includeMetadataChanges: true },
            (snapshot) => {
              if (current !== generation || auth.currentUser?.uid !== user.uid) return
              // Cached grants cannot establish authority while offline or before server validation.
              setSession({
                user,
                admin: !snapshot.metadata.fromCache && snapshot.data()?.isAdmin === true,
                authLoading: false,
                roleLoading: snapshot.metadata.fromCache,
                roleError: '',
                error: '',
              })
            },
            (error) => {
              if (current !== generation || auth.currentUser?.uid !== user.uid) return
              setSession({
                user,
                admin: false,
                authLoading: false,
                roleLoading: false,
                roleError: roleErrorMessage(error),
                error: '',
              })
            },
          )
        } catch (error) {
          if (current !== generation || auth.currentUser?.uid !== user.uid) return
          setSession({
            user,
            admin: false,
            authLoading: false,
            roleLoading: false,
            roleError: roleErrorMessage(error),
            error: '',
          })
        }
      },
      (error) => {
        ++generation
        stopRole()
        setSession({
          user: null,
          admin: false,
          authLoading: false,
          roleLoading: false,
          roleError: '',
          error: error.message,
        })
      },
    )
    return () => {
      ++generation
      stopRole()
      stopAuth()
    }
  }, [attempt])
  const retryRole = () => {
    setSession((previous) => ({
      ...previous,
      admin: false,
      roleLoading: Boolean(previous.user),
      roleError: '',
    }))
    setAttempt((value) => value + 1)
  }
  return (
    <AuthContext.Provider
      value={{ ...session, isAdmin: session.admin, loading: session.authLoading, retryRole }}
    >
      {children}
    </AuthContext.Provider>
  )
}

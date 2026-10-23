import { createContext, useContext } from 'react'
export const AuthContext = createContext({ user: null, admin: false, loading: true, error: '' })
export const useAuth = () => useContext(AuthContext)

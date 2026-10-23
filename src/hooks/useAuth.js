import { createContext, useContext } from 'react'
export const AuthContext = createContext({
  user: null,
  admin: false,
  isAdmin: false,
  loading: true,
  authLoading: true,
  roleLoading: false,
  roleError: '',
  error: '',
  retryRole: () => {},
})
export const useAuth = () => useContext(AuthContext)

import { createContext, useContext } from 'react'
export const AuthContext = createContext({
  user: null,
  admin: false,
  loading: true,
  error: '',
  retry: () => {},
})
export const useAuth = () => useContext(AuthContext)

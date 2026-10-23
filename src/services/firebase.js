import { initializeApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'

const emulator = import.meta.env.VITE_USE_EMULATORS === 'true'
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (emulator ? 'demo-key' : undefined),
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    (emulator ? 'demo-yunza-tech.firebaseapp.com' : undefined),
  projectId: emulator ? 'demo-yunza-tech' : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (emulator ? 'demo-app' : undefined),
}
export const configured = Boolean(config.apiKey && config.projectId && config.appId)
const app = configured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
const functions = app
  ? getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
  : null
if (emulator && app) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
export const usingEmulators = emulator
export const login = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logout = () => signOut(auth)
export async function operate(payload) {
  if (!functions) throw new Error('Configura Firebase en .env para continuar.')
  return (await httpsCallable(functions, 'operate')(payload)).data
}
export async function serverClock() {
  if (!functions) return 0
  const start = Date.now()
  const result = await httpsCallable(functions, 'clock')()
  return result.data.now - (start + Date.now()) / 2
}

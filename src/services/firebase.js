import { initializeApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

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
// Base URL of the Deno backend without a trailing slash. Routes already include `/api`.
export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || (emulator ? 'http://127.0.0.1:8000' : '')
).replace(/\/+$/, '')
export const apiConfigured = Boolean(apiBaseUrl)
const app = configured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
if (emulator && app) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
export const usingEmulators = emulator
export const login = () => signInWithPopup(auth, new GoogleAuthProvider())
export const logout = () => signOut(auth)

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message)
    this.code = code
    this.status = status
  }
}
const OFFLINE = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'

async function request(path, { method = 'GET', body, authenticated = false } = {}) {
  if (!apiBaseUrl)
    throw new ApiError('unavailable', 'Configura VITE_API_BASE_URL para conectar con el servidor.')
  const user = auth?.currentUser
  if (authenticated && !user) throw new ApiError('unauthenticated', 'Inicia sesión para continuar.')
  const send = async (refreshToken) => {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (authenticated) headers.Authorization = `Bearer ${await user.getIdToken(refreshToken)}`
    return fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
  }
  let response
  try {
    response = await send(false)
    // One retry with a freshly minted token. Payload and request id stay identical.
    if (response.status === 401 && authenticated) response = await send(true)
  } catch {
    throw new ApiError('unavailable', OFFLINE)
  }
  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok || payload?.error)
    throw new ApiError(
      payload?.error?.code || 'internal',
      payload?.error?.message || 'El servidor no pudo completar la operación.',
      response.status,
    )
  return payload
}
export async function operate(payload) {
  const { result } = await request('/api/operate', {
    method: 'POST',
    body: payload,
    authenticated: true,
  })
  return result
}
export async function serverClock() {
  if (!apiBaseUrl) return 0
  const start = Date.now()
  const { now } = await request('/api/clock')
  return now - (start + Date.now()) / 2
}
// Asks the server to check a deadline. The server decides with its own clock.
export async function requestExpiration(activityId) {
  const { result } = await request(`/api/activities/${encodeURIComponent(activityId)}/expire`, {
    method: 'POST',
    authenticated: true,
  })
  return result
}

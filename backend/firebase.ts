import { type App, applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { initDb } from './db.ts'

export interface Settings {
  projectId: string
  /** True only when both emulator variables are present and the project is a demo project. */
  localMode: boolean
  allowedOrigins: string[]
  port: number
  /** Local-only replacement for the cloud cron; 0 disables it. */
  localClockMs: number
}

const EMULATOR_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']

export function loadSettings(get: (name: string) => string | undefined = Deno.env.get): Settings {
  const projectId = (get('FIREBASE_PROJECT_ID') || '').trim()
  if (!projectId)
    throw new Error('Define FIREBASE_PROJECT_ID con el ID real del proyecto Firebase.')
  const present = EMULATOR_VARS.filter((name) => get(name))
  const localMode = present.length > 0
  if (localMode && present.length !== EMULATOR_VARS.length)
    throw new Error(`Define ${EMULATOR_VARS.join(' y ')} juntas, o ninguna de las dos.`)
  if (localMode && !projectId.startsWith('demo-'))
    throw new Error('Las variables de emulador solo se aceptan con un proyecto demo-*.')
  if (localMode && get('DENO_DEPLOY') === 'true')
    throw new Error('Variables de emulador detectadas en Deno Deploy. Revisa el contexto.')
  if (localMode && get('GOOGLE_APPLICATION_CREDENTIALS'))
    throw new Error('No mezcles credenciales de Google con el modo local.')
  const allowedOrigins = (get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (!allowedOrigins.length)
    throw new Error('Define ALLOWED_ORIGINS con los orígenes exactos del frontend.')
  for (const origin of allowedOrigins) {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error(`Origen inválido en ALLOWED_ORIGINS: ${origin}`)
    }
    if (parsed.origin !== origin)
      throw new Error(
        `ALLOWED_ORIGINS admite solo orígenes exactos (esquema://host[:puerto]): ${origin}`,
      )
  }
  const port = Number(get('PORT') || 8000)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('PORT inválido.')
  const localClockMs = localMode ? Number(get('LOCAL_CLOCK_MS') || 0) : 0
  if (!Number.isInteger(localClockMs) || localClockMs < 0)
    throw new Error('LOCAL_CLOCK_MS inválido.')
  return { projectId, localMode, allowedOrigins, port, localClockMs }
}

export type IdentityStatus = 'local' | 'pending' | 'ok' | 'error'
let identity: IdentityStatus = 'pending'
/** Result of the start-up credential probe, exposed by /api/health as a single word. */
export const identityStatus = (): IdentityStatus => identity

let app: App | undefined

/**
 * Admin SDK app (used for ID token verification) plus the Firestore client. In the cloud the
 * Google identity is probed once at start-up so a broken Cloud Connection shows up in the logs
 * and in /api/health instead of as 500s on the first game operation.
 */
export function initFirebase(settings: Settings): App {
  if (app) return app
  app = getApps()[0] ?? initializeApp({ projectId: settings.projectId })
  initDb(settings)
  if (settings.localMode) identity = 'local'
  else
    applicationDefault()
      .getAccessToken()
      .then(() => {
        identity = 'ok'
        console.log('Identidad de Google verificada mediante Application Default Credentials.')
      })
      .catch((error) => {
        identity = 'error'
        console.error(
          'No se pudieron obtener credenciales de Google. Revisa la Cloud Connection de Deno Deploy:',
          error?.message,
        )
      })
  return app
}

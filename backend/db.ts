import { Firestore, Timestamp } from '@google-cloud/firestore'
import { OAuth2Client } from 'google-auth-library'
import type { Settings } from './firebase.ts'

let db: Firestore | undefined

/**
 * One Firestore client per process, always on the REST transport so Deno Deploy needs no
 * gRPC/HTTP2 sockets. In the cloud, credentials come from Application Default Credentials,
 * which the Deno Deploy Cloud Connection injects and the SDK renews by itself. The emulator
 * only needs the fixed "owner" bearer, so local mode uses a static client and never looks for
 * real credentials.
 */
export function initDb(settings: Settings): Firestore {
  if (db) return db
  const base = { projectId: settings.projectId, preferRest: true }
  if (settings.localMode) {
    const authClient = new OAuth2Client()
    authClient.setCredentials({ access_token: 'owner', expiry_date: Number.MAX_SAFE_INTEGER })
    db = new Firestore({ ...base, authClient } as FirebaseFirestore.Settings)
  } else db = new Firestore(base)
  return db
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firestore no está inicializado. Llama a initFirebase primero.')
  return db
}

export { Timestamp }

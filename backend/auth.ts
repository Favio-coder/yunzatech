import { type DecodedIdToken, getAuth } from 'firebase-admin/auth'
import { GameError } from './domain.js'

export interface Identity {
  uid: string
  token: DecodedIdToken
}

/**
 * Verifies a Firebase ID token with the Admin SDK (signature, issuer, audience, expiry).
 * Nothing in the request body is ever trusted as identity. Tokens are never logged.
 */
export async function authenticate(request: Request): Promise<Identity> {
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(request.headers.get('authorization') || '')
  if (!match) throw new GameError('unauthenticated', 'Inicia sesión para continuar.')
  try {
    const token = await getAuth().verifyIdToken(match[1])
    return { uid: token.uid, token }
  } catch (error) {
    const code = (error as { code?: string })?.code || 'unknown'
    console.warn('ID token rejected', code)
    throw new GameError(
      'unauthenticated',
      'Tu sesión no es válida o expiró. Vuelve a iniciar sesión e inténtalo de nuevo.',
    )
  }
}

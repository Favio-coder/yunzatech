import { GameError } from './domain.js'

export const STATUS_BY_CODE: Record<string, number> = {
  'invalid-argument': 400,
  unauthenticated: 401,
  'permission-denied': 403,
  'not-found': 404,
  'method-not-allowed': 405,
  'already-exists': 409,
  'failed-precondition': 409,
  aborted: 409,
  'payload-too-large': 413,
}
export const MAX_BODY_BYTES = 16 * 1024

export class HttpError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function corsHeaders(origin: string | null, allowedOrigins: string[]): Headers {
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' })
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    headers.set('Access-Control-Max-Age', '600')
  }
  return headers
}

export function json(body: unknown, status: number, base: Headers): Response {
  const headers = new Headers(base)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

export function failure(code: string, message: string, base: Headers): Response {
  return json({ error: { code, message } }, STATUS_BY_CODE[code] || 500, base)
}

/** Domain and HTTP errors map to their status; anything else is a generic 500. */
export function errorResponse(error: unknown, base: Headers): Response {
  if (error instanceof GameError || error instanceof HttpError)
    return failure(error.code, error.message, base)
  console.error('Unexpected failure', error)
  return failure(
    'internal',
    'No se pudo completar la operación. Reintenta con la misma solicitud.',
    base,
  )
}

/** Reads a JSON object body with a hard size limit; rejects invalid or non-object JSON. */
export async function readJsonObject(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<Record<string, unknown>> {
  const tooLarge = () => new HttpError('payload-too-large', 'La solicitud es demasiado grande.')
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw tooLarge()
  if (!request.body) throw new HttpError('invalid-argument', 'Falta el cuerpo de la solicitud.')
  const chunks: Uint8Array[] = []
  let received = 0
  const reader = request.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel()
        throw tooLarge()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(buffer))
  } catch {
    throw new HttpError('invalid-argument', 'El cuerpo debe ser JSON válido.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new HttpError('invalid-argument', 'El cuerpo debe ser un objeto JSON.')
  return parsed as Record<string, unknown>
}

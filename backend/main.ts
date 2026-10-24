import { authenticate } from './auth.ts'
import { identityStatus, initFirebase, loadSettings, type Settings } from './firebase.ts'
import { corsHeaders, errorResponse, failure, HttpError, json, readJsonObject } from './http.ts'
import { executeOperation, expireActivity, expireDue, idPattern } from './service.js'

const settings = loadSettings()
initFirebase(settings)

// Recovery of missed deadlines without browsers. Registered at the top level, as Deno Deploy
// requires. Minute granularity: connected browsers request the exact deadline via /expire.
Deno.cron('recover-deadlines', '* * * * *', { backoffSchedule: [5000, 20000] }, async () => {
  const processed = await expireDue()
  if (processed) console.log(`cron recover-deadlines: ${processed} actividades revisadas`)
})

// Local-only replacement for the cloud cron so emulator sessions advance turns every second.
if (settings.localClockMs > 0)
  setInterval(() => {
    expireDue().catch((error) => console.error('local clock', error?.message))
  }, settings.localClockMs)

const EXPIRE_ROUTE = /^\/api\/activities\/([^/]+)\/expire$/
const methodNotAllowed = () => new HttpError('method-not-allowed', 'Método no permitido.')

export async function handle(request: Request, config: Settings = settings): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  const base = corsHeaders(origin, config.allowedOrigins)
  if (request.method === 'OPTIONS') {
    if (origin && !config.allowedOrigins.includes(origin))
      return failure('permission-denied', 'Origen no permitido.', base)
    return new Response(null, { status: 204, headers: base })
  }
  try {
    const path = url.pathname
    if (path === '/api/health') {
      if (request.method !== 'GET') throw methodNotAllowed()
      const mode = config.localMode ? 'local' : 'cloud'
      return json({ ok: true, mode, identity: identityStatus() }, 200, base)
    }
    if (path === '/api/clock') {
      if (request.method !== 'GET') throw methodNotAllowed()
      return json({ now: Date.now() }, 200, base)
    }
    if (path === '/api/operate') {
      if (request.method !== 'POST') throw methodNotAllowed()
      const identity = await authenticate(request)
      const input = await readJsonObject(request)
      const result = await executeOperation(identity, input)
      return json({ result }, 200, base)
    }
    const expire = EXPIRE_ROUTE.exec(path)
    if (expire) {
      if (request.method !== 'POST') throw methodNotAllowed()
      const activityId = decodeURIComponent(expire[1])
      if (!idPattern.test(activityId))
        return failure('invalid-argument', 'Actividad inválida.', base)
      const identity = await authenticate(request)
      const expired = await expireActivity(activityId, identity)
      return json({ result: { activityId, expired, now: Date.now() } }, 200, base)
    }
    if (config.localMode && path === '/api/dev/expire-due') {
      // Emulator-only stand-in for the cron so tests can trigger recovery deterministically.
      if (request.method !== 'POST') throw methodNotAllowed()
      return json({ result: { processed: await expireDue() } }, 200, base)
    }
    return failure('not-found', 'Ruta no encontrada.', base)
  } catch (error) {
    return errorResponse(error, base)
  }
}

export function startServer() {
  return Deno.serve({ port: settings.port }, (request) => handle(request))
}

if (import.meta.main) startServer()

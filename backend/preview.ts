// Deploy warms up preview timelines before production. Unconfigured previews must
// start without connecting to production Firestore or running deadline recovery.
export function unconfiguredPreview(get: (name: string) => string | undefined): boolean {
  const timeline = get('DENO_TIMELINE') || ''
  return (
    get('DENO_DEPLOY') === 'true' &&
    timeline !== 'production' &&
    !get('FIREBASE_PROJECT_ID')?.trim()
  )
}

export function previewResponse(request: Request): Response {
  const health = request.method === 'GET' && new URL(request.url).pathname === '/api/health'
  return Response.json(
    health
      ? { ok: true, mode: 'preview-disabled', identity: 'disabled' }
      : { error: { code: 'unavailable', message: 'Esta preview no tiene Firebase configurado.' } },
    { status: health ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}

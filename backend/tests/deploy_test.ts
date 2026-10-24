import assert from 'node:assert/strict'
import { previewResponse, unconfiguredPreview } from '../deploy.ts'

Deno.test('only unconfigured Deploy preview timelines enter the inert preview mode', () => {
  const env = (extra: Record<string, string> = {}) => {
    const values = { DENO_DEPLOY: 'true', DENO_TIMELINE: 'preview/test', ...extra }
    return (name: string) => values[name as keyof typeof values]
  }
  assert.equal(unconfiguredPreview(env()), true)
  assert.equal(unconfiguredPreview(env({ DENO_TIMELINE: 'git-branch/main' })), true)
  assert.equal(unconfiguredPreview(env({ DENO_TIMELINE: 'production' })), false)
  assert.equal(unconfiguredPreview(env({ DENO_TIMELINE: '' })), false)
  assert.equal(unconfiguredPreview(env({ DENO_DEPLOY: 'false' })), false)
  assert.equal(unconfiguredPreview(env({ FIREBASE_PROJECT_ID: 'preview-project' })), false)
})

Deno.test('inert preview reports its mode and rejects all game operations', async () => {
  const health = previewResponse(new Request('https://preview.test/api/health'))
  assert.equal(health.status, 200)
  assert.equal((await health.json()).mode, 'preview-disabled')
  for (const path of ['/api/operate', '/api/activities/example/expire', '/']) {
    const response = previewResponse(new Request('https://preview.test' + path, { method: 'POST' }))
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  }
})

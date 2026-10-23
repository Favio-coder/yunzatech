import assert from 'node:assert/strict'
import { loadSettings } from '../firebase.ts'

const env = (values: Record<string, string>) => (name: string) => values[name]
const demo = { FIREBASE_PROJECT_ID: 'demo-yunza-tech', ALLOWED_ORIGINS: 'http://localhost:5173' }
const emulators = {
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
}

Deno.test('cloud settings never accept emulator variables outside demo projects', () => {
  const real = { FIREBASE_PROJECT_ID: 'real-project', ALLOWED_ORIGINS: 'https://yunza.example' }
  const cloud = loadSettings(env(real))
  assert.equal(cloud.localMode, false)
  assert.equal(cloud.localClockMs, 0)
  assert.throws(() => loadSettings(env({ ...real, ...emulators })))
  assert.throws(() => loadSettings(env({ ...demo, ...emulators, DENO_DEPLOY: 'true' })))
  assert.throws(() =>
    loadSettings(env({ ...demo, ...emulators, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/x.json' })),
  )
})

Deno.test('local mode requires both emulator variables and a demo project', () => {
  const local = loadSettings(env({ ...demo, ...emulators, LOCAL_CLOCK_MS: '1000' }))
  assert.equal(local.localMode, true)
  assert.equal(local.localClockMs, 1000)
  assert.throws(() => loadSettings(env({ ...demo, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })))
})

Deno.test('origins must be exact and present', () => {
  assert.throws(() => loadSettings(env({ FIREBASE_PROJECT_ID: 'p' })))
  assert.throws(() =>
    loadSettings(env({ FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'https://a.example/path' })),
  )
  assert.throws(() => loadSettings(env({ FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: 'a.example' })))
  const spaced = ' https://a.example , https://b.example:8443 '
  assert.deepEqual(
    loadSettings(env({ FIREBASE_PROJECT_ID: 'p', ALLOWED_ORIGINS: spaced })).allowedOrigins,
    ['https://a.example', 'https://b.example:8443'],
  )
})

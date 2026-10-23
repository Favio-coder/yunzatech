import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { denoBinary } from '../scripts/deno-path.js'
// Starts the Deno backend against the emulators that `firebase emulators:exec` provides, waits for
// its health endpoint and then runs the Node integration suite against it.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Ejecuta npm run test:emulators. Nunca se prueba contra producción.')
const port = Number(process.env.API_TEST_PORT || 8787)
const apiBaseUrl = `http://127.0.0.1:${port}`
const backend = spawn(
  denoBinary(),
  ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-sys', 'main.ts'],
  {
    cwd: resolve('backend'),
    env: {
      ...process.env,
      FIREBASE_PROJECT_ID: 'demo-yunza-tech',
      ALLOWED_ORIGINS: 'http://localhost:5173',
      PORT: String(port),
      LOCAL_CLOCK_MS: '0',
    },
    stdio: 'inherit',
  },
)
let exited = false
backend.on('exit', () => {
  exited = true
})
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function ready() {
  for (let i = 0; i < 120; i++) {
    if (exited) throw new Error('El backend Deno terminó antes de estar listo.')
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`)
      if (response.ok) return
    } catch {
      /* not ready yet */
    }
    await wait(500)
  }
  throw new Error('El backend Deno no respondió en 60 segundos.')
}
let code = 1
try {
  await ready()
  code = await new Promise((resolve) => {
    const tests = spawn(process.execPath, ['--test', 'tests/emulator.test.js'], {
      env: { ...process.env, API_BASE_URL: apiBaseUrl },
      stdio: 'inherit',
    })
    tests.on('exit', (status) => resolve(status ?? 1))
  })
} catch (error) {
  console.error(error.message)
} finally {
  if (!exited) backend.kill()
}
process.exit(code)

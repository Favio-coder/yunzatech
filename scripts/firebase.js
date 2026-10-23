import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join, delimiter } from 'node:path'
const env = { ...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' }
const javaRoot = resolve('.tools/java21')
if (!env.JAVA_HOME && existsSync(javaRoot)) {
  const installation = readdirSync(javaRoot).find((name) =>
    existsSync(join(javaRoot, name, 'bin', 'java.exe')),
  )
  if (installation) {
    env.JAVA_HOME = join(javaRoot, installation)
    // Windows environment keys are case-insensitive; avoid duplicate Path/PATH entries.
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH'
    env[pathKey] = `${join(env.JAVA_HOME, 'bin')}${delimiter}${env[pathKey] || ''}`
  }
}
const cli = resolve('node_modules/firebase-tools/lib/bin/firebase.js')
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})

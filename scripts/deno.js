import { spawn } from 'node:child_process'
import { denoBinary } from './deno-path.js'
// Wrapper so npm scripts work with a portable Deno (.tools/deno) or one installed on PATH.
const child = spawn(denoBinary(), process.argv.slice(2), { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(
    `${error.message}\nInstala Deno (https://docs.deno.com/runtime/getting_started/installation/) o descomprímelo en .tools/deno.`,
  )
  process.exit(1)
})

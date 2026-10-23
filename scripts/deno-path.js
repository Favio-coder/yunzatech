import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
// Deno binary resolution: explicit DENO_BIN, portable .tools/deno (ignored by Git), then PATH.
export function denoBinary() {
  if (process.env.DENO_BIN) return process.env.DENO_BIN
  const portable = resolve('.tools/deno', process.platform === 'win32' ? 'deno.exe' : 'deno')
  return existsSync(portable) ? portable : 'deno'
}

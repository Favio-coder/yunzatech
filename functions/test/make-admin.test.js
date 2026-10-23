import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
for (const script of ['make-admin', 'grant-admin']) {
  test(script + ' only displays migration instructions without credentials', () => {
    const output = execFileSync(
      process.execPath,
      [
        new URL('../scripts/' + script + '.js', import.meta.url).pathname.replace(
          /^\/([A-Za-z]:)/,
          '$1',
        ),
      ],
      { encoding: 'utf8' },
    )
    assert.match(output, /users\/\{UID exacto\}/)
    assert.match(output, /No se modificaron permisos/)
  })
}

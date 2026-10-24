import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { getApps, initializeApp } from 'firebase-admin/app'
import { authenticate } from '../auth.ts'

// Production-mode verification: the emulator accepts unsigned tokens by design, so forged
// signatures can only be rejected when the SDK fetches Google's public keys. Needs network.
const offline = Deno.env.get('SKIP_NETWORK_TESTS') === 'true'
const projectId = 'yunza-auth-check'
const base64url = (value: string | Uint8Array) =>
  Buffer.from(value).toString('base64url').replace(/=+$/, '')
const claims = () => {
  const now = Math.floor(Date.now() / 1000)
  return {
    sub: 'forged-uid',
    user_id: 'forged-uid',
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    auth_time: now,
    iat: now,
    exp: now + 3600,
  }
}
function signed(header: Record<string, unknown>, privateKey: string | null) {
  const head = base64url(JSON.stringify(header))
  const body = base64url(JSON.stringify(claims()))
  if (!privateKey) return `${head}.${body}.`
  const signer = createSign('RSA-SHA256')
  signer.update(`${head}.${body}`)
  return `${head}.${body}.${base64url(signer.sign(privateKey))}`
}
const request = (token: string) =>
  new Request('http://localhost/api/operate', { headers: { Authorization: `Bearer ${token}` } })

Deno.test({
  name: 'cloud mode rejects unsigned, self-signed and malformed ID tokens',
  ignore: offline,
  async fn() {
    Deno.env.delete('FIREBASE_AUTH_EMULATOR_HOST')
    Deno.env.delete('FIRESTORE_EMULATOR_HOST')
    if (!getApps().length) initializeApp({ projectId })
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    const cases = [
      signed({ alg: 'none', typ: 'JWT' }, null),
      signed({ alg: 'RS256', typ: 'JWT', kid: 'forged-key-id' }, privateKey),
      'not-a-token',
    ]
    for (const token of cases)
      await assert.rejects(authenticate(request(token)), { code: 'unauthenticated' })
    await assert.rejects(authenticate(new Request('http://localhost/api/operate')), {
      code: 'unauthenticated',
    })
  },
})

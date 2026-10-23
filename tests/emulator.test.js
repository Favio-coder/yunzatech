import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
const projectId = 'demo-yunza-tech'
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Ejecuta npm run test:emulators. Nunca se prueba contra producción.')
const api = process.env.API_BASE_URL
if (!api) throw new Error('Falta API_BASE_URL; usa tests/run-integration.js.')
initializeApp({ projectId })
const db = getFirestore()
const adminAuth = getAuth()
const config = {
  name: 'Prueba de Yunza',
  description: '',
  decorationMinutes: 1,
  initialHealth: 25,
  minDamage: 10,
  maxDamage: 10,
  turnSeconds: 30,
  decorationLimit: 1,
}
async function person(name, role) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@example.com`
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
    },
  )
  const account = await response.json()
  if (!account.localId) throw new Error(JSON.stringify(account))
  await adminAuth.updateUser(account.localId, { displayName: name })
  // Roles only exist as users/{uid}.isAdmin, exactly as an operator sets them in Firebase Console.
  if (role !== undefined)
    await db.doc(`users/${account.localId}`).set({ displayName: name, email, isAdmin: role })
  const signIn = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
    },
  )
  return { uid: account.localId, email, token: (await signIn.json()).idToken }
}
async function post(path, person, body) {
  const response = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(person ? { Authorization: `Bearer ${person.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || `HTTP ${response.status}`)
    error.code = payload.error?.code
    error.status = response.status
    throw error
  }
  return payload.result
}
const call = (person, data) =>
  post('/api/operate', person, { requestId: crypto.randomUUID(), ...data })
const expire = (person, id) => post(`/api/activities/${id}/expire`, person)
const cron = () => post('/api/dev/expire-due', null)
const snapshot = async (id) => (await db.doc(`activities/${id}`).get()).data()
test('full multiplayer flow, transactions, authority and security rules', async (t) => {
  const rules = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  })
  await rules.clearFirestore()
  const owner = await person('Organizador', true)
  const otherAdmin = await person('OtroAdmin', true)
  const textAdmin = await person('TextoAdmin', 'true')
  const first = await person('Ana')
  const second = await person('Luis', false)
  const people = [first, second]
  let id
  try {
    await t.test('health, clock, CORS, body limits and HTTP error shapes', async () => {
      const health = await fetch(`${api}/api/health`)
      assert.equal(health.status, 200)
      assert.equal(health.headers.get('cache-control'), 'no-store')
      const clock = await (await fetch(`${api}/api/clock`)).json()
      assert.ok(Math.abs(clock.now - Date.now()) < 5000)
      const preflight = await fetch(`${api}/api/operate`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      })
      assert.equal(preflight.status, 204)
      assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173')
      assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/)
      const foreign = await fetch(`${api}/api/operate`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
      })
      assert.equal(foreign.status, 403)
      assert.equal(foreign.headers.get('access-control-allow-origin'), null)
      const missing = await fetch(`${api}/api/nothing`)
      assert.equal(missing.status, 404)
      assert.equal((await missing.json()).error.code, 'not-found')
      assert.equal((await fetch(`${api}/api/clock`, { method: 'POST' })).status, 405)
      const invalid = await fetch(`${api}/api/operate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${first.token}`, 'Content-Type': 'application/json' },
        body: '{not json',
      })
      assert.equal(invalid.status, 400)
      const huge = await fetch(`${api}/api/operate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${first.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', padding: 'x'.repeat(20000) }),
      })
      assert.equal(huge.status, 413)
    })
    await t.test(
      'tokens: missing, malformed, expired and foreign-project are rejected',
      async () => {
        await assert.rejects(call(null, { action: 'create', config }), { status: 401 })
        await assert.rejects(call({ token: 'not-a-token' }, { action: 'join', activityId: 'x' }), {
          code: 'unauthenticated',
        })
        // The Auth emulator skips signature checks by design but still validates the claims.
        // Signature verification against Google keys is covered by backend/tests/auth_test.ts.
        const [header, payload] = first.token.split('.')
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
        const forge = (changes) =>
          `${header}.${Buffer.from(JSON.stringify({ ...claims, ...changes })).toString('base64url')}.`
        const expired = forge({ iat: claims.iat - 7200, exp: claims.iat - 3600 })
        const foreign = forge({
          aud: 'other-project',
          iss: 'https://securetoken.google.com/other-project',
        })
        for (const token of [expired, foreign])
          await assert.rejects(call({ token }, { action: 'join', activityId: 'x' }), {
            code: 'unauthenticated',
          })
      },
    )
    await t.test('only users/{uid}.isAdmin === true (boolean) grants administration', async () => {
      await assert.rejects(call(first, { action: 'create', config }), { code: 'permission-denied' })
      await assert.rejects(call(second, { action: 'create', config }), {
        code: 'permission-denied',
      })
      await assert.rejects(call(textAdmin, { action: 'create', config }), {
        code: 'permission-denied',
      })
      id = (await call(owner, { action: 'create', config })).activityId
      await assert.rejects(
        call(otherAdmin, { action: 'registration', activityId: id, open: false }),
        { code: 'permission-denied' },
      )
      await assert.rejects(call(owner, { action: 'decorateStart', activityId: id }))
      await assert.rejects(call(owner, { action: 'playStart', activityId: id }))
    })
    await t.test('revoking the role blocks new operations and replayed receipts', async () => {
      const request = {
        requestId: crypto.randomUUID(),
        action: 'registration',
        activityId: id,
        open: true,
      }
      await call(owner, request)
      await db.doc(`users/${owner.uid}`).update({ isAdmin: false })
      await assert.rejects(call(owner, request), { code: 'permission-denied' })
      await assert.rejects(call(owner, { action: 'registration', activityId: id, open: false }), {
        code: 'permission-denied',
      })
      await db.doc(`users/${owner.uid}`).update({ isAdmin: true })
      assert.deepEqual(await call(owner, request), { activityId: id })
    })
    await t.test('two unique participants join through code and link', async () => {
      const { code } = await snapshot(id)
      await call(first, { action: 'joinCode', code })
      await Promise.all([
        call(second, { action: 'join', activityId: id }),
        call(second, { action: 'join', activityId: id }),
      ])
      assert.equal((await snapshot(id)).participantCount, 2)
      const profile = (await db.doc(`users/${first.uid}`).get()).data()
      assert.equal(profile.isAdmin, false)
      assert.equal(profile.displayName, 'Ana')
    })
    await t.test(
      'decoration is shared; ownership, geometry, limits and idempotency enforced',
      async () => {
        await call(owner, { action: 'decorateStart', activityId: id })
        await assert.rejects(
          call(first, { action: 'decorate', activityId: id, kind: 'gift', x: 0, y: 0 }),
        )
        const request = {
          requestId: crypto.randomUUID(),
          action: 'decorate',
          activityId: id,
          kind: 'gift',
          x: 0.5,
          y: 0.37,
        }
        await Promise.all([call(first, request), call(first, request)])
        await call(second, { action: 'decorate', activityId: id, kind: 'ribbon', x: 0.4, y: 0.3 })
        await assert.rejects(call(first, { ...request, requestId: crypto.randomUUID() }))
        await assert.rejects(call(first, { ...request, kind: 'ribbon' }), {
          code: 'already-exists',
        })
        const read = rules.unauthenticatedContext().firestore()
        assert.equal(
          (await getDocs(collection(read, `publicActivities/${id}/decorations`))).size,
          2,
        )
        assert.equal((await getDoc(doc(read, `publicActivities/${id}`))).data().state, 'DECORATING')
      },
    )
    await t.test('expiration notices: early, unauthorized, concurrent and recovery', async () => {
      assert.equal((await expire(first, id)).expired, false)
      await assert.rejects(expire(otherAdmin, id), { code: 'permission-denied' })
      await assert.rejects(expire(first, 'missing-activity'), { code: 'not-found' })
      const now = Date.now() - 1000
      await db.doc(`activities/${id}`).update({ decorationEndsAt: now, nextDeadline: now })
      await assert.rejects(
        call(first, { action: 'decorate', activityId: id, kind: 'gift', x: 0.5, y: 0.4 }),
      )
      const results = await Promise.all([expire(first, id), expire(second, id), expire(owner, id)])
      assert.equal(results.filter((r) => r.expired).length, 1)
      assert.equal((await snapshot(id)).state, 'READY')
      assert.equal((await expire(owner, id)).expired, false)
      await assert.rejects(
        call(first, { action: 'decorate', activityId: id, kind: 'gift', x: 0.5, y: 0.4 }),
      )
    })
    await t.test('eligible list freezes and only current participant can hit', async () => {
      await call(owner, { action: 'playStart', activityId: id })
      const a = await snapshot(id)
      const wrong = people.find((p) => p.uid !== a.currentTurnUid)
      await assert.rejects(
        call(wrong, { action: 'hit', activityId: id, turnNumber: a.turnNumber }),
        { code: 'permission-denied' },
      )
      await assert.rejects(call(otherAdmin, { action: 'join', activityId: id }))
      assert.equal(a.eligibleUids.length, 2)
    })
    await t.test('double click and network retry record a single hit', async () => {
      const a = await snapshot(id)
      const current = people.find((p) => p.uid === a.currentTurnUid)
      const request = {
        requestId: crypto.randomUUID(),
        action: 'hit',
        activityId: id,
        turnNumber: a.turnNumber,
      }
      await Promise.all([call(current, request), call(current, request)])
      const updated = await snapshot(id)
      assert.equal(updated.health, 15)
      assert.equal(updated.hitCount, 1)
      await assert.rejects(call(current, { ...request, requestId: crypto.randomUUID() }))
      assert.equal((await db.collection(`activities/${id}/hits`).get()).size, 1)
    })
    await t.test('cron recovery skips a timed-out turn exactly once without browsers', async () => {
      const a = await snapshot(id)
      const deadline = Date.now() - 1000
      await db.doc(`activities/${id}`).update({ turnEndsAt: deadline, nextDeadline: deadline })
      const [one, two] = await Promise.all([cron(), cron()])
      assert.ok(one.processed + two.processed >= 1)
      const updated = await snapshot(id)
      assert.equal(updated.turnNumber, a.turnNumber + 1)
      const turn = (await db.doc(`activities/${id}/turns/${a.turnNumber}`).get()).data()
      assert.equal(turn.status, 'SKIPPED')
      assert.equal(turn.reason, 'TIMEOUT')
      assert.equal((await cron()).processed, 0)
    })
    await t.test('admin skip cannot skip a stale or foreign turn', async () => {
      const a = await snapshot(id)
      await assert.rejects(
        call(otherAdmin, { action: 'skip', activityId: id, turnNumber: a.turnNumber }),
        { code: 'permission-denied' },
      )
      await call(owner, { action: 'skip', activityId: id, turnNumber: a.turnNumber })
      await assert.rejects(
        call(owner, { action: 'skip', activityId: id, turnNumber: a.turnNumber }),
      )
    })
    await t.test('concurrent requests produce a single persistent winner', async () => {
      for (let i = 0; i < 2; i++) {
        const a = await snapshot(id)
        const current = people.find((p) => p.uid === a.currentTurnUid)
        const results = await Promise.allSettled([
          call(current, { action: 'hit', activityId: id, turnNumber: a.turnNumber }),
          call(current, { action: 'hit', activityId: id, turnNumber: a.turnNumber }),
        ])
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      }
      const a = await snapshot(id)
      assert.equal(a.health, 0)
      assert.equal(a.state, 'FINISHED')
      assert.equal(a.hitCount, 3)
      assert.ok(a.winnerUid)
      assert.ok(a.winningHitId)
      await assert.rejects(call(first, { action: 'hit', activityId: id, turnNumber: a.turnNumber }))
      assert.equal((await expire(first, id)).expired, false)
      const read = rules.unauthenticatedContext().firestore()
      const publicDoc = (await getDoc(doc(read, `publicActivities/${id}`))).data()
      assert.equal(publicDoc.winnerUid, a.winnerUid)
      assert.equal((await db.doc(`publicActivities/${id}`).get()).data().winnerUid, a.winnerUid)
      for (const key of ['email', 'ownerUid', 'code', 'roster', 'queue'])
        assert.equal(key in publicDoc, false)
    })
    await t.test(
      'profiles: self-creation with isAdmin false, legacy init, no escalation',
      async () => {
        const fresh = await person('Nueva')
        const mine = rules.authenticatedContext(fresh.uid, { email: fresh.email }).firestore()
        const ref = doc(mine, `users/${fresh.uid}`)
        await assertFails(
          setDoc(ref, {
            displayName: 'Nueva',
            email: fresh.email,
            isAdmin: true,
            createdAt: serverTimestamp(),
          }),
        )
        await assertFails(
          setDoc(ref, {
            displayName: 'Nueva',
            email: 'otra@example.com',
            isAdmin: false,
            createdAt: serverTimestamp(),
          }),
        )
        await assertSucceeds(
          setDoc(ref, {
            displayName: 'Nueva',
            email: fresh.email,
            isAdmin: false,
            createdAt: serverTimestamp(),
          }),
        )
        await assertSucceeds(getDoc(ref))
        await assertFails(updateDoc(ref, { isAdmin: true }))
        await assertFails(updateDoc(ref, { displayName: 'Otra' }))
        await assertFails(getDoc(doc(mine, `users/${first.uid}`)))
        await assertFails(getDocs(collection(mine, 'users')))
        // A profile created before the role existed can only be initialised with isAdmin false.
        const legacy = await person('Antigua')
        await db.doc(`users/${legacy.uid}`).set({ displayName: 'Antigua', email: legacy.email })
        const legacyRef = doc(
          rules.authenticatedContext(legacy.uid, { email: legacy.email }).firestore(),
          `users/${legacy.uid}`,
        )
        await assertFails(updateDoc(legacyRef, { isAdmin: true }))
        await assertSucceeds(updateDoc(legacyRef, { isAdmin: false }))
        await assertFails(updateDoc(legacyRef, { isAdmin: false }))
        // A role granted from the console survives any profile re-check by its owner.
        await db.doc(`users/${legacy.uid}`).update({ isAdmin: true })
        await assertFails(updateDoc(legacyRef, { isAdmin: false }))
        assert.equal((await db.doc(`users/${legacy.uid}`).get()).data().isAdmin, true)
      },
    )
    await t.test(
      'rules block direct writes, privilege escalation and private data access',
      async () => {
        const client = rules.authenticatedContext(first.uid).firestore()
        const other = rules.authenticatedContext(otherAdmin.uid).firestore()
        const own = rules.authenticatedContext(owner.uid).firestore()
        await assertFails(setDoc(doc(client, `users/${first.uid}`), { isAdmin: true }))
        await assertFails(setDoc(doc(client, `users/${first.uid}`), { admin: true }))
        await assertFails(setDoc(doc(client, `activities/${id}`), { health: 0 }, { merge: true }))
        await assertFails(
          setDoc(doc(client, `publicActivities/${id}`), { winnerUid: first.uid }, { merge: true }),
        )
        await assertFails(
          setDoc(doc(client, `publicActivities/${id}/decorations/forged`), {
            uid: first.uid,
            x: 0.5,
            y: 0.4,
          }),
        )
        await assertFails(getDoc(doc(client, `activities/${id}`)))
        await assertFails(getDoc(doc(other, `activities/${id}`)))
        await assertSucceeds(getDoc(doc(own, `activities/${id}`)))
        await assertSucceeds(
          getDocs(query(collection(own, 'activities'), where('ownerUid', '==', owner.uid))),
        )
        await assertFails(getDocs(collection(own, 'activities')))
        await assertFails(getDoc(doc(client, `joinCodes/${(await snapshot(id)).code}`)))
        await assertFails(getDoc(doc(own, `users/${owner.uid}/requests/anything`)))
        await assertFails(
          getDocs(collection(rules.unauthenticatedContext().firestore(), 'publicActivities')),
        )
      },
    )
    await t.test('independent activities, edits, registration and cancellation', async () => {
      const secondId = (await call(owner, { action: 'create', config })).activityId
      await call(owner, {
        action: 'updateConfig',
        activityId: secondId,
        config: { ...config, name: 'Otra fiesta' },
      })
      await call(owner, { action: 'registration', activityId: secondId, open: false })
      await assert.rejects(call(first, { action: 'join', activityId: secondId }))
      await call(owner, { action: 'cancel', activityId: secondId })
      await assert.rejects(call(owner, { action: 'decorateStart', activityId: secondId }))
      assert.equal((await snapshot(id)).state, 'FINISHED')
      assert.equal((await snapshot(secondId)).state, 'CANCELLED')
    })
  } finally {
    await rules.cleanup()
  }
})

import test from 'node:test'
import { ensureUserProfile } from '../src/services/userProfile.js'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const projectId = 'demo-yunza-tech'
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Ejecuta npm run test:emulators. Nunca se prueba contra producción.')
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
async function person(name, isAdmin = false) {
  const email = `${name}-${crypto.randomUUID()}@example.com`
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
  if (isAdmin) await db.doc(`users/${account.localId}`).set({ isAdmin: true })
  const signIn = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
    },
  )
  return { uid: account.localId, token: (await signIn.json()).idToken }
}
async function call(person, data) {
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/operate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(person ? { Authorization: `Bearer ${person.token}` } : {}),
    },
    body: JSON.stringify({ data: { requestId: crypto.randomUUID(), ...data } }),
  })
  const result = await response.json()
  if (result.error)
    throw Object.assign(new Error(result.error.message), { code: result.error.status })
  return result.result
}
const snapshot = async (id) => (await db.doc(`activities/${id}`).get()).data()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(predicate) {
  for (let i = 0; i < 40; i++) {
    if (await predicate()) return
    await wait(250)
  }
  throw new Error('El vencimiento del servidor no avanzó en 10 segundos.')
}
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
  const first = await person('Ana')
  const second = await person('Luis')
  const people = [first, second]
  let id
  let clock
  try {
    await t.test('authentication and document-based admin role', async () => {
      await assert.rejects(call(null, { action: 'create', config }), { code: 'UNAUTHENTICATED' })
      await assert.rejects(call(first, { action: 'create', config }), { code: 'PERMISSION_DENIED' })
      id = (await call(owner, { action: 'create', config })).activityId
      await assert.rejects(
        call(otherAdmin, { action: 'registration', activityId: id, open: false }),
        { code: 'PERMISSION_DENIED' },
      )
      await assert.rejects(call(owner, { action: 'decorateStart', activityId: id }))
      await assert.rejects(call(owner, { action: 'playStart', activityId: id }))
    })
    await t.test('automatic profiles, repeat login and legacy profile migration', async () => {
      const client = rules.authenticatedContext(first.uid).firestore()
      const user = { uid: first.uid, displayName: 'Ana', email: null }
      await Promise.all([ensureUserProfile(client, user), ensureUserProfile(client, user)])
      assert.deepEqual((await db.doc(`users/${first.uid}`).get()).data(), {
        displayName: 'Ana',
        email: null,
        isAdmin: false,
      })
      await db.doc(`users/${first.uid}`).update({ isAdmin: true })
      await ensureUserProfile(client, user)
      assert.equal((await db.doc(`users/${first.uid}`).get()).data().isAdmin, true)
      await assertFails(updateDoc(doc(client, `users/${first.uid}`), { isAdmin: false }))
      await db
        .doc(`users/${first.uid}`)
        .set({ displayName: 'Perfil existente', decorationCount: 3 })
      await ensureUserProfile(client, user)
      assert.deepEqual((await db.doc(`users/${first.uid}`).get()).data(), {
        displayName: 'Perfil existente',
        decorationCount: 3,
        isAdmin: false,
      })
      const anonymous = rules.unauthenticatedContext().firestore()
      await assertFails(
        setDoc(doc(anonymous, 'users/forged'), { displayName: 'X', email: null, isAdmin: false }),
      )
      await assertFails(
        setDoc(doc(client, `users/${second.uid}`), {
          displayName: 'X',
          email: null,
          isAdmin: false,
        }),
      )
      await assertFails(
        setDoc(doc(client, `users/${first.uid}`), {
          displayName: 'X',
          email: null,
          isAdmin: false,
          role: 'admin',
        }),
      )
    })
    await t.test('strict role values, rules isolation and live revocation', async () => {
      const client = rules.authenticatedContext(first.uid, { admin: true }).firestore()
      const own = rules.authenticatedContext(owner.uid).firestore()
      const ref = db.doc(`users/${first.uid}`)
      for (const value of [false, 'true', null]) {
        await ref.set({ isAdmin: value })
        await assert.rejects(
          call(first, { action: 'create', config, uid: owner.uid, isAdmin: true, role: 'admin' }),
          { code: 'PERMISSION_DENIED' },
        )
        await assertFails(getDoc(doc(client, `activities/${id}`)))
      }
      await ref.set({})
      await assert.rejects(call(first, { action: 'create', config }), { code: 'PERMISSION_DENIED' })
      await ref.delete()
      await assertSucceeds(getDoc(doc(client, `users/${first.uid}`)))
      await assertFails(
        getDoc(doc(rules.unauthenticatedContext().firestore(), `users/${owner.uid}`)),
      )
      for (const reader of [client, own]) {
        await assertFails(getDocs(collection(reader, 'users')))
        await assertFails(setDoc(doc(reader, `users/${first.uid}`), { isAdmin: true }))
        await assertFails(setDoc(doc(reader, `users/${owner.uid}`), { isAdmin: true }))
        await assertFails(updateDoc(doc(reader, `users/${owner.uid}`), { isAdmin: false }))
        await assertFails(deleteDoc(doc(reader, `users/${owner.uid}`)))
      }
      await assertFails(getDoc(doc(client, `users/${owner.uid}`)))
      const observed = []
      let listenerError
      const stop = onSnapshot(
        doc(own, `users/${owner.uid}`),
        (snap) => observed.push(snap.data()?.isAdmin === true),
        (error) => {
          listenerError = error
        },
      )
      try {
        await until(() => observed.includes(true))
        const request = {
          action: 'registration',
          activityId: id,
          open: true,
          requestId: crypto.randomUUID(),
        }
        await call(owner, request)
        await db.doc(`users/${owner.uid}`).update({ isAdmin: false })
        await until(() => observed.at(-1) === false)
        assert.equal(listenerError, undefined)
        await assertFails(getDoc(doc(own, `activities/${id}`)))
        await assert.rejects(call(owner, request), { code: 'PERMISSION_DENIED' })
        await assert.rejects(call(owner, { action: 'create', config }), {
          code: 'PERMISSION_DENIED',
        })
        await assert.rejects(call(owner, { action: 'cancel', activityId: id }), {
          code: 'PERMISSION_DENIED',
        })
        await db.doc(`users/${owner.uid}`).delete()
        await assert.rejects(call(owner, { action: 'create', config }), {
          code: 'PERMISSION_DENIED',
        })
      } finally {
        stop()
        await db.doc(`users/${owner.uid}`).set({ isAdmin: true })
      }
    })
    await t.test('two unique participants join through code and link', async () => {
      const { code } = await snapshot(id)
      await call(first, { action: 'joinCode', code })
      await Promise.all([
        call(second, { action: 'join', activityId: id }),
        call(second, { action: 'join', activityId: id }),
      ])
      assert.equal((await snapshot(id)).participantCount, 2)
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
        const read = rules.unauthenticatedContext().firestore()
        assert.equal(
          (await getDocs(collection(read, `publicActivities/${id}/decorations`))).size,
          2,
        )
        assert.equal((await getDoc(doc(read, `publicActivities/${id}`))).data().state, 'DECORATING')
      },
    )
    await t.test('server clock expires decoration without browsers', async () => {
      const now = Date.now() - 1000
      await db.doc(`activities/${id}`).update({ decorationEndsAt: now, nextDeadline: now })
      await assert.rejects(
        call(first, { action: 'decorate', activityId: id, kind: 'gift', x: 0.5, y: 0.4 }),
      )
      clock = spawn(process.execPath, ['scripts/emulator-clock.js'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'ignore',
      })
      await until(async () => (await snapshot(id)).state === 'READY')
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
        { code: 'PERMISSION_DENIED' },
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
    await t.test('timeout advances automatically and records skipped turn', async () => {
      const a = await snapshot(id)
      const deadline = Date.now() - 1000
      await db.doc(`activities/${id}`).update({ turnEndsAt: deadline, nextDeadline: deadline })
      await until(async () => (await snapshot(id)).turnNumber > a.turnNumber)
      const turn = (await db.doc(`activities/${id}/turns/${a.turnNumber}`).get()).data()
      assert.equal(turn.status, 'SKIPPED')
      assert.equal(turn.reason, 'TIMEOUT')
    })
    await t.test('admin skip cannot skip a stale or foreign turn', async () => {
      const a = await snapshot(id)
      await assert.rejects(
        call(otherAdmin, { action: 'skip', activityId: id, turnNumber: a.turnNumber }),
        { code: 'PERMISSION_DENIED' },
      )
      await call(owner, { action: 'skip', activityId: id, turnNumber: a.turnNumber })
      await assert.rejects(
        call(owner, { action: 'skip', activityId: id, turnNumber: a.turnNumber }),
      )
    })
    await t.test('concurrent requests produce a single persistent winner', async () => {
      // Pause the local background clock; callable deadlines still apply.
      clock.kill()
      clock = null
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
      const read = rules.unauthenticatedContext().firestore()
      const publicDoc = (await getDoc(doc(read, `publicActivities/${id}`))).data()
      assert.equal(publicDoc.winnerUid, a.winnerUid)
      assert.equal((await db.doc(`publicActivities/${id}`).get()).data().winnerUid, a.winnerUid)
      for (const key of ['email', 'ownerUid', 'code', 'roster', 'queue'])
        assert.equal(key in publicDoc, false)
    })
    await t.test(
      'rules block direct writes, privilege escalation and private data access',
      async () => {
        const client = rules.authenticatedContext(first.uid, { admin: false }).firestore()
        const other = rules.authenticatedContext(otherAdmin.uid, { admin: true }).firestore()
        const own = rules.authenticatedContext(owner.uid, { admin: true }).firestore()
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
        await assertFails(getDoc(doc(client, `joinCodes/${(await snapshot(id)).code}`)))
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
    if (clock) clock.kill()
    await rules.cleanup()
  }
})

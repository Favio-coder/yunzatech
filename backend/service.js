import { createHash, randomBytes } from 'node:crypto'
import { getDb, Timestamp } from './db.ts'
import {
  DECORATIONS,
  GameError,
  hitOutcome,
  inTree,
  nextTurn,
  publicActivity,
  requireThat,
  shuffle,
  validateConfig,
  transition,
} from './domain.js'

const safePhoto = (value) =>
  typeof value === 'string' &&
  /^https:\/\/(lh3\.googleusercontent\.com|.*\.googleusercontent\.com)\//.test(value)
    ? value.slice(0, 2048)
    : null
export const idPattern = /^[a-zA-Z0-9_-]{8,128}$/
// The only administrator authority: the boolean users/{uid}.isAdmin edited in Firebase Console.
const ADMIN_ACTIONS = Object.freeze([
  'create',
  'updateConfig',
  'registration',
  'decorateStart',
  'playStart',
  'cancel',
  'skip',
])
export const isAdminProfile = (profile) => profile.exists && profile.data().isAdmin === true
function save(tx, ref, activity) {
  tx.set(ref, activity)
  tx.set(getDb().doc(`publicActivities/${ref.id}`), publicActivity(activity))
}
function setNext(activity, now) {
  Object.assign(activity, nextTurn(activity, now))
  activity.currentTurnDisplayName = activity.roster[activity.currentTurnUid].displayName
}
function recordSkip(tx, ref, activity, now, reason) {
  tx.create(ref.collection('turns').doc(String(activity.turnNumber)), {
    uid: activity.currentTurnUid,
    displayName: activity.currentTurnDisplayName,
    turnNumber: activity.turnNumber,
    round: activity.round,
    status: 'SKIPPED',
    reason,
    createdAt: now,
  })
  tx.set(getDb().doc(`publicActivities/${ref.id}/turns/${activity.turnNumber}`), {
    displayName: activity.currentTurnDisplayName,
    turnNumber: activity.turnNumber,
    round: activity.round,
    status: 'SKIPPED',
    reason,
    createdAt: now,
  })
  setNext(activity, now)
}
/**
 * Expires one activity using the server clock. With `requester`, the caller must be a
 * participant or the admin owner; authorization and transition share one transaction.
 * Early notices never change anything: the deadline is re-read from Firestore.
 * @param {string} activityId
 * @param {{ uid: string } | null} [requester]
 * @returns {Promise<boolean>} whether a transition happened
 */
export async function expireActivity(activityId, requester = null) {
  requireThat(
    typeof activityId === 'string' && idPattern.test(activityId),
    'Actividad inválida.',
    'invalid-argument',
  )
  const db = getDb()
  const ref = db.doc(`activities/${activityId}`)
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (requester) {
      requireThat(snap.exists, 'La actividad no existe.', 'not-found')
      const [participant, profile] = await Promise.all([
        tx.get(ref.collection('participants').doc(requester.uid)),
        tx.get(db.doc(`users/${requester.uid}`)),
      ])
      requireThat(
        participant.exists || (isAdminProfile(profile) && snap.data().ownerUid === requester.uid),
        'No puedes solicitar el vencimiento de esta actividad.',
        'permission-denied',
      )
    }
    if (!snap.exists) return false
    const activity = snap.data()
    const now = Timestamp.now().toMillis()
    if (!activity.nextDeadline || now < activity.nextDeadline) return false
    if (activity.state === 'DECORATING') {
      transition(activity, 'READY')
      activity.nextDeadline = null
    } else if (activity.state === 'PLAYING') recordSkip(tx, ref, activity, now, 'TIMEOUT')
    else return false
    activity.updatedAt = now
    save(tx, ref, activity)
    return true
  })
}
const PAGE = 200
const PARALLEL = 20
// Recovery used by the cron. Due activities are processed in pages under a fixed budget per run,
// so a burst never becomes an unbounded loop; the next run continues with whatever is still due.
export async function expireDue({ maxPages = 5 } = {}) {
  const db = getDb()
  let processed = 0
  for (let page = 0; page < maxPages; page++) {
    const due = await db
      .collection('activities')
      .where('nextDeadline', '>', 0)
      .where('nextDeadline', '<=', Timestamp.now().toMillis())
      .limit(PAGE)
      .get()
    for (let i = 0; i < due.docs.length; i += PARALLEL) {
      const results = await Promise.allSettled(
        due.docs.slice(i, i + PARALLEL).map((doc) => expireActivity(doc.id)),
      )
      for (const result of results)
        if (result.status === 'rejected') console.error('expireDue', result.reason?.message)
    }
    processed += due.size
    if (due.size < PAGE) break
  }
  return processed
}
/**
 * Runs one idempotent game operation for a verified identity.
 * @param {{ uid: string, token: Record<string, any> }} auth
 * @param {Record<string, any>} input
 * @returns {Promise<Record<string, any>>}
 */
export async function executeOperation(auth, input) {
  requireThat(auth?.uid, 'Inicia sesión para continuar.', 'unauthenticated')
  requireThat(input && typeof input === 'object', 'Solicitud inválida.', 'invalid-argument')
  const { action, requestId } = input
  requireThat(
    typeof requestId === 'string' && idPattern.test(requestId),
    'Falta un identificador válido de solicitud.',
    'invalid-argument',
  )
  const db = getDb()
  const receiptRef = db.doc(`users/${auth.uid}/requests/${requestId}`)
  const creationId = createHash('sha256')
    .update(`${auth.uid}:${requestId}`)
    .digest('hex')
    .slice(0, 24)
  const generatedCode = randomBytes(5).toString('hex').toUpperCase()
  // Bind an idempotency key to its payload. Reusing it for a different action fails.
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const administrative = ADMIN_ACTIONS.includes(action)
  return await db.runTransaction(async (tx) => {
    // The role is read inside the transaction and before any stored receipt, so a revoked
    // administrator cannot replay an earlier administrative request.
    const profile = await tx.get(db.doc(`users/${auth.uid}`))
    const admin = isAdminProfile(profile)
    if (administrative) requireThat(admin, 'Se requiere el rol administrador.', 'permission-denied')
    const receipt = await tx.get(receiptRef)
    if (receipt.exists) {
      requireThat(
        receipt.data().fingerprint === fingerprint,
        'Esta solicitud ya se usó con otros datos.',
        'already-exists',
      )
      return receipt.data().result
    }
    const now = Timestamp.now().toMillis()
    const done = (result) => {
      tx.create(receiptRef, { result, fingerprint, createdAt: now })
      return result
    }
    if (action === 'create') {
      const config = validateConfig(input.config || {})
      const codeRef = db.doc(`joinCodes/${generatedCode}`)
      requireThat(
        !(await tx.get(codeRef)).exists,
        'No se pudo generar el código. Reintenta.',
        'aborted',
      )
      const activity = {
        ...config,
        ownerUid: auth.uid,
        code: generatedCode,
        state: 'LOBBY',
        registrationOpen: true,
        participantCount: 0,
        roster: {},
        health: config.initialHealth,
        hitCount: 0,
        nextDeadline: null,
        createdAt: now,
        updatedAt: now,
      }
      save(tx, db.doc(`activities/${creationId}`), activity)
      tx.create(codeRef, { activityId: creationId })
      return done({ activityId: creationId })
    }
    let activityId = input.activityId
    if (action === 'joinCode') {
      const code = String(input.code || '')
        .trim()
        .toUpperCase()
      requireThat(
        /^[A-F0-9]{10}$/.test(code),
        'El código tiene 10 letras o números.',
        'invalid-argument',
      )
      const codeDoc = await tx.get(db.doc(`joinCodes/${code}`))
      requireThat(codeDoc.exists, 'No encontramos una actividad con ese código.', 'not-found')
      activityId = codeDoc.data().activityId
    }
    requireThat(
      typeof activityId === 'string' && idPattern.test(activityId),
      'Actividad inválida.',
      'invalid-argument',
    )
    const ref = db.doc(`activities/${activityId}`)
    const snapshot = await tx.get(ref)
    requireThat(snapshot.exists, 'La actividad no existe.', 'not-found')
    const a = snapshot.data()
    const participantRef = ref.collection('participants').doc(auth.uid)
    const participant = await tx.get(participantRef)
    if (administrative)
      requireThat(
        admin && a.ownerUid === auth.uid,
        'No puedes gestionar esta actividad.',
        'permission-denied',
      )
    if (action === 'join' || action === 'joinCode') {
      if (participant.exists) return done({ activityId })
      requireThat(
        ['LOBBY', 'DECORATING', 'READY'].includes(a.state) && a.registrationOpen,
        'Las inscripciones están cerradas.',
      )
      requireThat(a.participantCount < 100, 'La actividad alcanzó el límite de 100 participantes.')
      const person = {
        uid: auth.uid,
        displayName: String(auth.token.name || 'Participante').slice(0, 80),
        photoURL: safePhoto(auth.token.picture),
        joinedAt: now,
        decorationCount: 0,
      }
      tx.create(participantRef, person)
      tx.create(db.doc(`publicActivities/${activityId}/participants/${auth.uid}`), {
        uid: person.uid,
        displayName: person.displayName,
        photoURL: person.photoURL,
        joinedAt: now,
      })
      // Never touches an existing role; a brand-new profile starts without privileges.
      tx.set(
        db.doc(`users/${auth.uid}`),
        {
          displayName: person.displayName,
          email: auth.token.email || null,
          updatedAt: now,
          ...(profile.exists ? {} : { isAdmin: false }),
        },
        { merge: true },
      )
      a.roster[auth.uid] = { displayName: person.displayName, photoURL: person.photoURL }
      a.participantCount++
    } else if (action === 'updateConfig') {
      requireThat(a.state === 'LOBBY', 'La configuración solo se edita en el lobby.')
      Object.assign(a, validateConfig(input.config || {}))
      a.health = a.initialHealth
    } else if (action === 'registration') {
      requireThat(
        ['LOBBY', 'DECORATING', 'READY'].includes(a.state),
        'La actividad ya comenzó o terminó.',
      )
      requireThat(
        typeof input.open === 'boolean',
        'Estado de inscripción inválido.',
        'invalid-argument',
      )
      a.registrationOpen = input.open
    } else if (action === 'decorateStart') {
      requireThat(
        a.state === 'LOBBY' && a.participantCount > 0,
        'Necesitas participantes y una actividad en lobby.',
      )
      transition(a, 'DECORATING')
      a.decorationStartedAt = now
      a.decorationEndsAt = now + a.decorationMinutes * 60000
      a.nextDeadline = a.decorationEndsAt
    } else if (action === 'decorate') {
      requireThat(participant.exists, 'Únete a la actividad primero.', 'permission-denied')
      requireThat(
        a.state === 'DECORATING' && now < a.decorationEndsAt,
        'La fase de decoración ha terminado.',
      )
      requireThat(
        DECORATIONS.includes(input.kind) && inTree(input.x, input.y),
        'Selecciona un adorno y una posición dentro de la copa.',
        'invalid-argument',
      )
      requireThat(
        participant.data().decorationCount < a.decorationLimit,
        'Alcanzaste tu límite de adornos.',
      )
      const decoration = { uid: auth.uid, kind: input.kind, x: input.x, y: input.y, createdAt: now }
      tx.create(
        db.doc(`publicActivities/${activityId}/decorations/${auth.uid}_${requestId}`),
        decoration,
      )
      tx.update(participantRef, { decorationCount: participant.data().decorationCount + 1 })
    } else if (action === 'playStart') {
      requireThat(
        a.state === 'READY' && a.participantCount > 0,
        'La decoración debe terminar antes de iniciar la yunza.',
      )
      transition(a, 'PLAYING')
      a.registrationOpen = false
      a.eligibleUids = Object.keys(a.roster)
      a.queue = shuffle(a.eligibleUids)
      a.round = 1
      a.turnNumber = 1
      a.currentTurnUid = a.queue[0]
      a.currentTurnDisplayName = a.roster[a.queue[0]].displayName
      a.turnStartedAt = now
      a.turnEndsAt = now + a.turnSeconds * 1000
      a.nextDeadline = a.turnEndsAt
    } else if (action === 'hit') {
      requireThat(participant.exists, 'No participas en esta actividad.', 'permission-denied')
      const outcome = hitOutcome(a, auth.uid, input.turnNumber, now)
      const hitId = String(a.turnNumber)
      const hit = {
        uid: auth.uid,
        displayName: a.currentTurnDisplayName,
        turnNumber: a.turnNumber,
        round: a.round,
        damage: outcome.damage,
        remainingHealth: outcome.health,
        createdAt: now,
      }
      tx.create(ref.collection('hits').doc(hitId), hit)
      tx.create(db.doc(`publicActivities/${activityId}/hits/${hitId}`), hit)
      tx.create(ref.collection('turns').doc(hitId), { ...hit, status: 'HIT' })
      tx.create(db.doc(`publicActivities/${activityId}/turns/${hitId}`), { ...hit, status: 'HIT' })
      a.health = outcome.health
      a.hitCount++
      if (outcome.finished) {
        transition(a, 'FINISHED')
        a.winnerUid = auth.uid
        a.winnerDisplayName = a.currentTurnDisplayName
        a.winnerPhotoURL = a.roster[auth.uid].photoURL
        a.winningHitId = hitId
        a.finishedAt = now
        a.currentTurnUid = null
        a.currentTurnDisplayName = null
        a.nextDeadline = null
      } else setNext(a, now)
    } else if (action === 'skip') {
      requireThat(
        a.state === 'PLAYING' && input.turnNumber === a.turnNumber,
        'El turno ya no está vigente.',
      )
      recordSkip(tx, ref, a, now, 'ADMIN')
    } else if (action === 'cancel') {
      requireThat(!['FINISHED', 'CANCELLED'].includes(a.state), 'Esta actividad ya terminó.')
      transition(a, 'CANCELLED')
      a.registrationOpen = false
      a.nextDeadline = null
      a.currentTurnUid = null
    } else throw new GameError('invalid-argument', 'Operación desconocida.')
    a.updatedAt = now
    save(tx, ref, a)
    return done({ activityId })
  })
}

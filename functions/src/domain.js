import { randomInt } from 'node:crypto'

export class GameError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
export function requireThat(condition, message, code = 'failed-precondition') {
  if (!condition) throw new GameError(code, message)
}
export const STATES = Object.freeze([
  'LOBBY',
  'DECORATING',
  'READY',
  'PLAYING',
  'FINISHED',
  'CANCELLED',
])
export const DECORATIONS = Object.freeze(['gift', 'ribbon', 'balloon', 'money'])
export function validateConfig(input) {
  const name = String(input.name || '').trim()
  const description = String(input.description || '').trim()
  requireThat(
    name.length >= 3 && name.length <= 80,
    'El nombre debe tener entre 3 y 80 caracteres.',
    'invalid-argument',
  )
  requireThat(
    description.length <= 500,
    'La descripción admite hasta 500 caracteres.',
    'invalid-argument',
  )
  const bounds = {
    decorationMinutes: [1, 60],
    initialHealth: [1, 100000],
    minDamage: [1, 10000],
    maxDamage: [1, 10000],
    turnSeconds: [5, 300],
    decorationLimit: [1, 30],
  }
  const config = { name, description }
  for (const [key, [min, max]] of Object.entries(bounds)) {
    requireThat(
      Number.isInteger(input[key]) && input[key] >= min && input[key] <= max,
      `${key}: ingresa un entero entre ${min} y ${max}.`,
      'invalid-argument',
    )
    config[key] = input[key]
  }
  requireThat(
    config.minDamage <= config.maxDamage,
    'El daño mínimo no puede superar al máximo.',
    'invalid-argument',
  )
  return config
}
export function inTree(x, y) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    ((x - 0.5) / 0.37) ** 2 + ((y - 0.37) / 0.32) ** 2 <= 1
  )
}
export function shuffle(ids, previousUid, int = randomInt) {
  const result = [...ids]
  for (let i = result.length - 1; i > 0; i--) {
    const j = int(0, i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  if (result.length > 1 && result[0] === previousUid) {
    const j = int(1, result.length)
    ;[result[0], result[j]] = [result[j], result[0]]
  }
  return result
}
export function nextTurn(activity, now, int = randomInt) {
  let queue = activity.queue.slice(1)
  let round = activity.round
  if (!queue.length) {
    queue = shuffle(activity.eligibleUids, activity.currentTurnUid, int)
    round++
  }
  return {
    queue,
    round,
    turnNumber: activity.turnNumber + 1,
    currentTurnUid: queue[0],
    turnStartedAt: now,
    turnEndsAt: now + activity.turnSeconds * 1000,
    nextDeadline: now + activity.turnSeconds * 1000,
  }
}
export function hitOutcome(activity, uid, turnNumber, now, int = randomInt) {
  requireThat(activity.state === 'PLAYING', 'La yunza no está en juego.')
  requireThat(activity.currentTurnUid === uid, 'No es tu turno.', 'permission-denied')
  requireThat(activity.turnNumber === turnNumber, 'Este turno ya terminó.')
  requireThat(now < activity.turnEndsAt, 'Tu turno ha vencido.')
  const damage = int(activity.minDamage, activity.maxDamage + 1)
  const health = Math.max(0, activity.health - damage)
  return { damage, health, finished: health === 0 }
}
export function publicActivity(a) {
  const fields = [
    'name',
    'description',
    'state',
    'registrationOpen',
    'participantCount',
    'decorationMinutes',
    'decorationLimit',
    'initialHealth',
    'health',
    'decorationStartedAt',
    'decorationEndsAt',
    'turnStartedAt',
    'turnEndsAt',
    'turnNumber',
    'round',
    'currentTurnUid',
    'currentTurnDisplayName',
    'winnerUid',
    'winnerDisplayName',
    'winnerPhotoURL',
    'winningHitId',
    'finishedAt',
    'hitCount',
    'createdAt',
    'updatedAt',
  ]
  return Object.fromEntries(
    fields.filter((key) => a[key] !== undefined).map((key) => [key, a[key]]),
  )
}

export const TRANSITIONS = Object.freeze({
  LOBBY: ['DECORATING', 'CANCELLED'],
  DECORATING: ['READY', 'CANCELLED'],
  READY: ['PLAYING', 'CANCELLED'],
  PLAYING: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
})
export function transition(activity, nextState) {
  requireThat(TRANSITIONS[activity.state]?.includes(nextState), 'Transición de actividad inválida.')
  activity.state = nextState
}

import assert from 'node:assert/strict'
import { hitOutcome, inTree, nextTurn, publicActivity, shuffle, validateConfig } from '../domain.js'
const test = (name, fn) => Deno.test(name, fn)
const config = {
  name: 'Mi yunza',
  description: '',
  decorationMinutes: 8,
  initialHealth: 500,
  minDamage: 10,
  maxDamage: 35,
  turnSeconds: 30,
  decorationLimit: 10,
}
test('configuration validates bounds, integers, text and damage interval', () => {
  assert.deepEqual(validateConfig(config), config)
  for (const changed of [
    { name: '' },
    { minDamage: 36 },
    { decorationMinutes: 0 },
    { turnSeconds: 2 },
    { decorationLimit: 31 },
    { initialHealth: 1.5 },
    { description: 'x'.repeat(501) },
  ])
    assert.throws(() => validateConfig({ ...config, ...changed }))
})
test('normalized placement rejects points outside crown and invalid coordinates', () => {
  assert.equal(inTree(0.5, 0.37), true)
  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [0.5, 0.9],
    [NaN, 0.4],
    [Infinity, 0.3],
    ['.5', 0.4],
  ])
    assert.equal(inTree(x, y), false)
})
test('every shuffle contains each participant exactly once', () => {
  for (let i = 0; i < 100; i++) {
    const order = shuffle(['a', 'b', 'c', 'd'], 'a')
    assert.deepEqual([...order].sort(), ['a', 'b', 'c', 'd'])
    assert.notEqual(order[0], 'a')
  }
})
test('rounds do not repeat the last participant at their boundary', () => {
  const next = nextTurn(
    {
      queue: ['b'],
      eligibleUids: ['a', 'b'],
      currentTurnUid: 'b',
      round: 1,
      turnNumber: 2,
      turnSeconds: 30,
    },
    1000,
  )
  assert.equal(next.currentTurnUid, 'a')
  assert.equal(next.round, 2)
  assert.equal(next.turnEndsAt, 31000)
})
test('one participant can have consecutive rounds', () => {
  const next = nextTurn(
    {
      queue: ['a'],
      eligibleUids: ['a'],
      currentTurnUid: 'a',
      round: 1,
      turnNumber: 1,
      turnSeconds: 5,
    },
    0,
  )
  assert.equal(next.currentTurnUid, 'a')
  assert.equal(next.round, 2)
})
const playing = {
  ...config,
  state: 'PLAYING',
  health: 15,
  currentTurnUid: 'a',
  turnNumber: 1,
  turnEndsAt: 1000,
}
test('server validates identity, exact turn, deadline and phase', () => {
  assert.throws(() => hitOutcome(playing, 'b', 1, 500))
  assert.throws(() => hitOutcome(playing, 'a', 2, 500))
  assert.throws(() => hitOutcome(playing, 'a', 1, 1000))
  assert.throws(() => hitOutcome({ ...playing, state: 'FINISHED' }, 'a', 1, 500))
})
test('winning hit clamps health to zero with inclusive damage bounds', () => {
  let bounds
  const result = hitOutcome(playing, 'a', 1, 500, (min, max) => {
    bounds = [min, max]
    return max - 1
  })
  assert.deepEqual(bounds, [10, 36])
  assert.deepEqual(result, { damage: 35, health: 0, finished: true })
})
test('public projection never leaks access codes, private rosters or ownership', () => {
  const publicDoc = publicActivity({
    ...playing,
    code: 'SECRET',
    ownerUid: 'owner',
    email: 'private@example.com',
    roster: {},
    queue: ['a'],
    eligibleUids: ['a'],
  })
  for (const key of ['code', 'ownerUid', 'email', 'roster', 'queue', 'eligibleUids'])
    assert.equal(key in publicDoc, false)
  assert.equal(publicDoc.health, 15)
})

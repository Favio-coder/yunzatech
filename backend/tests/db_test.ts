import assert from 'node:assert/strict'
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore'
import { Timestamp } from '../db.ts'

// Both packages must resolve to one copy, otherwise Timestamp values would not round-trip.
Deno.test('Firestore Timestamp class is shared with firebase-admin', () => {
  assert.equal(Timestamp, AdminTimestamp)
})

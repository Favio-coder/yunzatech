import { initializeApp } from 'firebase-admin/app'
import { getFunctions } from 'firebase-admin/functions'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onTaskDispatched } from 'firebase-functions/v2/tasks'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { executeOperation, expireActivity, expireDue } from './service.js'
import { GameError } from './domain.js'

initializeApp()
setGlobalOptions({ region: 'us-central1', maxInstances: 10 })
export const operate = onCall(async (request) => {
  try {
    return await executeOperation(request.auth, request.data)
  } catch (error) {
    if (error instanceof GameError) throw new HttpsError(error.code, error.message)
    console.error('Operation failed', error)
    throw new HttpsError(
      'internal',
      'No se pudo completar la operación. Reintenta con la misma solicitud.',
    )
  }
})
// Durable Firestore event retries enqueueing if Cloud Tasks is temporarily unavailable.
export const scheduleDeadline = onDocumentWritten(
  { document: 'activities/{activityId}', retry: true },
  async (event) => {
    const after = event.data?.after.data()
    const before = event.data?.before.data()
    if (
      !after?.nextDeadline ||
      after.nextDeadline === before?.nextDeadline ||
      process.env.FUNCTIONS_EMULATOR === 'true'
    )
      return
    await getFunctions()
      .taskQueue('locations/us-central1/functions/deadline')
      .enqueue(
        { activityId: event.params.activityId },
        { scheduleTime: new Date(after.nextDeadline), dispatchDeadlineSeconds: 60 },
      )
  },
)
export const deadline = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 10, minBackoffSeconds: 1 },
    rateLimits: { maxConcurrentDispatches: 20 },
  },
  async (request) => {
    await expireActivity(request.data.activityId)
  },
)
// Recovery for missed tasks; transactions make overlapping invocations safe.
export const recoverDeadlines = onSchedule('every 1 minutes', expireDue)

export const clock = onCall(() => ({ now: Date.now() }))

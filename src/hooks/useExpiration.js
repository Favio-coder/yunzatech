import { useEffect, useState } from 'react'
import { requestExpiration } from '../services/firebase'

const MAX_ATTEMPTS = 5
const delay = (count) => (count === 0 ? 0 : Math.min(16000, 1000 * 2 ** count))

// When a connected browser sees a deadline pass, it asks the server to check it. The server
// decides with its own clock and the current Firestore state, so early or repeated notices are
// harmless; this only shortens the wait until the minute cron would recover the activity.
export function useExpiration({ activityId, activity, now, synced, enabled }) {
  const deadline =
    activity?.state === 'DECORATING'
      ? activity.decorationEndsAt
      : activity?.state === 'PLAYING'
        ? activity.turnEndsAt
        : null
  const key = deadline
    ? `${activityId}:${activity.state}:${activity.turnNumber || 0}:${deadline}`
    : ''
  const due = Boolean(key && enabled && synced && now >= deadline)
  const [attempt, setAttempt] = useState({ key: '', count: 0 })
  useEffect(() => {
    if (!due) return
    const count = attempt.key === key ? attempt.count : 0
    if (count >= MAX_ATTEMPTS) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        await requestExpiration(activityId)
      } catch {
        /* the server cron recovers the deadline if notices fail */
      }
      if (!cancelled) setAttempt({ key, count: count + 1 })
    }, delay(count))
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [due, key, activityId, attempt])
}

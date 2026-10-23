import { useEffect, useState } from 'react'
import { serverClock } from '../services/firebase'
export function useServerTime() {
  const [clock, setClock] = useState(() => ({ now: Date.now(), offset: 0, synced: false }))
  useEffect(() => {
    let active = true
    const sync = async () => {
      try {
        const offset = await serverClock()
        if (active) setClock({ now: Date.now() + offset, offset, synced: true })
      } catch {
        if (active) setClock((previous) => ({ ...previous, synced: false }))
      }
    }
    sync()
    const timer = setInterval(
      () => setClock((previous) => ({ ...previous, now: Date.now() + previous.offset })),
      250,
    )
    const refresh = setInterval(sync, 60000)
    return () => {
      active = false
      clearInterval(timer)
      clearInterval(refresh)
    }
  }, [])
  return clock
}

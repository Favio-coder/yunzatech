import { useRef, useState } from 'react'
import { operate } from '../services/firebase'
import { useAuth } from './useAuth'

export function useOperation() {
  const { user } = useAuth()
  const uid = user?.uid
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const retry = useRef(null)
  const owner = useRef(uid)
  const run = async (payload) => {
    if (locked.current) return null
    // A request id remembered for another account is never reused.
    if (owner.current !== uid) {
      owner.current = uid
      retry.current = null
    }
    locked.current = true
    setPending(true)
    setError('')
    const signature = JSON.stringify(payload)
    const requestId =
      retry.current?.signature === signature ? retry.current.requestId : crypto.randomUUID()
    retry.current = { signature, requestId }
    try {
      const result = await operate({ ...payload, requestId })
      retry.current = null
      return result
    } catch (error) {
      setError(error.message || 'No se pudo completar la operación.')
      return null
    } finally {
      locked.current = false
      setPending(false)
    }
  }
  return { run, pending, error, clearError: () => setError('') }
}

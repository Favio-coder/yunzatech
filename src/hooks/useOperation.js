import { useRef, useState } from 'react'
import { operate } from '../services/firebase'

export function useOperation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const retry = useRef(null)
  const run = async (payload) => {
    if (locked.current) return null
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

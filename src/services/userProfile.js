import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

// Creates users/{uid} on first login with isAdmin: false. Existing roles are never touched:
// a profile that predates the role only gets the missing field initialised to false.
// Security rules allow exactly these two writes; the backend reads the same document.
export async function ensureUserProfile(user) {
  if (!db) return
  const ref = doc(db, 'users', user.uid)
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref)
    if (!snapshot.exists())
      tx.set(ref, {
        displayName: String(user.displayName || 'Participante').slice(0, 80),
        email: user.email || null,
        isAdmin: false,
        createdAt: serverTimestamp(),
      })
    else if (!('isAdmin' in snapshot.data())) tx.update(ref, { isAdmin: false })
  })
}

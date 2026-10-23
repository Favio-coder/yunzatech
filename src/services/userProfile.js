import { doc, runTransaction } from 'firebase/firestore'

// Create once: subsequent logins must never overwrite a console-managed role.
export async function ensureUserProfile(db, user) {
  const ref = doc(db, 'users', user.uid)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists()) {
      transaction.set(ref, {
        displayName: user.displayName || 'Participante',
        email: user.email || null,
        isAdmin: false,
      })
    } else if (!Object.hasOwn(snapshot.data(), 'isAdmin')) {
      transaction.update(ref, { isAdmin: false })
    }
  })
  return ref
}

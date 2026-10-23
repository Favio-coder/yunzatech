import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
const uid = process.argv[2]
if (!uid) throw new Error('Uso: npm --prefix functions run grant-admin -- UID')
initializeApp({ projectId: process.env.GCLOUD_PROJECT })
const auth = getAuth()
const user = await auth.getUser(uid)
await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true })
console.log('Administrador asignado. Cierra sesión y vuelve a entrar para renovar el token.')

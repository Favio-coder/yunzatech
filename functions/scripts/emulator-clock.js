import { initializeApp } from 'firebase-admin/app'
import { expireDue } from '../src/service.js'
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Este reloj solo funciona con los emuladores.')
initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-yunza-tech' })
console.log('Reloj de emulador activo (cada segundo). Ctrl+C para detener.')
while (true) {
  try {
    await expireDue()
  } catch (error) {
    console.error(error.message)
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

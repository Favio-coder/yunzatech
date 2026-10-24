import { expireDue } from './service.js'

// Deploy discovers cron declarations before timeline configuration is attached.
// Keep registration unconditional, but never access data in an unconfigured context.
Deno.cron('recover-deadlines', '* * * * *', { backoffSchedule: [5000, 20000] }, async () => {
  if (!Deno.env.get('FIREBASE_PROJECT_ID')) return
  const processed = await expireDue()
  if (processed) console.log(`cron recover-deadlines: ${processed} actividades revisadas`)
})

import './crons.ts'
import { previewResponse, unconfiguredPreview } from './preview.ts'

if (import.meta.main) {
  if (unconfiguredPreview(Deno.env.get)) Deno.serve(previewResponse)
  else {
    const { startServer } = await import('./main.ts')
    startServer()
  }
}

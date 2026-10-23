import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore/ },
              { name: 'firebase-auth', test: /node_modules[\\/]@firebase[\\/]auth/ },
              { name: 'vendor', test: /node_modules/ },
            ],
          },
        },
      },
    },
  }
})

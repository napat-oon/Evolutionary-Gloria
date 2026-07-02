import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend runs on 8080 in development; nginx does this in production.
      '/api': 'http://localhost:8080',
    },
  },
})

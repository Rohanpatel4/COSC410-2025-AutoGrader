import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: 'http://backend:8000', // FastAPI backend service in Docker network
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p,  // <= keep "/api" intact
      },
    },
  },
  define: {
    // Make sure Vite can see this environment variable
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test_setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
    },
  },
})

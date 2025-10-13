import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: 'http://backend:8000', // FastAPI backend
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./test_setup.ts",
    globals: true,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",

      // Only measure core app code
      include: [
        "src/webpages/**/*.{ts,tsx}",
        "src/api/**/*.{ts,tsx}",
        "src/auth/**/*.{ts,tsx}",
      ],

      // Don’t count these toward coverage
      exclude: [
        "src/test/**",                 // MSW handlers, helpers, etc.
        "src/types/**",                // type-only modules
        "src/main.tsx",                // app bootstrap
      ],
    },
  },
})

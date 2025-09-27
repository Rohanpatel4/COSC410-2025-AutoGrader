import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./test_setup.ts",
    globals: true,
    css: true,
    coverage: { provider: "v8", reporter: ["text","html","lcov"], reportsDirectory: "coverage" }
  }
})

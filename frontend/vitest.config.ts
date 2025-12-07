import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test_setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'json', 'html'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        '**/*.config.*',
      ],
      include: ['src/**/*.{ts,tsx}'],
      all: true,
    },
  },
})

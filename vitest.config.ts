import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The repo has no test files until the money helper / fee calculator
    // tasks land; don't fail the runner in the meantime.
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})

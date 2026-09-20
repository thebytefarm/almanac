import { defineConfig } from 'vitest/config'

/**
 * Separates fast colocated unit tests from serialized repository integration tests.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          include: ['src/**/*.test.ts'],
          name: 'unit',
        },
      },
      {
        test: {
          fileParallelism: false,
          include: ['tests/**/*.test.ts'],
          name: 'integration',
        },
      },
    ],
  },
})

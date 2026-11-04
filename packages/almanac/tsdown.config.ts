import { defineConfig } from 'tsdown'

/**
 * Production CLI, command entry points, and typed SDK bundle.
 */
export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: ['maltty'],
    neverBundle: [/^react(?:\/|$)/, 'ink', 'giget', 'jiti', 'chokidar'],
    onlyBundle: false,
  },
  dts: true,
  entry: ['src/index.ts', 'src/sdk.ts', 'src/commands/**/!(*.test).ts'],
  format: ['esm'],
})

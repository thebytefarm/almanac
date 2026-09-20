import { defineConfig } from 'tsdown'

/**
 * Production CLI bundle and maltty command entry points.
 */
export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: ['maltty'],
    neverBundle: [/^react(?:\/|$)/, 'ink', 'giget', 'jiti', 'chokidar'],
    onlyBundle: false,
  },
  dts: false,
  entry: ['src/index.ts', 'src/commands/**/!(*.test).ts'],
  format: ['esm'],
})

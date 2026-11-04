import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import manifest from '../package.json' with { type: 'json' }

const exec = promisify(execFile)
const executable = join(import.meta.dirname, '../dist/index.mjs')

describe('published executable', () => {
  it('reports the package version', async () => {
    const result = await exec(process.execPath, [executable, '--version'])

    expect(result.stderr).toBe('')
    expect(result.stdout.trim()).toBe(manifest.version)
  })

  it('renders CLI help', async () => {
    const result = await exec(process.execPath, [executable, '--help'])

    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Keep repository documentation indexed in AGENTS.md')
    expect(result.stdout).toContain('index')
    expect(result.stdout).toContain('link')
    expect(result.stdout).toContain('sync')
  })
})

describe('published SDK declarations', () => {
  it('typechecks an external consumer without skipping dependency checks', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'almanac-consumer-'))
    try {
      const modules = join(directory, 'node_modules')
      await mkdir(modules)
      await symlink(join(import.meta.dirname, '..'), join(modules, 'almanac-md'))
      await symlink(
        join(import.meta.dirname, '../../../node_modules/@types'),
        join(modules, '@types'),
      )
      await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}\n')
      await writeFile(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            module: 'NodeNext',
            noEmit: true,
            skipLibCheck: false,
            strict: true,
            target: 'ESNext',
            types: ['node'],
          },
          include: ['consumer.ts'],
        }),
      )
      await writeFile(
        join(directory, 'consumer.ts'),
        `import { createAlmanac } from 'almanac-md/sdk'
import type { Almanac, AlmanacConfigInput, TargetChange, DiffResult } from 'almanac-md/sdk'

const config = {
  include: ['docs/**/*.md'],
  links: [],
  targets: [{ path: 'AGENTS.md', tags: { start: '<docs>', end: '</docs>' } }],
} as const satisfies AlmanacConfigInput
const almanac: Almanac = createAlmanac({ cwd: '/repo', config })
const changes: readonly TargetChange[] = await almanac.sync()
const staged: readonly TargetChange[] = await almanac.index({ stage: true })
const initialized: void = await almanac.initialize()
const diff: DiffResult = await almanac.diff('HEAD~1', 'HEAD')
// @ts-expect-error SDK creation requires explicit config.
createAlmanac({ cwd: '/repo' })
// @ts-expect-error Staging only accepts a boolean.
await almanac.sync({ stage: 'yes' })
`,
      )

      const result = await exec(
        'pnpm',
        ['exec', 'tsgo', '--project', join(directory, 'tsconfig.json')],
        {
          cwd: join(import.meta.dirname, '../../..'),
        },
      )

      expect(result.stdout).toBe('')
      expect(result.stderr).toBe('')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

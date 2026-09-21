import { execFile } from 'node:child_process'
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

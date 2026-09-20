import { lstat, readlink } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('link command', () => {
  it('links Git-visible agent files recursively without indexing them', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Root instructions without managed markers\n',
      'packages/api/AGENTS.md': '# API instructions\n',
    })
    await fixture.commit('initial instructions')

    const result = await invoke('link')

    expect(result.error).toBeUndefined()
    expect(await readlink(join(fixture.path, 'CLAUDE.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'GEMINI.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'packages/api/CLAUDE.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'packages/api/GEMINI.md'))).toBe('AGENTS.md')
    expect(await fixture.read('AGENTS.md')).toBe('# Root instructions without managed markers\n')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe(
      'CLAUDE.md\nGEMINI.md\npackages/api/CLAUDE.md\npackages/api/GEMINI.md',
    )
  })

  it('preserves custom Gemini instructions without creating partial links', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Shared instructions\n',
      'GEMINI.md': '# Gemini-specific instructions\n',
    })

    const result = await invoke('link')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('GEMINI.md')).toBe('# Gemini-specific instructions\n')
    await expect(lstat(join(fixture.path, 'CLAUDE.md'))).rejects.toThrow()
  })
})

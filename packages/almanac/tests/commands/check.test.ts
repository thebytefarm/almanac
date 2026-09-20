import { lstat, symlink } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('check command', () => {
  it('reports drift without writing the target', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
      'docs/guide.md': '# Guide\n\nInitial guidance.\n',
    })
    await invoke('sync')
    await fixture.commit('sync index')
    await fixture.write('docs/guide.md', '# Guide\n\nUpdated guidance.\n')
    const before = await fixture.read('AGENTS.md')

    const result = await invoke('check', '--format', 'json')

    expect(result.exitCode).toBe(1)
    expect(await fixture.read('AGENTS.md')).toBe(before)
  })

  it('reports missing compatibility aliases without creating them', async () => {
    const fixture = await setup({
      'AGENTS.md': '<docs-index>\n</docs-index>\n',
    })

    const result = await invoke('check', '--format', 'json')

    expect(result.exitCode).toBe(1)
    await expect(lstat(join(fixture.path, 'CLAUDE.md'))).rejects.toThrow()
    await expect(lstat(join(fixture.path, 'GEMINI.md'))).rejects.toThrow()
  })

  it('rejects executable configuration files', async () => {
    await setup({ 'almanac.config.ts': 'export default {}\n' })

    const result = await invoke('check')

    expect(result.exitCode).toBe(2)
  })

  it('rejects executable configuration symlinks', async () => {
    const fixture = await setup({ 'config.ts': 'export default {}\n' })
    await symlink('config.ts', join(fixture.path, 'almanac.config.ts'))

    const result = await invoke('check')

    expect(result.exitCode).toBe(2)
  })
})

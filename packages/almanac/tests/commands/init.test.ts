import { access, lstat, readlink, stat, symlink } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('init command', () => {
  it('initializes zero-config defaults, creates aliases, and preserves an existing hook', async () => {
    const fixture = await setup({
      'docs/start.md': '# Start Here\n\nRead this first.\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    })
    await fixture.write('.git/hooks/pre-commit', '#!/bin/sh\necho existing\n')

    const result = await invoke('init', '--hooks')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).toContain('docs/start.md: Read this first.')
    expect(await readlink(join(fixture.path, 'CLAUDE.md'))).toBe('AGENTS.md')
    expect(await readlink(join(fixture.path, 'GEMINI.md'))).toBe('AGENTS.md')
    expect(await fixture.read('.git/hooks/pre-commit')).toBe(`#!/bin/sh
# almanac:start
pnpm exec almanac sync || exit $?
# almanac:end
echo existing
`)
    const hookStat = await stat(join(fixture.path, '.git/hooks/pre-commit'))
    expect(hookStat.mode & 0o100).toBe(0o100)
  })

  it('leaves Git hooks untouched when explicitly skipped', async () => {
    const fixture = await setup({
      'docs/start.md': '# Start Here\n\nRead this first.\n',
    })

    const result = await invoke('init', '--no-hooks')

    expect(result.error).toBeUndefined()
    expect(await fixture.read('AGENTS.md')).toContain('docs/start.md: Read this first.')
    await expect(access(join(fixture.path, '.git/hooks/pre-commit'))).rejects.toThrow()
  })

  it('initializes and stages an existing tracked target without markers', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Existing rules\n',
      'docs/start.md': '# Start Here\n\nRead this first.\n',
    })
    await fixture.commit('existing instructions')

    const result = await invoke('init', '--no-hooks')

    expect(result.error).toBeUndefined()
    expect(await fixture.git('show', ':AGENTS.md')).toContain('docs/start.md: Read this first.')
    expect(await fixture.git('show', ':AGENTS.md')).toContain('# Existing rules')
  })

  it('rejects target symlinks without replacing them', async () => {
    const fixture = await setup({
      'docs/start.md': '# Start Here\n\nRead this first.\n',
      'real-agents.md': '# Existing rules\n',
    })
    await symlink('real-agents.md', join(fixture.path, 'AGENTS.md'))

    const result = await invoke('init', '--no-hooks')

    expect(result.exitCode).toBe(2)
    expect((await lstat(join(fixture.path, 'AGENTS.md'))).isSymbolicLink()).toBeTruthy()
    expect(await fixture.read('real-agents.md')).toBe('# Existing rules\n')
  })

  it('does not initialize valid targets when another target is malformed', async () => {
    const fixture = await setup({
      'AGENTS.md': '# Existing rules\n',
      'BROKEN.md': '<docs-index>\n',
      'almanac.json': JSON.stringify({ targets: ['AGENTS.md', 'BROKEN.md'] }),
    })

    const result = await invoke('init', '--no-hooks')

    expect(result.exitCode).toBe(2)
    expect(await fixture.read('AGENTS.md')).toBe('# Existing rules\n')
  })
})

import { lstat } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { invoke, setup } from '../cli.js'

describe('index command', () => {
  it('uses CLI-only include, exclude, and target overrides without linking', async () => {
    const fixture = await setup({
      'CUSTOM.md': '<docs-index>\n</docs-index>\n',
      'knowledge/private.md': '# Private\n\nDo not index this.\n',
      'knowledge/public.md': '# Public\n\nIndex this document.\n',
    })

    const result = await invoke(
      'index',
      '--target',
      'CUSTOM.md',
      '--include',
      'knowledge/**/*.md',
      '--exclude',
      'knowledge/private.md',
    )

    expect(result.error).toBeUndefined()
    expect(await fixture.read('CUSTOM.md')).toContain('knowledge/public.md: Index this document.')
    expect(await fixture.read('CUSTOM.md')).not.toContain('knowledge/private.md')
    expect(await fixture.git('diff', '--cached', '--name-only')).toBe('CUSTOM.md')
    await expect(lstat(join(fixture.path, 'CLAUDE.md'))).rejects.toThrow()
    await expect(lstat(join(fixture.path, 'GEMINI.md'))).rejects.toThrow()
  })
})

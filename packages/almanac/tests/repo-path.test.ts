import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createRepoPathResolver } from '#lib/repo-path.js'

describe('repository paths', () => {
  it('rejects a parent symlink that escapes the repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'almanac-root-'))
    const outside = await mkdtemp(join(tmpdir(), 'almanac-outside-'))
    await mkdir(join(root, 'targets'))
    await symlink(outside, join(root, 'targets', 'escape'))

    const result = await createRepoPathResolver(root).resolve('targets/escape/AGENTS.md')
    expect(result.ok).toBeFalsy()
    expect(result.error?.message).toContain('path resolves outside the repository')
    await Promise.all([
      rm(root, { force: true, recursive: true }),
      rm(outside, { force: true, recursive: true }),
    ])
  })
})

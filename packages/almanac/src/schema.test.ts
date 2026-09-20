import { describe, expect, it } from 'vitest'

import { almanacConfigSchema } from './schema.js'

describe('almanacConfigSchema', () => {
  it('rejects Git internals and dot segments', () => {
    expect(almanacConfigSchema.safeParse({ targets: ['.git/config'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: ['./AGENTS.md'] }).success).toBeFalsy()
  })

  it('rejects target aliases on case-insensitive filesystems', () => {
    expect(
      almanacConfigSchema.safeParse({ targets: ['AGENTS.md', 'agents.md'] }).success,
    ).toBeFalsy()
  })

  it('rejects target paths with glob, pathspec, and non-normalized syntax', () => {
    expect(almanacConfigSchema.safeParse({ targets: ['*.md'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: [':(glob)*.md'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: ['docs//AGENTS.md'] }).success).toBeFalsy()
  })
})

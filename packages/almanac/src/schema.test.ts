import { describe, expect, it } from 'vitest'

import { almanacConfigSchema } from './schema.js'

describe('almanacConfigSchema', () => {
  it('rejects Git internals and dot segments', () => {
    expect(almanacConfigSchema.safeParse({ targets: ['.git/config'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: ['./AGENTS.md'] }).success).toBeFalsy()
  })

  it('rejects target aliases on case-insensitive filesystems', () => {
    const result = almanacConfigSchema.safeParse({ targets: ['AGENTS.md', 'agents.md'] })

    expect(result.success).toBeFalsy()
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('using regions')
    }
  })

  it('rejects target paths with glob, pathspec, and non-normalized syntax', () => {
    expect(almanacConfigSchema.safeParse({ targets: ['*.md'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: [':(glob)*.md'] }).success).toBeFalsy()
    expect(almanacConfigSchema.safeParse({ targets: ['docs//AGENTS.md'] }).success).toBeFalsy()
  })

  it('normalizes legacy targets to one managed region', () => {
    const result = almanacConfigSchema.parse({
      targets: [
        {
          format: 'flat',
          path: 'AGENTS.md',
          tags: { end: '</docs>', start: '<docs>' },
        },
      ],
    })

    expect(result.targets[0]).toEqual({
      path: 'AGENTS.md',
      regions: [
        {
          exclude: [],
          format: 'flat',
          tags: { end: '</docs>', start: '<docs>' },
        },
      ],
    })
  })

  it('rejects tag lines shared by regions in one target', () => {
    const result = almanacConfigSchema.safeParse({
      targets: [
        {
          path: 'AGENTS.md',
          regions: [
            { tags: { end: '</docs>', start: '<docs>' } },
            { tags: { end: '</standards>', start: '<docs>' } },
          ],
        },
      ],
    })

    expect(result.success).toBeFalsy()
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('conflicts with region 1')
    }
  })
})

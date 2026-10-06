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
      targets: {
        exclude: ['docs/archive/**'],
        include: ['docs/**'],
        path: 'AGENTS.md',
        tags: { end: '</docs>', start: '<docs>' },
      },
    })

    expect(result.targets[0]).toEqual({
      exclude: ['docs/archive/**'],
      include: ['docs/**'],
      path: 'AGENTS.md',
      regions: [
        {
          exclude: [],
          include: undefined,
          tags: { end: '</docs>', start: '<docs>' },
          template: undefined,
        },
      ],
    })
  })

  it('normalizes one target and one explicit region without arrays', () => {
    const result = almanacConfigSchema.parse({
      targets: {
        path: 'AGENTS.md',
        regions: {
          include: ['docs/standards/**'],
          tags: { end: '</standards>', start: '<standards>' },
        },
      },
    })

    expect(result.targets).toEqual([
      {
        exclude: [],
        include: undefined,
        path: 'AGENTS.md',
        regions: [
          {
            exclude: [],
            include: ['docs/standards/**'],
            tags: { end: '</standards>', start: '<standards>' },
            template: undefined,
          },
        ],
      },
    ])
  })

  it('normalizes one scalar target without an array', () => {
    const result = almanacConfigSchema.parse({ targets: 'AGENTS.md' })

    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]?.path).toBe('AGENTS.md')
  })

  it('normalizes scalar globs at every filter level', () => {
    const result = almanacConfigSchema.parse({
      exclude: 'docs/archive/**',
      include: 'docs/**',
      targets: {
        exclude: 'docs/drafts/**',
        include: 'docs/standards/**',
        path: 'AGENTS.md',
        regions: {
          exclude: 'docs/standards/archive/**',
          include: 'docs/standards/typescript/**',
          tags: { end: '</standards>', start: '<standards>' },
        },
      },
    })

    expect(result.exclude).toEqual(['docs/archive/**'])
    expect(result.include).toEqual(['docs/**'])
    expect(result.targets[0]?.exclude).toEqual(['docs/drafts/**'])
    expect(result.targets[0]?.include).toEqual(['docs/standards/**'])
    expect(result.targets[0]?.regions[0]?.exclude).toEqual(['docs/standards/archive/**'])
    expect(result.targets[0]?.regions[0]?.include).toEqual(['docs/standards/typescript/**'])
  })

  it('rejects the removed format field with migration guidance', () => {
    const result = almanacConfigSchema.safeParse({
      targets: { format: { template: 'old shape' }, path: 'AGENTS.md' },
    })

    expect(result.success).toBeFalsy()
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Remove format; set template directly only to override the built-in renderer',
      )
    }
  })

  it('normalizes a flattened template override', () => {
    const result = almanacConfigSchema.parse({
      targets: { path: 'AGENTS.md', template: '{{ documents.size }} documents' },
    })

    expect(result.targets[0]?.regions[0]?.template).toBe('{{ documents.size }} documents')
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

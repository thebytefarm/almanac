import { posix } from 'node:path'

import type { ConfigType } from 'maltty/config'
import { z } from 'zod'

const repoPatternSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith('/') &&
      !value.includes('\\') &&
      !/^[a-zA-Z]:\//u.test(value) &&
      !value
        .split('/')
        .some((segment) => segment === '..' || segment === '.' || segment === '.git'),
    'Must be a repository-relative POSIX path or glob without dot segments or .git',
  )

const targetPathSchema = repoPatternSchema.refine(
  (value) =>
    posix.normalize(value) === value &&
    !/[*?[\]]/u.test(value) &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127
    }) &&
    !value.startsWith(':'),
  'Must be a normalized repository-relative POSIX path without glob or pathspec syntax',
)

const formatSchema = z.union([
  z.literal('flat'),
  z.strictObject({
    template: z.string().trim().min(1),
  }),
])

const tagsSchema = z
  .strictObject({
    end: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
    start: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
  })
  .refine(({ end, start }) => end !== start, 'Start and end tags must differ')

const regionSchema = z.strictObject({
  exclude: z.array(repoPatternSchema).default([]),
  format: formatSchema.default('flat'),
  include: z.array(repoPatternSchema).min(1).optional(),
  tags: tagsSchema,
})

const targetSchema = z.strictObject({
  format: formatSchema.default('flat'),
  path: targetPathSchema,
  tags: tagsSchema.default({ end: '</docs-index>', start: '<docs-index>' }),
})

const regionalTargetSchema = z.strictObject({
  path: targetPathSchema,
  regions: z.array(regionSchema).min(1),
})

const targetInputSchema = z
  .union([targetPathSchema, targetSchema, regionalTargetSchema])
  .transform((target) => {
    if (typeof target === 'string') {
      return {
        path: target,
        regions: [
          {
            exclude: [],
            format: 'flat' as const,
            tags: { end: '</docs-index>', start: '<docs-index>' },
          },
        ],
      }
    }
    if ('regions' in target) {
      return target
    }
    return {
      path: target.path,
      regions: [{ exclude: [], format: target.format, tags: target.tags }],
    }
  })

/**
 * Validates Almanac's static project configuration and applies zero-config defaults.
 */
export const almanacConfigSchema = z
  .strictObject({
    exclude: z.array(repoPatternSchema).default([]),
    include: z
      .array(repoPatternSchema)
      .min(1)
      .default(['docs/**/*.md', 'apps/*/docs/**/*.md', 'packages/*/docs/**/*.md']),
    targets: z
      .array(targetInputSchema)
      .min(1)
      .default([
        {
          path: 'AGENTS.md',
          regions: [
            {
              exclude: [],
              format: 'flat',
              tags: { end: '</docs-index>', start: '<docs-index>' },
            },
          ],
        },
      ]),
  })
  .superRefine(({ targets }, ctx) => {
    const validTargets = targets.flatMap(({ path }, index) => {
      if (typeof path !== 'string') {
        return []
      }
      return [{ index, path }]
    })
    const duplicates = validTargets.filter(({ index, path }) => {
      const first = validTargets.find(
        (candidate) =>
          candidate.path.toLocaleLowerCase('en-US') === path.toLocaleLowerCase('en-US'),
      )
      return first?.index !== index
    })
    addDuplicateIssues(duplicates, ctx)
    targets.forEach((target, targetIndex) => {
      if (target.regions) {
        addDuplicateTagIssues(target.regions, targetIndex, ctx)
      }
    })
  })

declare module 'maltty/config' {
  interface ConfigRegistry extends ConfigType<typeof almanacConfigSchema> {}
}

function isSingleLine(value: string): boolean {
  return !value.includes('\n') && !value.includes('\r')
}

function addDuplicateIssues(
  duplicates: readonly { readonly index: number; readonly path: string }[],
  ctx: z.RefinementCtx,
): void {
  const [duplicate, ...remaining] = duplicates
  if (!duplicate) {
    return
  }
  ctx.addIssue({
    code: 'custom',
    message: `Duplicate target path: ${duplicate.path}. Combine its managed blocks under one target using regions`,
    path: ['targets', duplicate.index, 'path'],
  })
  addDuplicateIssues(remaining, ctx)
}

function addDuplicateTagIssues(
  regions: readonly { readonly tags: { readonly end: string; readonly start: string } }[],
  targetIndex: number,
  ctx: z.RefinementCtx,
): void {
  const seen = new Map<string, number>()
  const tagSides = ['start', 'end'] as const
  regions.forEach((region, regionIndex) => {
    tagSides.forEach((side) => {
      const tag = region.tags[side]
      const owner = seen.get(tag)
      if (owner !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `Managed region tag conflicts with region ${owner + 1}: ${tag}`,
          path: ['targets', targetIndex, 'regions', regionIndex, 'tags', side],
        })
      } else {
        seen.set(tag, regionIndex)
      }
    })
  })
}

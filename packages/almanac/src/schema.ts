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

const targetSchema = z.strictObject({
  format: z
    .union([
      z.literal('flat'),
      z.strictObject({
        template: z.string().trim().min(1),
      }),
    ])
    .default('flat'),
  path: targetPathSchema,
  tags: z
    .strictObject({
      end: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
      start: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
    })
    .refine(({ end, start }) => end !== start, 'Start and end tags must differ')
    .default({ end: '</docs-index>', start: '<docs-index>' }),
})

const targetInputSchema = z.union([targetPathSchema, targetSchema]).transform((target) => {
  if (typeof target === 'string') {
    return {
      format: 'flat' as const,
      path: target,
      tags: { end: '</docs-index>', start: '<docs-index>' },
    }
  }
  return target
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
          format: 'flat',
          path: 'AGENTS.md',
          tags: { end: '</docs-index>', start: '<docs-index>' },
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
    message: `Duplicate target path: ${duplicate.path}`,
    path: ['targets', duplicate.index, 'path'],
  })
  addDuplicateIssues(remaining, ctx)
}

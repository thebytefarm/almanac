import { posix } from 'node:path'

import type { ConfigType } from 'maltty/config'
import { isArray, isPlainObject, isString } from 'massaman/predicate'
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

const patternsSchema = z.union([repoPatternSchema, z.array(repoPatternSchema)]).transform(toArray)

const includePatternsSchema = z
  .union([repoPatternSchema, z.array(repoPatternSchema).min(1)])
  .transform(toArray)

const formatSchema = z.strictObject({
  template: z.string().trim().min(1),
})

const tagsSchema = z
  .strictObject({
    end: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
    start: z.string().trim().min(1).refine(isSingleLine, 'Must be a single line'),
  })
  .refine(({ end, start }) => end !== start, 'Start and end tags must differ')

const regionSchema = z
  .strictObject({
    exclude: patternsSchema.default([]),
    format: formatSchema.optional(),
    include: includePatternsSchema.optional(),
    tags: tagsSchema,
  })
  .transform((region) => ({ ...region, format: region.format, include: region.include }))

const targetSchema = z
  .strictObject({
    exclude: patternsSchema.default([]),
    format: formatSchema.optional(),
    include: includePatternsSchema.optional(),
    path: targetPathSchema,
    tags: tagsSchema.default({ end: '</docs-index>', start: '<docs-index>' }),
  })
  .transform((target) => ({ ...target, format: target.format, include: target.include }))

const regionalTargetSchema = z
  .strictObject({
    exclude: patternsSchema.default([]),
    include: includePatternsSchema.optional(),
    path: targetPathSchema,
    regions: z.union([regionSchema, z.array(regionSchema).min(1)]).transform(toArray),
  })
  .transform((target) => ({ ...target, include: target.include }))

const targetInputSchema = z
  .union([targetPathSchema, targetSchema, regionalTargetSchema])
  .transform((target) => {
    if (isString(target)) {
      return {
        exclude: [],
        include: undefined,
        path: target,
        regions: [
          {
            exclude: [],
            format: undefined,
            include: undefined,
            tags: { end: '</docs-index>', start: '<docs-index>' },
          },
        ],
      }
    }
    if ('regions' in target) {
      return target
    }
    return {
      exclude: target.exclude,
      include: target.include,
      path: target.path,
      regions: [
        {
          exclude: [],
          format: target.format,
          include: undefined,
          tags: target.tags,
        },
      ],
    }
  })

const normalizedConfigSchema = z
  .strictObject({
    exclude: patternsSchema.default([]),
    include: includePatternsSchema.default([
      'docs/**/*.md',
      'apps/*/docs/**/*.md',
      'packages/*/docs/**/*.md',
    ]),
    targets: z
      .union([targetInputSchema, z.array(targetInputSchema).min(1)])
      .transform(toArray)
      .default([
        {
          exclude: [],
          include: undefined,
          path: 'AGENTS.md',
          regions: [
            {
              exclude: [],
              format: undefined,
              include: undefined,
              tags: { end: '</docs-index>', start: '<docs-index>' },
            },
          ],
        },
      ]),
  })
  .superRefine(({ targets }, ctx) => {
    const validTargets = targets.flatMap(({ path }, index) => {
      if (!isString(path)) {
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

/**
 * Validates Almanac's static project configuration and applies zero-config defaults.
 */
export const almanacConfigSchema = z
  .unknown()
  .superRefine(addFlatFormatIssues)
  .pipe(normalizedConfigSchema)

declare module 'maltty/config' {
  interface ConfigRegistry extends ConfigType<typeof almanacConfigSchema> {}
}

function isSingleLine(value: string): boolean {
  return !value.includes('\n') && !value.includes('\r')
}

function toArray<T>(value: T | T[]): T[] {
  if (isArray(value)) {
    return value
  }
  return [value]
}

function addFlatFormatIssues(value: unknown, ctx: z.RefinementCtx): void {
  if (!isPlainObject(value)) {
    return
  }
  const configuredTargets = value.targets
  const targetArray = isArray(configuredTargets)
  const targets = toUnknownArray(configuredTargets)
  targets.forEach((target, targetIndex) => {
    if (!isPlainObject(target)) {
      return
    }
    const targetPath = getItemPath(['targets'], targetArray, targetIndex)
    addFlatFormatIssue(target.format, targetPath, ctx)

    const configuredRegions = target.regions
    const regionArray = isArray(configuredRegions)
    const regions = toUnknownArray(configuredRegions)
    regions.forEach((region, regionIndex) => {
      if (!isPlainObject(region)) {
        return
      }
      const regionPath = getItemPath([...targetPath, 'regions'], regionArray, regionIndex)
      addFlatFormatIssue(region.format, regionPath, ctx)
    })
  })
}

function addFlatFormatIssue(value: unknown, path: PropertyKey[], ctx: z.RefinementCtx): void {
  if (value !== 'flat') {
    return
  }
  ctx.addIssue({
    code: 'custom',
    message: 'Remove format: flat to use the built-in renderer',
    path: [...path, 'format'],
  })
}

function getItemPath(path: PropertyKey[], isArray: boolean, index: number): PropertyKey[] {
  if (!isArray) {
    return path
  }
  return [...path, index]
}

function toUnknownArray(value: unknown): unknown[] {
  if (isArray(value)) {
    return value
  }
  return [value]
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

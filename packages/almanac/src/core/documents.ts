import { glob, readFile } from 'node:fs/promises'
import { basename, matchesGlob } from 'node:path'

import { attempt, attemptAsync, err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'
import { match, P } from 'massaman/match'
import { parse } from 'yaml'

import type { GitClient } from '#adapters/git.js'
import type { RepoPathResolver } from '#lib/repo-path.js'
import { collectResults } from '#lib/result.js'
import type { AlmanacConfig } from '#types.js'
import type { TemplateDocument } from '#types.js'

const DESCRIPTION_MAX_LENGTH = 120
const FRONTMATTER_BOUNDARY = /^---\s*$/u
const HEADING = /^#{1,6}\s+(.+?)\s*#*$/u
const NON_PROSE = /^(?:#{1,6}\s|```|~~~|[-+*]\s|\d+[.)]\s|>|\||<|!\[)/u

/**
 * Discovers repository documents and derives stable template metadata.
 */
export interface DocumentCatalog {
  readonly discover: () => Promise<Result<readonly TemplateDocument[]>>
  readonly parse: (filePath: string, source: string) => Result<TemplateDocument>
}

/**
 * Creates a Git-aware catalog for discovering and parsing repository documents.
 *
 * @param options - Repository services and validated Almanac configuration.
 * @returns A catalog with deterministic discovery and metadata parsing operations.
 */
export function createDocumentCatalog(options: {
  readonly config: AlmanacConfig
  readonly git: GitClient
  readonly paths: RepoPathResolver
}): DocumentCatalog {
  const parseDocument = (filePath: string, source: string): Result<TemplateDocument> => {
    const parsedFrontmatter = parseFrontmatter(filePath, source)
    if (!parsedFrontmatter.ok) {
      return parsedFrontmatter
    }
    const { body, frontmatter } = parsedFrontmatter.value
    return createTemplateDocument(filePath, body, frontmatter)
  }

  return {
    discover: async () => {
      const candidates = await discoverCandidates(options.git.root, options.config)
      if (!candidates.ok) {
        return candidates
      }
      const ignored = await options.git.findIgnoredPaths(candidates.value)
      if (!ignored.ok) {
        return ignored
      }

      const documents = await Promise.all(
        candidates.value
          .filter((path) => !ignored.value.has(path))
          .map(async (filePath) => {
            const absolutePath = await options.paths.resolve(filePath)
            if (!absolutePath.ok) {
              return absolutePath
            }
            const source = await attemptAsync(() => readFile(absolutePath.value, 'utf8'))
            if (!source.ok) {
              return source
            }
            return parseDocument(filePath, source.value)
          }),
      )
      return collectResults(documents)
    },
    parse: parseDocument,
  }
}

function createTemplateDocument(
  filePath: string,
  body: string,
  frontmatter: Readonly<Record<string, unknown>>,
): Result<TemplateDocument> {
  const lines = body.split(/\r?\n/u)
  const headingIndex = lines.findIndex((line) => HEADING.test(line.trim()))
  const heading = getHeading(lines, headingIndex)
  const parsedTitle = readOptionalString(filePath, frontmatter, 'title')
  if (!parsedTitle.ok) {
    return parsedTitle
  }
  const parsedDescription = readOptionalString(filePath, frontmatter, 'description')
  if (!parsedDescription.ok) {
    return parsedDescription
  }
  const title = parsedTitle.value ?? normalizeInline(heading)
  const afterHeading = getLinesAfterHeading(lines, headingIndex)
  const description = truncateDescription(
    normalizeInline(parsedDescription.value) ??
      findFirstParagraph(afterHeading) ??
      findFirstParagraph(lines),
  )

  return ok(
    match({ description, title })
      .with({ description: P.string, title: P.string }, (value) => ({
        description: value.description,
        fileName: basename(filePath),
        filePath,
        title: value.title,
      }))
      .with({ description: P.string }, (value) => ({
        description: value.description,
        fileName: basename(filePath),
        filePath,
      }))
      .with({ title: P.string }, (value) => ({
        fileName: basename(filePath),
        filePath,
        title: value.title,
      }))
      .otherwise(() => ({ fileName: basename(filePath), filePath })),
  )
}

function parseFrontmatter(
  filePath: string,
  source: string,
): Result<{ readonly body: string; readonly frontmatter: Readonly<Record<string, unknown>> }> {
  const lines = source.split(/\r?\n/u)
  if (!FRONTMATTER_BOUNDARY.test(lines[0] ?? '')) {
    return ok({ body: source, frontmatter: {} })
  }

  const end = lines.findIndex((line, index) => index > 0 && FRONTMATTER_BOUNDARY.test(line))
  if (end < 0) {
    return err(`${filePath}: frontmatter is missing its closing ---`)
  }

  const parsed = attempt<unknown>(() => parse(lines.slice(1, end).join('\n')))
  if (!parsed.ok) {
    return parsed
  }
  if (parsed.value !== null && (typeof parsed.value !== 'object' || Array.isArray(parsed.value))) {
    return err(`${filePath}: frontmatter must be a mapping`)
  }

  return ok({
    body: lines.slice(end + 1).join('\n'),
    frontmatter: (parsed.value ?? {}) as Readonly<Record<string, unknown>>,
  })
}

function readOptionalString(
  filePath: string,
  frontmatter: Readonly<Record<string, unknown>>,
  key: 'description' | 'title',
): Result<string | undefined> {
  const value = frontmatter[key]
  if (value === undefined || value === null) {
    return ok(undefined)
  }
  if (typeof value !== 'string') {
    return err(`${filePath}: frontmatter ${key} must be a string`)
  }
  return ok(value)
}

function findFirstParagraph(lines: readonly string[]): string | undefined {
  const paragraphs = lines
    .join('\n')
    .split(/\n\s*\n/u)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((paragraph) => paragraph.length > 0)
  const prose = paragraphs.find((paragraph) => {
    const first = paragraph[0] ?? ''
    return !NON_PROSE.test(first) && !paragraph.some((line) => /^(```|~~~)/u.test(line))
  })
  return normalizeInline(prose?.join(' '))
}

function normalizeInline(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/[`*_~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return normalized || undefined
}

function truncateDescription(value: string | undefined): string | undefined {
  if (!value || value.length <= DESCRIPTION_MAX_LENGTH) {
    return value
  }
  const shortened = value.slice(0, DESCRIPTION_MAX_LENGTH - 3).replace(/\s+\S*$/u, '')
  if (shortened) {
    return `${shortened}...`
  }
  return `${value.slice(0, DESCRIPTION_MAX_LENGTH - 3)}...`
}

async function discoverCandidates(
  repoRoot: string,
  config: AlmanacConfig,
): Promise<Result<readonly string[]>> {
  return attemptAsync(async () => {
    const matched = await Promise.all(
      config.include.map((pattern) =>
        collectAsyncIterator(glob(pattern, { cwd: repoRoot })[Symbol.asyncIterator]()),
      ),
    )
    const discovered = new Set(matched.flat())
    const targetPaths = new Set(config.targets.map((target) => target.path))
    return [...discovered]
      .filter((path) => !targetPaths.has(path))
      .filter((path) => !config.exclude.some((pattern) => matchesGlob(path, pattern)))
      .sort(comparePaths)
  })
}

function comparePaths(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

async function collectAsyncIterator<T>(
  iterator: AsyncIterator<T>,
  values: readonly T[] = [],
): Promise<readonly T[]> {
  const next = await iterator.next()
  if (next.done) {
    return values
  }
  return collectAsyncIterator(iterator, [...values, next.value])
}

function getHeading(lines: readonly string[], headingIndex: number): string | undefined {
  if (headingIndex < 0) {
    return undefined
  }
  return HEADING.exec(lines[headingIndex]?.trim() ?? '')?.[1]
}

function getLinesAfterHeading(lines: readonly string[], headingIndex: number): readonly string[] {
  if (headingIndex < 0) {
    return []
  }
  return lines.slice(headingIndex + 1)
}

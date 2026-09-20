import { err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

/**
 * Exact full-line delimiters around one generated target block.
 */
export interface RegionTags {
  readonly end: string
  readonly start: string
}

/**
 * Byte-preserving operations over one target's managed block.
 */
export interface Region {
  readonly initialize: (source: string) => Result<string>
  readonly remove: (source: string) => Result<string>
  readonly replace: (source: string, body: string) => Result<string>
}

interface SourceLine {
  readonly end: number
  readonly ending: string
  readonly start: number
  readonly text: string
}

/**
 * Creates a line-anchored managed block editor for one target file.
 *
 * @param options - Target path and exact start/end marker lines.
 * @returns An immutable editor that preserves all human-owned bytes.
 */
export function createRegion(options: {
  readonly filePath: string
  readonly tags: RegionTags
}): Region {
  const { filePath, tags } = options

  return {
    initialize: (source) => {
      const lines = readLines(source)
      const starts = findLines(lines, tags.start)
      const ends = findLines(lines, tags.end)
      if (starts.length === 1 && ends.length === 1) {
        const start = starts[0]
        const end = ends[0]
        if (start && end && start.start < end.start) {
          return ok(source)
        }
      }
      if (starts.length > 0 || ends.length > 0) {
        const bounds = findBounds(filePath, lines, tags)
        if (!bounds.ok) {
          return bounds
        }
      }

      const newline = getNewline(source)
      const prefix = getInitializationPrefix(source, newline)
      return ok(`${source}${prefix}${tags.start}${newline}${tags.end}${newline}`)
    },
    remove: (source) => {
      const bounds = findBounds(filePath, readLines(source), tags)
      if (!bounds.ok) {
        return bounds
      }
      return ok(`${source.slice(0, bounds.value.start.start)}${source.slice(bounds.value.end.end)}`)
    },
    replace: (source, body) => {
      const bodyLines = readLines(body)
      if (
        findLines(bodyLines, tags.start).length > 0 ||
        findLines(bodyLines, tags.end).length > 0
      ) {
        return err(`${filePath}: rendered body contains managed block tags`)
      }
      const bounds = findBounds(filePath, readLines(source), tags)
      if (!bounds.ok) {
        return bounds
      }
      const newline = bounds.value.start.ending || getNewline(source)
      const renderedBody = body.replaceAll('\n', newline)
      const block = renderBlock(tags, renderedBody, newline)
      return ok(
        `${source.slice(0, bounds.value.start.start)}${block}${bounds.value.end.ending}${source.slice(bounds.value.end.end)}`,
      )
    },
  }
}

function findBounds(
  filePath: string,
  lines: readonly SourceLine[],
  tags: RegionTags,
): Result<{ readonly end: SourceLine; readonly start: SourceLine }> {
  const starts = findLines(lines, tags.start)
  const ends = findLines(lines, tags.end)

  if (starts.length !== 1 || ends.length !== 1) {
    return err(`${filePath}: expected exactly one ${tags.start} and ${tags.end} line`)
  }

  const start = starts[0]
  const end = ends[0]
  if (!start || !end || start.start >= end.start) {
    return err(`${filePath}: managed block tags are out of order`)
  }
  return ok({ end, start })
}

function findLines(lines: readonly SourceLine[], value: string): SourceLine[] {
  return lines.filter((line) => line.text === value)
}

function readLines(source: string): SourceLine[] {
  return [...source.matchAll(/[^\r\n]*(?:\r\n|\n|$)/gu)].flatMap((match) => {
    const value = match[0]
    if (!value) {
      return []
    }
    const ending = getLineEnding(value)
    const start = match.index
    return [
      {
        end: start + value.length,
        ending,
        start,
        text: getLineText(value, ending),
      },
    ]
  })
}

function getNewline(source: string): string {
  if (source.includes('\r\n')) {
    return '\r\n'
  }
  return '\n'
}

function getLineEnding(value: string): string {
  if (value.endsWith('\r\n')) {
    return '\r\n'
  }
  if (value.endsWith('\n')) {
    return '\n'
  }
  return ''
}

function getLineText(value: string, ending: string): string {
  if (!ending) {
    return value
  }
  return value.slice(0, -ending.length)
}

function getInitializationPrefix(source: string, newline: string): string {
  if (source.length === 0 || source.endsWith('\n')) {
    return ''
  }
  return newline
}

function renderBlock(tags: RegionTags, body: string, newline: string): string {
  if (!body) {
    return `${tags.start}${newline}${tags.end}`
  }
  return `${tags.start}${newline}${newline}${body}${newline}${newline}${tags.end}`
}

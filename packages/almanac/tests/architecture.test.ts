import { glob, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT_LAYER = '.'

/**
 * Layers a module may import, keyed by the directory directly under `src/`.
 *
 * Dependencies point one way only:
 *   commands -> lib | middleware -> client -> core -> adapters | lib
 * Root modules (`client`, `index`, `schema`, `types`) are the shared spine.
 */
const ALLOWED_IMPORTS: Record<string, readonly string[]> = {
  '.': ['.', 'adapters', 'core', 'lib', 'middleware'],
  adapters: ['lib'],
  commands: ['commands', 'lib'],
  core: ['.', 'adapters', 'core', 'lib'],
  lib: ['lib'],
  middleware: ['.', 'adapters', 'lib', 'middleware'],
}

const FORBIDDEN_SYNTAX = [
  { name: 'class', pattern: /\bclass\s+[A-Za-z_$]/gu },
  { name: 'do loop', pattern: /\bdo\s*\{/gu },
  { name: 'for loop', pattern: /\bfor\s*\(/gu },
  { name: 'for-in or for-of loop', pattern: /\bfor\s+(?:await\s+)?(?:const|let|var)\b/gu },
  { name: 'throw statement', pattern: /\bthrow\s+/gu },
  { name: 'while loop', pattern: /\bwhile\s*\(/gu },
] as const

describe('source architecture', () => {
  it('keeps the functional syntax and public documentation contract', async () => {
    const files = await collectAsyncIterator(glob('src/**/!(*.test).ts')[Symbol.asyncIterator]())
    const inspected = await Promise.all(files.map(inspectFile))

    expect(inspected.flat()).toEqual([])
  })
})

async function inspectFile(filePath: string): Promise<readonly string[]> {
  const source = await readFile(filePath, 'utf8')
  const syntaxViolations = FORBIDDEN_SYNTAX.flatMap(({ name, pattern }) =>
    [...source.matchAll(pattern)].map(
      (match) => `${filePath}:${getLine(source, match.index)} ${name}`,
    ),
  )
  const singleLineDocs = [...source.matchAll(/^\s*\/\*\*[^\n]*\*\/\s*$/gmu)].map(
    (match) => `${filePath}:${getLine(source, match.index)} single-line JSDoc`,
  )
  const undocumentedExports = source
    .split('\n')
    .flatMap((line, index, lines) => inspectExport(filePath, line, index, lines))
  return [
    ...syntaxViolations,
    ...singleLineDocs,
    ...undocumentedExports,
    ...inspectImports(filePath, source),
  ]
}

/**
 * Flags internal imports that cross a layer boundary the wrong way.
 *
 * Covers both sibling relatives (`./documents.js`) and the `#` subpath
 * imports used for every cross-layer edge.
 */
function inspectImports(filePath: string, source: string): readonly string[] {
  const layer = getLayer(filePath)
  const allowed = ALLOWED_IMPORTS[layer] ?? []
  return [...source.matchAll(/(?:from|import\()\s*'([#.][^']*\.js)'/gu)].flatMap((match) => {
    const target = resolveTargetLayer(filePath, match[1] ?? '')
    if (allowed.includes(target)) {
      return []
    }
    return [`${filePath}:${getLine(source, match.index)} ${layer} must not import ${target}`]
  })
}

function resolveTargetLayer(filePath: string, specifier: string): string {
  if (specifier.startsWith('#')) {
    return getSegmentLayer(specifier.slice(1))
  }
  return getLayer(path.join(path.dirname(filePath), specifier))
}

function getLayer(filePath: string): string {
  return getSegmentLayer(path.relative('src', filePath))
}

function getSegmentLayer(relativePath: string): string {
  const segments = relativePath.split(path.sep)
  if (segments.length < 2) {
    return ROOT_LAYER
  }
  return segments[0] ?? ROOT_LAYER
}

function inspectExport(
  filePath: string,
  line: string,
  index: number,
  lines: readonly string[],
): readonly string[] {
  if (!/^export\s/u.test(line)) {
    return []
  }
  const previous = findPreviousContent(lines, index - 1)
  if (previous === '*/') {
    return []
  }
  return [`${filePath}:${index + 1} export without JSDoc`]
}

function findPreviousContent(lines: readonly string[], index: number): string | undefined {
  if (index < 0) {
    return undefined
  }
  const line = lines[index]?.trim()
  if (line) {
    return line
  }
  return findPreviousContent(lines, index - 1)
}

function getLine(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
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

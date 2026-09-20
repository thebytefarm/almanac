import { access, chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'

import { attempt, attemptAsync, err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { GitClient } from '#adapters/git.js'

const START = '# almanac:start'
const END = '# almanac:end'

/**
 * Effective pre-commit hook path and Almanac fragment state.
 */
export interface HookStatus {
  readonly path: string
  readonly status: 'installed' | 'malformed' | 'not-executable' | 'not-installed'
}

/**
 * Idempotent operations over Almanac's isolated pre-commit fragment.
 */
export interface HookManager {
  readonly install: () => Promise<Result<HookStatus>>
  readonly remove: () => Promise<Result<HookStatus>>
  readonly status: () => Promise<Result<HookStatus>>
}

/**
 * Creates an idempotent manager for Almanac's pre-commit fragment.
 *
 * @param options - Repository-scoped Git client.
 * @returns A manager that preserves unrelated hook bytes and file modes.
 */
export function createHookManager(options: { readonly git: GitClient }): HookManager {
  const load = async (): Promise<Result<{ readonly path: string; readonly source: string }>> => {
    const directory = await options.git.resolveHooksDirectory()
    if (!directory.ok) {
      return directory
    }
    const path = `${directory.value}/pre-commit`
    const source = await readOptional(path)
    if (!source.ok) {
      return source
    }
    return ok({ path, source: source.value })
  }

  return {
    install: async () => {
      const hook = await load()
      if (!hook.ok) {
        return hook
      }
      const state = inspectHook(hook.value.source)
      if (state === 'malformed') {
        return err(`${hook.value.path}: malformed Almanac hook markers`)
      }
      const command = await detectCommand(options.git.root)
      if (!command.ok) {
        return command
      }
      const fragment = `${START}\n${command.value} || exit $?\n${END}`
      const output = upsertFragment(hook.value.source, fragment, state)
      if (!output.ok) {
        return output
      }
      const written = await writeHookAtomic(hook.value.path, output.value)
      if (!written.ok) {
        return written
      }
      const executable = await ensureExecutable(hook.value.path)
      if (!executable.ok) {
        return executable
      }
      return ok({ path: hook.value.path, status: 'installed' })
    },
    remove: async () => {
      const hook = await load()
      if (!hook.ok) {
        return hook
      }
      const state = inspectHook(hook.value.source)
      if (state === 'malformed') {
        return err(`${hook.value.path}: malformed Almanac hook markers`)
      }
      if (state === 'not-installed') {
        return ok({ path: hook.value.path, status: state })
      }

      const output = removeFragment(hook.value.source)
      if (output.trim() === '#!/bin/sh') {
        const removed = await attemptAsync(() => rm(hook.value.path))
        if (!removed.ok) {
          return removed
        }
        return ok({ path: hook.value.path, status: 'not-installed' })
      }
      const written = await writeHookAtomic(hook.value.path, output)
      if (!written.ok) {
        return written
      }
      return ok({ path: hook.value.path, status: 'not-installed' })
    },
    status: async () => {
      const hook = await load()
      if (!hook.ok) {
        return hook
      }
      const state = inspectHook(hook.value.source)
      if (state !== 'installed') {
        return ok({ path: hook.value.path, status: state })
      }
      const executable = await isExecutable(hook.value.path)
      if (!executable.ok) {
        return executable
      }
      if (!executable.value) {
        return ok({ path: hook.value.path, status: 'not-executable' })
      }
      return ok({ path: hook.value.path, status: state })
    },
  }
}

function inspectHook(source: string): HookStatus['status'] {
  const lines = source.split(/\r?\n/u)
  const starts = lines.filter((line) => line === START).length
  const ends = lines.filter((line) => line === END).length
  if (starts === 0 && ends === 0) {
    return 'not-installed'
  }
  if (starts !== 1 || ends !== 1 || lines.indexOf(START) >= lines.indexOf(END)) {
    return 'malformed'
  }
  return 'installed'
}

function upsertFragment(
  source: string,
  fragment: string,
  state: HookStatus['status'],
): Result<string> {
  if (source && !isShellHook(source)) {
    return err('Existing pre-commit hook does not use a supported shell')
  }
  if (source.includes('\r\n')) {
    return err('Existing pre-commit hook uses CRLF line endings and cannot be safely executed')
  }
  if (state === 'installed') {
    const start = findLine(source, START)
    const end = findLine(source, END)
    if (!start || !end) {
      return err('Existing Almanac hook fragment could not be resolved')
    }
    const newline = getNewline(source)
    const renderedFragment = fragment.replaceAll('\n', newline)
    return ok(
      `${source.slice(0, start.start)}${renderedFragment}${newline}${source.slice(end.end)}`,
    )
  }
  return ok(insertFragment(source, fragment))
}

function insertFragment(source: string, fragment: string): string {
  if (!source) {
    return `#!/bin/sh\n${fragment}\n`
  }

  const newline = getNewline(source)
  const renderedFragment = fragment.replaceAll('\n', newline)
  const shebang = /^#![^\r\n]*(?:\r\n|\n)?/u.exec(source)?.[0]

  if (!shebang) {
    return `${renderedFragment}${newline}${source}`
  }
  if (!shebang.endsWith('\n')) {
    return `${source}${newline}${renderedFragment}${newline}`
  }
  return `${shebang}${renderedFragment}${newline}${source.slice(shebang.length)}`
}

function isShellHook(source: string): boolean {
  const shebang = /^#!([^\r\n]*)/u.exec(source)?.[1]
  if (!shebang) {
    return true
  }
  const parts = shebang.trim().split(/\s+/u)
  const executable = basename(parts[0] ?? '')
  if (executable !== 'env') {
    return isSupportedShell(executable)
  }
  const shell = parts.slice(1).find((part) => !part.startsWith('-'))
  return isSupportedShell(shell)
}

function isSupportedShell(shell: string | undefined): boolean {
  return (
    shell === 'sh' || shell === 'bash' || shell === 'dash' || shell === 'ksh' || shell === 'zsh'
  )
}

function removeFragment(source: string): string {
  const start = findLine(source, START)
  const end = findLine(source, END)
  if (!start || !end) {
    return source
  }
  return `${source.slice(0, start.start)}${source.slice(end.end)}`
}

async function ensureExecutable(path: string): Promise<Result<undefined>> {
  const fileStat = await attemptAsync(() => stat(path))
  if (!fileStat.ok) {
    return fileStat
  }
  if ((fileStat.value.mode & 0o100) !== 0) {
    return ok(undefined)
  }
  const changed = await attemptAsync(() => chmod(path, fileStat.value.mode | 0o100))
  if (!changed.ok) {
    return changed
  }
  return ok(undefined)
}

async function isExecutable(path: string): Promise<Result<boolean>> {
  const fileStat = await attemptAsync(() => stat(path))
  if (!fileStat.ok) {
    return fileStat
  }
  return ok((fileStat.value.mode & 0o100) !== 0)
}

async function writeHookAtomic(path: string, contents: string): Promise<Result<undefined>> {
  const temporaryPath = `${path}.almanac-${process.pid}.tmp`
  const existing = await attemptAsync(() => stat(path))
  if (!existing.ok && (!isNodeError(existing.error) || existing.error.code !== 'ENOENT')) {
    return existing
  }
  const written = await attemptAsync(async () => {
    await mkdir(dirname(path), { recursive: true })
    if (existing.ok) {
      await writeFile(temporaryPath, contents, { mode: existing.value.mode })
    }
    if (!existing.ok) {
      await writeFile(temporaryPath, contents, { mode: 0o755 })
    }
    await rename(temporaryPath, path)
  })
  if (!written.ok) {
    return written
  }
  return ok(undefined)
}

function findLine(
  source: string,
  marker: string,
): { readonly end: number; readonly start: number } | undefined {
  return [...source.matchAll(/[^\r\n]*(?:\r\n|\n|$)/gu)].flatMap((match) => {
    const value = match[0]
    if (!value) {
      return []
    }
    const endingLength = getEndingLength(value)
    if (value.slice(0, value.length - endingLength) !== marker) {
      return []
    }
    return [{ end: match.index + value.length, start: match.index }]
  })[0]
}

async function detectCommand(repoRoot: string): Promise<Result<string>> {
  const manifest = await readOptional(`${repoRoot}/package.json`)
  if (!manifest.ok) {
    return manifest
  }
  const project = readProjectManifest(manifest.value)
  if (!project.ok) {
    return project
  }

  if (project.value.packageManager === 'pnpm') {
    if (project.value.hasAlmanacScript) {
      return ok('pnpm almanac sync')
    }
    return ok('pnpm exec almanac sync')
  }
  if (project.value.packageManager === 'yarn') {
    if (project.value.hasAlmanacScript) {
      return ok('yarn almanac sync')
    }
    return ok('yarn exec almanac sync')
  }
  if (project.value.packageManager === 'bun') {
    if (project.value.hasAlmanacScript) {
      return ok('bun run almanac sync')
    }
    return ok('bunx almanac sync')
  }
  if (project.value.packageManager === 'npm') {
    if (project.value.hasAlmanacScript) {
      return ok('npm run almanac -- sync')
    }
    return ok('npm exec --offline -- almanac sync')
  }
  if (await exists(`${repoRoot}/pnpm-lock.yaml`)) {
    if (project.value.hasAlmanacScript) {
      return ok('pnpm almanac sync')
    }
    return ok('pnpm exec almanac sync')
  }
  if (await exists(`${repoRoot}/yarn.lock`)) {
    if (project.value.hasAlmanacScript) {
      return ok('yarn almanac sync')
    }
    return ok('yarn exec almanac sync')
  }
  if ((await exists(`${repoRoot}/bun.lock`)) || (await exists(`${repoRoot}/bun.lockb`))) {
    if (project.value.hasAlmanacScript) {
      return ok('bun run almanac sync')
    }
    return ok('bunx almanac sync')
  }
  if (project.value.hasAlmanacScript) {
    return ok('npm run almanac -- sync')
  }
  return ok('npm exec --offline -- almanac sync')
}

async function readOptional(path: string): Promise<Result<string>> {
  const source = await attemptAsync(() => readFile(path, 'utf8'))
  if (source.ok) {
    return source
  }
  if (isNodeError(source.error) && source.error.code === 'ENOENT') {
    return ok('')
  }
  return source
}

async function exists(path: string): Promise<boolean> {
  const result = await attemptAsync(() => access(path))
  return result.ok
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function getNewline(source: string): string {
  if (source.includes('\r\n')) {
    return '\r\n'
  }
  return '\n'
}

function getEndingLength(value: string): number {
  if (value.endsWith('\r\n')) {
    return 2
  }
  if (value.endsWith('\n')) {
    return 1
  }
  return 0
}

function readProjectManifest(source: string): Result<{
  readonly hasAlmanacScript: boolean
  readonly packageManager?: string
}> {
  if (!source) {
    return ok({ hasAlmanacScript: false })
  }
  const parsed = attempt<unknown>(() => JSON.parse(source))
  if (!parsed.ok) {
    return parsed
  }
  if (typeof parsed.value !== 'object' || parsed.value === null) {
    return ok({ hasAlmanacScript: false })
  }
  const packageManager: unknown = Reflect.get(parsed.value, 'packageManager')
  const scripts: unknown = Reflect.get(parsed.value, 'scripts')
  const hasAlmanacScript = typeof scripts === 'object' && scripts !== null && 'almanac' in scripts
  if (typeof packageManager !== 'string') {
    return ok({ hasAlmanacScript })
  }
  const [packageManagerName] = packageManager.split('@')
  if (!packageManagerName) {
    return ok({ hasAlmanacScript })
  }
  return ok({ hasAlmanacScript, packageManager: packageManagerName })
}

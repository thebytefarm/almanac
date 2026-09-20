import { spawn } from 'node:child_process'
import { isAbsolute, relative, resolve } from 'node:path'

import { findProjectRoot } from 'maltty/project'
import { err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

/**
 * Captured output from one completed Git subprocess.
 */
export interface GitOutput {
  readonly exitCode: number
  readonly stderr: string
  readonly stdout: string
}

/**
 * Repository-scoped Git operations used by Almanac services.
 */
export interface GitClient {
  readonly findIgnoredPaths: (paths: readonly string[]) => Promise<Result<ReadonlySet<string>>>
  readonly root: string
  readonly resolveHooksDirectory: () => Promise<Result<string>>
  readonly run: (args: readonly string[], options?: GitRunOptions) => Promise<Result<GitOutput>>
}

/**
 * Controls accepted exit codes and standard input for a Git invocation.
 */
export interface GitRunOptions {
  readonly acceptExitCodes?: readonly number[]
  readonly input?: string
}

/**
 * Creates a Git client scoped to the repository containing one working directory.
 *
 * @param startDir - Directory from which Maltty discovers the nearest Git repository.
 * @returns A result containing an immutable repository-scoped client.
 */
export function createGitClient(startDir: string = process.cwd()): Result<GitClient> {
  const root = findProjectRoot(startDir)
  if (!root) {
    return err(`No Git repository found from ${startDir}`)
  }
  const run = (args: readonly string[], options: GitRunOptions = {}): Promise<Result<GitOutput>> =>
    runGit(root, args, options)

  return ok({
    findIgnoredPaths: async (paths) => {
      if (paths.length === 0) {
        return ok(new Set())
      }
      const result = await run(['check-ignore', '--no-index', '--stdin', '-z'], {
        acceptExitCodes: [0, 1],
        input: `${paths.join('\0')}\0`,
      })
      if (!result.ok) {
        return result
      }
      return ok(new Set(result.value.stdout.split('\0').filter(Boolean)))
    },
    root,
    resolveHooksDirectory: async () => {
      const configured = await run(['config', '--path', '--get', 'core.hooksPath'], {
        acceptExitCodes: [0, 1],
      })
      if (!configured.ok) {
        return configured
      }
      const configuredPath = configured.value.stdout.trim()
      if (configured.value.exitCode === 0 && configuredPath) {
        const hooksPath = resolveGitPath(root, configuredPath)
        return validateHooksDirectory(root, hooksPath, run)
      }

      const fallback = await run(['rev-parse', '--git-path', 'hooks'])
      if (!fallback.ok) {
        return fallback
      }
      const hooksPath = fallback.value.stdout.trim()
      if (isAbsolute(hooksPath)) {
        return validateHooksDirectory(root, hooksPath, run)
      }
      return validateHooksDirectory(root, resolve(root, hooksPath), run)
    },
    run,
  })
}

async function validateHooksDirectory(
  root: string,
  hooksPath: string,
  run: GitClient['run'],
): Promise<Result<string>> {
  if (isWithin(root, hooksPath)) {
    return ok(hooksPath)
  }
  const common = await run(['rev-parse', '--git-common-dir'])
  if (!common.ok) {
    return common
  }
  const commonPath = common.value.stdout.trim()
  const commonDirectory = resolveGitPath(root, commonPath)
  if (isWithin(commonDirectory, hooksPath)) {
    return ok(hooksPath)
  }
  return err(`Refusing to modify shared hooks directory outside the repository: ${hooksPath}`)
}

function resolveGitPath(root: string, path: string): string {
  if (isAbsolute(path)) {
    return path
  }
  return resolve(root, path)
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path))
}

function runGit(
  cwd: string,
  args: readonly string[],
  options: GitRunOptions,
): Promise<Result<GitOutput>> {
  return new Promise((resolveResult) => {
    const child = spawn('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => resolveResult(err(error)))
    child.on('close', (exitCode) => {
      const result = {
        exitCode: exitCode ?? 1,
        stderr: Buffer.concat(stderr).toString('utf8'),
        stdout: Buffer.concat(stdout).toString('utf8'),
      }
      const accepted = options.acceptExitCodes ?? [0]
      if (accepted.includes(result.exitCode)) {
        return resolveResult(ok(result))
      }
      return resolveResult(err(result.stderr.trim() || `git ${args.join(' ')} failed`))
    })
    child.stdin.end(options.input)
  })
}

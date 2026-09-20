import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

/**
 * Isolated real Git repository used by Almanac integration tests.
 */
export interface GitFixture {
  readonly cleanup: () => Promise<void>
  readonly commit: (message: string) => Promise<void>
  readonly git: (...args: readonly string[]) => Promise<string>
  readonly path: string
  readonly read: (path: string) => Promise<string>
  readonly write: (path: string, contents: string) => Promise<void>
}

/**
 * Creates and initializes a temporary Git repository with optional seed files.
 *
 * @param files - Repository-relative paths and their initial UTF-8 contents.
 * @returns Operations scoped to the temporary repository.
 */
export async function createGitFixture(
  files: Readonly<Record<string, string>> = {},
): Promise<GitFixture> {
  const path = await mkdtemp(join(tmpdir(), 'almanac-'))
  const git = async (...args: readonly string[]) => {
    const { stdout } = await exec('git', args, { cwd: path })
    return stdout.trim()
  }
  const write = async (relativePath: string, contents: string) => {
    const absolutePath = join(path, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, contents)
  }

  await git('init', '--initial-branch=main')
  await git('config', 'user.email', 'almanac@example.com')
  await git('config', 'user.name', 'Almanac Test')
  await Promise.all(Object.entries(files).map(([filePath, contents]) => write(filePath, contents)))

  return {
    cleanup: () => rm(path, { force: true, maxRetries: 3, recursive: true, retryDelay: 50 }),
    commit: async (message) => {
      await git('add', '--all')
      await git('commit', '-m', message)
    },
    git,
    path,
    read: (relativePath) => readFile(join(path, relativePath), 'utf8'),
    write,
  }
}

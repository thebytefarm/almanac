import { lstat, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { attemptAsync, err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { GitClient } from '#adapters/git.js'
import { createRegion } from '#lib/region.js'
import type { RepoPathResolver } from '#lib/repo-path.js'
import { collectResults } from '#lib/result.js'
import type { AlmanacConfig } from '#types.js'

import type { DocumentCatalog } from './documents.js'
import type { IndexRenderer } from './render.js'

/**
 * Drift state for one configured instruction target.
 */
export interface TargetChange {
  readonly changed: boolean
  readonly path: string
}

/**
 * Shared target analysis and write pipeline used by sync, check, and init.
 */
export interface Project {
  readonly initializeTargets: () => Promise<Result<readonly string[]>>
  readonly sync: (options: {
    readonly stage: boolean
    readonly write: boolean
  }) => Promise<Result<readonly TargetChange[]>>
}

interface GeneratedTarget extends TargetChange {
  readonly absolutePath: string
  readonly body: string
  readonly output: string
  readonly tags: { readonly end: string; readonly start: string }
}

interface InitializedTarget extends TargetChange {
  readonly absolutePath: string
  readonly output: string
}

/**
 * Creates the project writer shared by sync, check, and init.
 *
 * @param options - Validated configuration and repository-scoped collaborators.
 * @returns A project service for deterministic target analysis and writes.
 */
export function createProject(options: {
  readonly catalog: DocumentCatalog
  readonly config: AlmanacConfig
  readonly git: GitClient
  readonly paths: RepoPathResolver
  readonly renderer: IndexRenderer
}): Project {
  return {
    initializeTargets: async () => {
      const initialized = await Promise.all(
        options.config.targets.map((target) => initializeTarget(options.paths, target)),
      )
      const targets = collectResults(initialized)
      if (!targets.ok) {
        return targets
      }
      const written = await writeInitializedTargets(targets.value.filter(({ changed }) => changed))
      if (!written.ok) {
        return written
      }
      return ok(targets.value.map(({ path }) => path))
    },
    sync: async (syncOptions) => {
      const documents = await options.catalog.discover()
      if (!documents.ok) {
        return documents
      }
      const analyzed = await Promise.all(
        options.config.targets.map((target) =>
          generateTarget({
            documents: documents.value,
            paths: options.paths,
            renderer: options.renderer,
            target,
          }),
        ),
      )
      const generated = collectResults(analyzed)
      if (!generated.ok) {
        return generated
      }
      if (syncOptions.write) {
        const written = await writeGeneratedTargets(
          generated.value.filter(({ changed }) => changed),
        )
        if (!written.ok) {
          return written
        }
      }

      if (syncOptions.stage) {
        const staged = await stageManagedTargets(
          options.git,
          generated.value.filter(({ changed }) => changed),
        )
        if (!staged.ok) {
          return staged
        }
      }
      return ok(generated.value.map(({ changed, path }) => ({ changed, path })))
    },
  }
}

async function initializeTarget(
  paths: RepoPathResolver,
  target: AlmanacConfig['targets'][number],
): Promise<Result<InitializedTarget>> {
  const path = await paths.resolve(target.path)
  if (!path.ok) {
    return path
  }
  const safeTarget = await validateTargetPath(path.value, target.path)
  if (!safeTarget.ok) {
    return safeTarget
  }
  const source = await readOptional(path.value)
  if (!source.ok) {
    return source
  }
  const block = createRegion({ filePath: target.path, tags: target.tags })
  const output = block.initialize(source.value)
  if (!output.ok) {
    return output
  }
  if (output.value === source.value) {
    return ok({ absolutePath: path.value, changed: false, output: output.value, path: target.path })
  }
  return ok({ absolutePath: path.value, changed: true, output: output.value, path: target.path })
}

async function writeInitializedTargets(
  targets: readonly InitializedTarget[],
): Promise<Result<undefined>> {
  const [target, ...remaining] = targets
  if (!target) {
    return ok(undefined)
  }
  const directory = await attemptAsync(() =>
    mkdir(dirname(target.absolutePath), { recursive: true }),
  )
  if (!directory.ok) {
    return directory
  }
  const written = await writeAtomic(target.absolutePath, target.output)
  if (!written.ok) {
    return written
  }
  return writeInitializedTargets(remaining)
}

async function generateTarget(options: {
  readonly documents: readonly import('#types.js').TemplateDocument[]
  readonly paths: RepoPathResolver
  readonly renderer: IndexRenderer
  readonly target: AlmanacConfig['targets'][number]
}): Promise<Result<GeneratedTarget>> {
  const path = await options.paths.resolve(options.target.path)
  if (!path.ok) {
    return path
  }
  const safeTarget = await validateTargetPath(path.value, options.target.path)
  if (!safeTarget.ok) {
    return safeTarget
  }
  const source = await attemptAsync(() => readFile(path.value, 'utf8'))
  if (!source.ok) {
    return source
  }
  const body = await options.renderer.render(options.target, options.documents)
  if (!body.ok) {
    return body
  }
  const block = createRegion({ filePath: options.target.path, tags: options.target.tags })
  const output = block.replace(source.value, body.value)
  if (!output.ok) {
    return output
  }
  const changed = output.value !== source.value
  return ok({
    absolutePath: path.value,
    body: body.value,
    changed,
    output: output.value,
    path: options.target.path,
    tags: options.target.tags,
  })
}

async function writeGeneratedTargets(
  targets: readonly GeneratedTarget[],
): Promise<Result<undefined>> {
  const [target, ...remaining] = targets
  if (!target) {
    return ok(undefined)
  }
  const written = await writeAtomic(target.absolutePath, target.output)
  if (!written.ok) {
    return written
  }
  return writeGeneratedTargets(remaining)
}

async function stageManagedTargets(
  git: GitClient,
  targets: readonly GeneratedTarget[],
): Promise<Result<undefined>> {
  const [target, ...remaining] = targets
  if (!target) {
    return ok(undefined)
  }
  const staged = await stageManagedTarget(git, target)
  if (!staged.ok) {
    return staged
  }
  return stageManagedTargets(git, remaining)
}

async function stageManagedTarget(
  git: GitClient,
  target: GeneratedTarget,
): Promise<Result<undefined>> {
  const literalPath = `:(literal)${target.path}`
  const entry = await git.run(['ls-files', '--stage', '--', literalPath])
  if (!entry.ok) {
    return entry
  }
  if (!entry.value.stdout) {
    const staged = await git.run(['add', '--', literalPath])
    if (!staged.ok) {
      return staged
    }
    return ok(undefined)
  }
  const indexEntry = /^(\d+) [0-9a-f]+ (\d+)\t/u.exec(entry.value.stdout)
  if (!indexEntry || indexEntry[2] !== '0') {
    return err(`${target.path}: cannot stage a target with unmerged index entries`)
  }

  const indexed = await git.run(['show', `:${target.path}`])
  if (!indexed.ok) {
    return indexed
  }

  const block = createRegion({ filePath: target.path, tags: target.tags })
  const initialized = block.initialize(indexed.value.stdout)
  if (!initialized.ok) {
    return initialized
  }
  const contents = block.replace(initialized.value, target.body)
  if (!contents.ok) {
    return contents
  }
  const hash = await git.run(['hash-object', '-w', '--stdin'], { input: contents.value })
  if (!hash.ok) {
    return hash
  }
  const mode = indexEntry[1] ?? '100644'
  const updated = await git.run([
    'update-index',
    '--add',
    '--cacheinfo',
    mode,
    hash.value.stdout.trim(),
    target.path,
  ])
  if (!updated.ok) {
    return updated
  }
  return ok(undefined)
}

async function validateTargetPath(
  path: string,
  configuredPath: string,
): Promise<Result<undefined>> {
  const targetStat = await attemptAsync(() => lstat(path))
  if (!targetStat.ok) {
    if (isMissing(targetStat.error)) {
      return ok(undefined)
    }
    return targetStat
  }
  if (targetStat.value.isSymbolicLink()) {
    return err(`${configuredPath}: target must not be a symbolic link`)
  }
  return ok(undefined)
}

async function writeAtomic(path: string, contents: string): Promise<Result<undefined>> {
  const temporaryPath = `${path}.almanac-${process.pid}.tmp`
  const fileStat = await attemptAsync(() => stat(path))
  if (!fileStat.ok && !isMissing(fileStat.error)) {
    return fileStat
  }

  const written = await attemptAsync(async () => {
    if (fileStat.ok) {
      await writeFile(temporaryPath, contents, { mode: fileStat.value.mode })
    }
    if (!fileStat.ok) {
      await writeFile(temporaryPath, contents)
    }
    await rename(temporaryPath, path)
  })
  if (!written.ok) {
    return written
  }
  return ok(undefined)
}

async function readOptional(path: string): Promise<Result<string>> {
  const source = await attemptAsync(() => readFile(path, 'utf8'))
  if (source.ok) {
    return source
  }
  if (isMissing(source.error)) {
    return ok('')
  }
  return source
}

function isMissing(error: Error): boolean {
  return 'code' in error && error.code === 'ENOENT'
}

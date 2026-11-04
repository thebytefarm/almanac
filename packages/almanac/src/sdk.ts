import type { Result } from 'massaman/control'

import { createGitClient } from '#adapters/git.js'
import { createAlmanac as createClient } from '#client.js'
import type { DiffResult } from '#core/diff.js'
import type { HookStatus } from '#core/hooks.js'
import type { TargetChange } from '#core/project.js'
import { almanacConfigSchema } from '#schema.js'
import type { AlmanacConfigInput } from '#schema.js'

/**
 * Typed configuration supplied by the host tool, using Almanac's config contract.
 */
export type { AlmanacConfigInput } from '#schema.js'

/**
 * Plain data returned by SDK operations.
 */
export type { DiffResult, HookStatus, TargetChange }

/**
 * Writes leave the Git index untouched unless staging is explicitly requested.
 */
export interface WriteOptions {
  readonly stage?: boolean
}

/**
 * Repository-scoped SDK; failures throw Errors or reject Promises, never return Results.
 */
export interface Almanac {
  readonly check: () => Promise<readonly TargetChange[]>
  readonly diff: (base: string, head: string) => Promise<DiffResult>
  readonly hooks: {
    readonly install: () => Promise<HookStatus>
    readonly remove: () => Promise<HookStatus>
    readonly status: () => Promise<HookStatus>
  }
  readonly index: (options?: WriteOptions) => Promise<readonly TargetChange[]>
  readonly initialize: (options?: WriteOptions & { readonly hooks?: boolean }) => Promise<void>
  readonly link: (options?: WriteOptions) => Promise<readonly TargetChange[]>
  readonly sync: (options?: WriteOptions) => Promise<readonly TargetChange[]>
}

/**
 * Creates an SDK client from explicit configuration without loading Almanac config files.
 *
 * @param options - Host-owned configuration and a directory inside the Git repository.
 * @returns A silent client that leaves staging and hook installation opt-in.
 * @throws When configuration is invalid or the repository cannot be discovered.
 * @example
 * const almanac = createAlmanac({ cwd: repoPath, config: { targets: ['AGENTS.md'] } })
 * await almanac.sync()
 */
export function createAlmanac(options: {
  readonly config: AlmanacConfigInput
  readonly cwd?: string
}): Almanac {
  const config = almanacConfigSchema.parse(options.config)
  const git = unwrap(createGitClient(options.cwd))
  const client = (writeOptions: WriteOptions = {}) =>
    createClient({ config, git, stage: writeOptions.stage ?? false })
  const readClient = client()

  return {
    check: async () => unwrap(await readClient.check()),
    diff: async (base, head) => unwrap(await readClient.diff(base, head)),
    hooks: {
      install: async () => unwrap(await readClient.hooks.install()),
      remove: async () => unwrap(await readClient.hooks.remove()),
      status: async () => unwrap(await readClient.hooks.status()),
    },
    index: async (writeOptions) => unwrap(await client(writeOptions).index()),
    initialize: async (initializeOptions = {}) => {
      unwrap(
        await client(initializeOptions).initialize({ hooks: initializeOptions.hooks ?? false }),
      )
    },
    link: async (writeOptions) => unwrap(await client(writeOptions).link()),
    sync: async (writeOptions) => unwrap(await client(writeOptions).sync()),
  }
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) {
    throw result.error
  }
  return result.value
}

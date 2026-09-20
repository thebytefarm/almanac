import { ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { GitClient } from '#adapters/git.js'
import { createDiffClassifier } from '#core/diff.js'
import type { DiffResult } from '#core/diff.js'
import { createDocumentCatalog } from '#core/documents.js'
import { createHookManager } from '#core/hooks.js'
import type { HookStatus } from '#core/hooks.js'
import { createProject } from '#core/project.js'
import type { TargetChange } from '#core/project.js'
import { createIndexRenderer } from '#core/render.js'
import { createRepoPathResolver } from '#lib/repo-path.js'
import type { AlmanacConfig } from '#types.js'

/**
 * Cohesive repository-scoped API behind every Almanac CLI command.
 */
export interface Almanac {
  readonly check: () => Promise<Result<readonly TargetChange[]>>
  readonly diff: (base: string, head: string) => Promise<Result<DiffResult>>
  readonly hooks: {
    readonly install: () => Promise<Result<HookStatus>>
    readonly remove: () => Promise<Result<HookStatus>>
    readonly status: () => Promise<Result<HookStatus>>
  }
  readonly initialize: (options: { readonly hooks: boolean }) => Promise<Result<undefined>>
  readonly sync: () => Promise<Result<readonly TargetChange[]>>
}

/**
 * Creates the Almanac application facade for one repository.
 *
 * @param options - Repository-scoped Git client and validated static configuration.
 * @returns A cohesive API used by every maltty command handler.
 */
export function createAlmanac(options: {
  readonly config: AlmanacConfig
  readonly git: GitClient
}): Almanac {
  const paths = createRepoPathResolver(options.git.root)
  const catalog = createDocumentCatalog({
    config: options.config,
    git: options.git,
    paths,
  })
  const project = createProject({
    catalog,
    config: options.config,
    git: options.git,
    paths,
    renderer: createIndexRenderer(),
  })
  const hooks = createHookManager({ git: options.git })
  const diff = createDiffClassifier({ config: options.config, git: options.git })

  return {
    check: () => project.sync({ stage: false, write: false }),
    diff: diff.classify,
    hooks,
    initialize: async (initializeOptions) => {
      const initialized = await project.initializeTargets()
      if (!initialized.ok) {
        return initialized
      }
      const synced = await project.sync({ stage: true, write: true })
      if (!synced.ok) {
        return synced
      }
      if (!initializeOptions.hooks) {
        return ok(undefined)
      }
      const installed = await hooks.install()
      if (!installed.ok) {
        return installed
      }
      return ok(undefined)
    },
    sync: () => project.sync({ stage: true, write: true }),
  }
}

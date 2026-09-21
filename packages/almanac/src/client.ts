import { err, ok } from 'massaman/control'
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
import { almanacConfigSchema } from '#schema.js'
import type { AlmanacConfig, IndexOverrides } from '#types.js'

/**
 * Cohesive repository-scoped API behind every Almanac CLI command.
 */
export interface Almanac {
  readonly check: (overrides?: IndexOverrides) => Promise<Result<readonly TargetChange[]>>
  readonly diff: (base: string, head: string) => Promise<Result<DiffResult>>
  readonly hooks: {
    readonly install: () => Promise<Result<HookStatus>>
    readonly remove: () => Promise<Result<HookStatus>>
    readonly status: () => Promise<Result<HookStatus>>
  }
  readonly index: (overrides?: IndexOverrides) => Promise<Result<readonly TargetChange[]>>
  readonly initialize: (
    options: IndexOverrides & { readonly hooks: boolean },
  ) => Promise<Result<undefined>>
  readonly link: () => Promise<Result<readonly TargetChange[]>>
  readonly sync: (overrides?: IndexOverrides) => Promise<Result<readonly TargetChange[]>>
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
  const createConfiguredProject = (overrides: IndexOverrides = {}) => {
    const config = resolveConfig(options.config, overrides)
    if (!config.ok) {
      return config
    }
    return ok(
      createProject({
        catalog: createDocumentCatalog({ config: config.value, git: options.git, paths }),
        config: config.value,
        git: options.git,
        paths,
        renderer: createIndexRenderer(),
      }),
    )
  }
  const defaultProject = createProject({
    catalog: createDocumentCatalog({ config: options.config, git: options.git, paths }),
    config: options.config,
    git: options.git,
    paths,
    renderer: createIndexRenderer(),
  })
  const hooks = createHookManager({ git: options.git })
  const diff = createDiffClassifier({ config: options.config, git: options.git })

  return {
    check: async (overrides = {}) => {
      const project = createConfiguredProject(overrides)
      if (!project.ok) {
        return project
      }
      return project.value.sync({ stage: false, write: false })
    },
    diff: diff.classify,
    hooks,
    index: async (overrides = {}) => {
      const project = createConfiguredProject(overrides)
      if (!project.ok) {
        return project
      }
      return project.value.index({ stage: true, write: true })
    },
    initialize: async (initializeOptions) => {
      const project = createConfiguredProject(initializeOptions)
      if (!project.ok) {
        return project
      }
      const initialized = await project.value.initializeTargets()
      if (!initialized.ok) {
        return initialized
      }
      const synced = await project.value.sync({ stage: true, write: true })
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
    link: () => defaultProject.link({ stage: true, write: true }),
    sync: async (overrides = {}) => {
      const project = createConfiguredProject(overrides)
      if (!project.ok) {
        return project
      }
      return project.value.sync({ stage: true, write: true })
    },
  }
}

function resolveConfig(config: AlmanacConfig, overrides: IndexOverrides): Result<AlmanacConfig> {
  const resolved = almanacConfigSchema.safeParse({
    exclude: overrides.exclude ?? config.exclude,
    include: overrides.include ?? config.include,
    targets: overrides.targets ?? config.targets,
  })
  if (!resolved.success) {
    const issues = resolved.error.issues.map(
      (issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`,
    )
    return err(issues.join('; '))
  }
  return ok(resolved.data)
}

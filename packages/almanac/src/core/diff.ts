import { ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { GitClient } from '#adapters/git.js'
import { createRegion } from '#lib/region.js'
import { collectResults } from '#lib/result.js'
import type { AlmanacConfig } from '#types.js'

/**
 * Describes whether target changes affect managed or human-owned content.
 */
export type DiffClassification = 'generated-only' | 'human-authored' | 'none'

/**
 * Repository-level classification with per-target evidence.
 */
export interface DiffResult {
  readonly classification: DiffClassification
  readonly targets: readonly {
    readonly classification: DiffClassification
    readonly path: string
  }[]
}

/**
 * Compares configured targets across two Git revisions.
 */
export interface DiffClassifier {
  readonly classify: (base: string, head: string) => Promise<Result<DiffResult>>
}

/**
 * Creates a Git revision classifier for configured instruction targets.
 *
 * @param options - Validated target config and repository-scoped Git client.
 * @returns A classifier that separates generated and human-owned changes.
 */
export function createDiffClassifier(options: {
  readonly config: AlmanacConfig
  readonly git: GitClient
}): DiffClassifier {
  return {
    classify: async (base, head) => {
      const classified = await Promise.all(
        options.config.targets.map((target) => classifyTarget(options.git, target, base, head)),
      )
      const targets = collectResults(classified)
      if (!targets.ok) {
        return targets
      }
      return ok({ classification: classifyTargets(targets.value), targets: targets.value })
    },
  }
}

async function classifyTarget(
  git: GitClient,
  target: AlmanacConfig['targets'][number],
  base: string,
  head: string,
): Promise<Result<DiffResult['targets'][number]>> {
  const before = await readRevision(git, base, target.path)
  if (!before.ok) {
    return before
  }
  const after = await readRevision(git, head, target.path)
  if (!after.ok) {
    return after
  }
  const classification = classifyContents(target.path, before.value, after.value, target.tags)
  if (!classification.ok) {
    return classification
  }
  return ok({ classification: classification.value, path: target.path })
}

function classifyContents(
  filePath: string,
  before: string,
  after: string,
  tags: { readonly end: string; readonly start: string },
): Result<DiffClassification> {
  if (before === after) {
    return ok('none')
  }
  const block = createRegion({ filePath, tags })
  const beforeHuman = replaceManagedBody(block, before)
  if (!beforeHuman.ok) {
    return beforeHuman
  }
  const afterHuman = replaceManagedBody(block, after)
  if (!afterHuman.ok) {
    return afterHuman
  }
  if (beforeHuman.value === afterHuman.value) {
    return ok('generated-only')
  }
  return ok('human-authored')
}

function replaceManagedBody(
  block: ReturnType<typeof createRegion>,
  source: string,
): Result<string> {
  return block.replace(source, '__ALMANAC_MANAGED_BLOCK__')
}

function classifyTargets(targets: DiffResult['targets']): DiffClassification {
  if (targets.some((target) => target.classification === 'human-authored')) {
    return 'human-authored'
  }
  if (targets.some((target) => target.classification === 'generated-only')) {
    return 'generated-only'
  }
  return 'none'
}

async function readRevision(
  git: GitClient,
  revision: string,
  path: string,
): Promise<Result<string>> {
  const result = await git.run(['show', `${revision}:${path}`])
  if (!result.ok) {
    return result
  }
  return ok(result.value.stdout)
}

import { realpath } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

import { attemptAsync, err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

/**
 * Resolves safe repository-contained filesystem paths.
 */
export interface RepoPathResolver {
  readonly resolve: (path: string) => Promise<Result<string>>
}

/**
 * Creates a repository path resolver that rejects lexical and symlink escapes.
 *
 * @param repoRoot - Git repository root used as the containment boundary.
 * @returns A resolver for safe absolute filesystem paths.
 */
export function createRepoPathResolver(repoRoot: string): RepoPathResolver {
  const root = attemptAsync(() => realpath(repoRoot))

  return {
    resolve: async (path) => {
      const resolvedRoot = await root
      if (!resolvedRoot.ok) {
        return resolvedRoot
      }

      const absolute = resolve(resolvedRoot.value, path)
      const lexicalRelative = relative(resolvedRoot.value, absolute)
      if (isOutside(lexicalRelative)) {
        return err(`${path}: path escapes the repository`)
      }

      const ancestor = await findExistingAncestor(absolute)
      if (!ancestor.ok) {
        return ancestor
      }
      const resolvedAncestor = await attemptAsync(() => realpath(ancestor.value))
      if (!resolvedAncestor.ok) {
        return resolvedAncestor
      }
      const physicalRelative = relative(resolvedRoot.value, resolvedAncestor.value)
      if (isOutside(physicalRelative)) {
        return err(`${path}: path resolves outside the repository`)
      }
      return ok(absolute)
    },
  }
}

async function findExistingAncestor(path: string): Promise<Result<string>> {
  const result = await attemptAsync(() => realpath(path))
  if (result.ok) {
    return ok(path)
  }
  if (!isNodeError(result.error) || result.error.code !== 'ENOENT') {
    return result
  }

  const parent = dirname(path)
  if (parent === path) {
    return result
  }
  return findExistingAncestor(parent)
}

function isOutside(path: string): boolean {
  return path === '..' || path.startsWith('../') || path.startsWith('..\\')
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

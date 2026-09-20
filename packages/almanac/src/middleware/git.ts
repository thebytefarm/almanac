import { decorateContext, middleware } from 'maltty'
import { attemptAsync } from 'massaman/control'

import { createGitClient } from '#adapters/git.js'
import type { GitClient } from '#adapters/git.js'

declare module 'maltty' {
  interface CommandContext {
    readonly git: GitClient
  }
}

/**
 * Resolves and decorates the repository-scoped Git client.
 *
 * Establishes the repository root as cwd for downstream middleware whose APIs
 * resolve project files from `process.cwd()`.
 *
 * @returns Maltty middleware that decorates context with the Git client.
 */
export function gitMiddleware(): ReturnType<typeof middleware> {
  return middleware(async (ctx, next) => {
    const git = createGitClient()
    if (!git.ok) {
      return ctx.fail(git.error.message, { exitCode: 2 })
    }
    const changedDirectory = await attemptAsync(async () => process.chdir(git.value.root))
    if (!changedDirectory.ok) {
      return ctx.fail(changedDirectory.error.message, { exitCode: 2 })
    }
    decorateContext(ctx, 'git', git.value)
    await next()
  })
}

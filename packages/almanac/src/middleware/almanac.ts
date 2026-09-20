import { decorateContext, middleware } from 'maltty'

import { createAlmanac } from '#client.js'
import type { Almanac } from '#client.js'

declare module 'maltty' {
  interface CommandContext {
    readonly almanac: Almanac
  }
}

/**
 * Builds the repository-scoped Almanac facade once per command invocation.
 *
 * Runs after the Git and Almanac config middleware, both of which it reads.
 *
 * @returns Maltty middleware that decorates context with the Almanac facade.
 */
export function almanacMiddleware(): ReturnType<typeof middleware> {
  return middleware(async (ctx, next) => {
    decorateContext(ctx, 'almanac', createAlmanac({ config: ctx.almanacConfig, git: ctx.git }))
    await next()
  })
}

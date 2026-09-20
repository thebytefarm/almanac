import { readdir } from 'node:fs/promises'

import { decorateContext, middleware } from 'maltty'
import { attemptAsync, err, ok } from 'massaman/control'
import type { Result } from 'massaman/control'

import type { AlmanacConfig } from '#types.js'

const SUPPORTED_CONFIG_FILES = new Set(['almanac.json', 'almanac.yaml', 'almanac.yml'])

declare module 'maltty' {
  interface CommandContext {
    readonly almanacConfig: AlmanacConfig
  }
}

/**
 * Enforces Almanac's static config policy and loads validated project config.
 *
 * Maltty owns discovery, parsing, schema validation, defaults, and caching.
 * This middleware only narrows accepted filenames and exposes the loaded config.
 *
 * @returns Maltty middleware that decorates context with validated Almanac config.
 */
export function almanacConfigMiddleware(): ReturnType<typeof middleware> {
  return middleware(async (ctx, next) => {
    const validFiles = await validateConfigFiles(ctx.git.root)
    if (!validFiles.ok) {
      return ctx.fail(validFiles.error.message, { exitCode: 2 })
    }
    const loaded = await ctx.config.load({ exitOnError: true })
    decorateContext(ctx, 'almanacConfig', loaded.config)
    await next()
  })
}

async function validateConfigFiles(repoRoot: string): Promise<Result<undefined>> {
  const loaded = await attemptAsync(() => readdir(repoRoot, { withFileTypes: true }))
  if (!loaded.ok) {
    return loaded
  }
  const candidates = loaded.value.filter((entry) => {
    const name = entry.name.toLocaleLowerCase('en-US')
    return name.startsWith('almanac.') || name.startsWith('.almanac')
  })
  const unsupported = candidates.filter(
    (entry) => !entry.isFile() || !SUPPORTED_CONFIG_FILES.has(entry.name),
  )

  if (unsupported.length > 0) {
    return err(`Unsupported Almanac config file: ${unsupported.map(({ name }) => name).join(', ')}`)
  }
  const supported = candidates.map(({ name }) => name)
  if (supported.length > 1) {
    return err(`Use exactly one Almanac config file: ${supported.join(', ')}`)
  }
  return ok(undefined)
}

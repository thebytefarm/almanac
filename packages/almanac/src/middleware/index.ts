import { config } from 'maltty/config'

import { almanacConfigSchema } from '#schema.js'

import { almanacMiddleware } from './almanac.js'
import { almanacConfigMiddleware } from './config.js'
import { gitMiddleware } from './git.js'

/**
 * Global Almanac middleware stack shared by production and runCommand tests.
 *
 * Order is load-bearing: Git establishes the repository root, Maltty provides
 * its config handle, Almanac validates and loads it, then builds the facade.
 */
export const middleware: ReturnType<typeof config>[] = [
  gitMiddleware(),
  config({ name: 'almanac', schema: almanacConfigSchema }),
  almanacConfigMiddleware(),
  almanacMiddleware(),
]

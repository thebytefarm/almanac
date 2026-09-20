import { command } from 'maltty'

import { indexOptions, readStringArray } from '#lib/index-options.js'
import { unwrapCommand } from '#lib/result.js'

/**
 * Reports configured targets whose managed indexes differ from rendered output.
 */
export default command({
  description: 'Check managed docs indexes for drift without writing files',
  options: {
    ...indexOptions,
    format: {
      choices: ['text', 'json'] as const,
      default: 'text',
      description: 'Output format',
      type: 'string',
    },
  },
  handler: async (ctx) => {
    const checked = unwrapCommand(
      ctx,
      await ctx.almanac.check({
        exclude: readStringArray(ctx.args.exclude),
        include: readStringArray(ctx.args.include),
        targets: readStringArray(ctx.args.target),
      }),
    )
    const stale = checked.filter((change) => change.changed).map((change) => change.path)
    const result = { stale, status: getStatus(stale) }
    if (ctx.args.format === 'json') {
      ctx.log.raw(JSON.stringify(result))
    } else {
      ctx.log.raw(formatResult(result))
    }
    if (stale.length > 0) {
      ctx.fail(`${stale.length} managed path(s) are stale`, {
        code: 'ALMANAC_DRIFT',
        exitCode: 1,
      })
    }
  },
})

function formatResult(result: { readonly stale: readonly string[] }): string {
  if (result.stale.length === 0) {
    return 'Index is current'
  }
  return `Stale managed paths:\n${result.stale.map((path) => `- ${path}`).join('\n')}`
}

function getStatus(stale: readonly string[]): 'current' | 'stale' {
  if (stale.length === 0) {
    return 'current'
  }
  return 'stale'
}

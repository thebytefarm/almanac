import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Reports whether Almanac's pre-commit hook fragment is installed and valid.
 */
export default command({
  description: 'Inspect the Almanac pre-commit hook section',
  options: {
    format: {
      choices: ['text', 'json'] as const,
      default: 'text',
      description: 'Output format',
      type: 'string',
    },
  },
  handler: async (ctx) => {
    const status = unwrapCommand(ctx, await ctx.almanac.hooks.status())
    if (ctx.args.format === 'json') {
      ctx.log.raw(JSON.stringify(status))
    } else {
      ctx.log.raw(`Almanac hook: ${status.status}\nPath: ${status.path}`)
    }
    if (status.status === 'malformed' || status.status === 'not-executable') {
      ctx.fail(`Almanac hook is ${status.status}`, { exitCode: 2 })
    }
  },
})

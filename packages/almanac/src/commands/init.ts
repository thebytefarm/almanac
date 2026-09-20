import { command } from 'maltty'
import type { CommandContext } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Initializes target markers and optionally installs Almanac's pre-commit fragment.
 */
export default command({
  description: 'Initialize managed markers and optionally install the pre-commit hook',
  options: {
    hooks: {
      description: 'Install the hook without prompting; use --no-hooks to skip it',
      type: 'boolean',
    },
  },
  handler: async (ctx) => {
    const hooks = await resolveHooks(ctx)
    unwrapCommand(ctx, await ctx.almanac.initialize({ hooks }))
    ctx.log.raw('Almanac initialized')
  },
})

async function resolveHooks(ctx: CommandContext<{ readonly hooks?: boolean }>): Promise<boolean> {
  if (ctx.args.hooks !== undefined) {
    return ctx.args.hooks
  }
  return ctx.prompts.confirm({
    initialValue: false,
    message: 'Install the Almanac pre-commit hook?',
  })
}

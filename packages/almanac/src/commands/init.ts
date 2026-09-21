import { command } from 'maltty'
import type { CommandContext } from 'maltty'
import { z } from 'zod'

import { indexOptions } from '#lib/index-options.js'
import { unwrapCommand } from '#lib/result.js'

const initOptions = indexOptions.extend({
  hooks: z
    .boolean()
    .describe('Install the hook without prompting; use --no-hooks to skip it')
    .optional(),
})

type InitArgs = z.infer<typeof initOptions>

/**
 * Initializes target markers and optionally installs Almanac's pre-commit fragment.
 */
export default command({
  description: 'Initialize managed markers and optionally install the pre-commit hook',
  options: initOptions,
  handler: async (ctx) => {
    const hooks = await resolveHooks(ctx)
    unwrapCommand(
      ctx,
      await ctx.almanac.initialize({
        exclude: ctx.args.exclude,
        hooks,
        include: ctx.args.include,
        targets: ctx.args.target,
      }),
    )
    ctx.log.raw('Almanac initialized')
  },
})

async function resolveHooks(ctx: CommandContext<InitArgs>): Promise<boolean> {
  if (ctx.args.hooks !== undefined) {
    return ctx.args.hooks
  }
  return ctx.prompts.confirm({
    initialValue: false,
    message: 'Install the Almanac pre-commit hook?',
  })
}

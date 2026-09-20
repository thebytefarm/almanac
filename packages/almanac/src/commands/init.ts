import { command } from 'maltty'
import type { CommandContext } from 'maltty'

import { indexOptions, readStringArray } from '#lib/index-options.js'
import { unwrapCommand } from '#lib/result.js'

/**
 * Initializes target markers and optionally installs Almanac's pre-commit fragment.
 */
export default command({
  description: 'Initialize managed markers and optionally install the pre-commit hook',
  options: {
    ...indexOptions,
    hooks: {
      description: 'Install the hook without prompting; use --no-hooks to skip it',
      type: 'boolean',
    },
  },
  handler: async (ctx) => {
    const hooks = await resolveHooks(ctx)
    unwrapCommand(
      ctx,
      await ctx.almanac.initialize({
        exclude: readStringArray(ctx.args.exclude),
        hooks,
        include: readStringArray(ctx.args.include),
        targets: readStringArray(ctx.args.target),
      }),
    )
    ctx.log.raw('Almanac initialized')
  },
})

async function resolveHooks(
  ctx: CommandContext<{
    readonly exclude?: string[]
    readonly hooks?: boolean
    readonly include?: string[]
    readonly target?: string[]
  }>,
): Promise<boolean> {
  if (ctx.args.hooks !== undefined) {
    return ctx.args.hooks
  }
  return ctx.prompts.confirm({
    initialValue: false,
    message: 'Install the Almanac pre-commit hook?',
  })
}

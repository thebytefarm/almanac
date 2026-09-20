import { command } from 'maltty'

import { indexOptions } from '#lib/index-options.js'
import { unwrapCommand } from '#lib/result.js'

/**
 * Regenerates every configured target and stages only managed index changes.
 */
export default command({
  description: 'Regenerate indexes and agent compatibility links',
  options: indexOptions,
  handler: async (ctx) => {
    const synced = unwrapCommand(
      ctx,
      await ctx.almanac.sync({
        exclude: ctx.args.exclude,
        include: ctx.args.include,
        targets: ctx.args.target,
      }),
    )
    const changed = synced.filter((change) => change.changed)
    if (changed.length === 0) {
      ctx.log.raw('Index is current')
      return
    }
    ctx.log.raw(`Updated ${changed.length} managed path(s)`)
  },
})

import { command } from 'maltty'

import { indexOptions, readStringArray } from '#lib/index-options.js'
import { unwrapCommand } from '#lib/result.js'

/**
 * Regenerates configured index blocks without managing compatibility links.
 */
export default command({
  description: 'Regenerate managed docs indexes without linking agent files',
  options: indexOptions,
  handler: async (ctx) => {
    const indexed = unwrapCommand(
      ctx,
      await ctx.almanac.index({
        exclude: readStringArray(ctx.args.exclude),
        include: readStringArray(ctx.args.include),
        targets: readStringArray(ctx.args.target),
      }),
    )
    const changed = indexed.filter((change) => change.changed)
    if (changed.length === 0) {
      ctx.log.raw('Index is current')
      return
    }
    ctx.log.raw(`Updated ${changed.length} index target(s)`)
  },
})

import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Regenerates every configured target and stages only managed index changes.
 */
export default command({
  description: 'Regenerate managed docs indexes and stage changed targets',
  handler: async (ctx) => {
    const synced = unwrapCommand(ctx, await ctx.almanac.sync())
    const changed = synced.filter((change) => change.changed)
    if (changed.length === 0) {
      ctx.log.raw('Index is current')
      return
    }
    ctx.log.raw(`Updated ${changed.length} target(s)`)
  },
})

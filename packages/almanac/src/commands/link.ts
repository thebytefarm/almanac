import { command } from 'maltty'

import { unwrapCommand } from '#lib/result.js'

/**
 * Recursively creates compatibility links for Git-visible agent files.
 */
export default command({
  description: 'Link agent-specific instruction files to every Git-visible AGENTS.md',
  handler: async (ctx) => {
    const linked = unwrapCommand(ctx, await ctx.almanac.link())
    const changed = linked.filter((change) => change.changed)
    if (changed.length === 0) {
      ctx.log.raw('Links are current')
      return
    }
    ctx.log.raw(`Created ${changed.length} compatibility link(s)`)
  },
})
